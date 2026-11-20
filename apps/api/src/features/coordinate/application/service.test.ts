import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { createDb } from '@haregi/db'
import { createTestDatabase } from '../../../test/database.ts'
import { createCoordinateRepository } from '../infrastructure/repository.ts'
import { createForecastRepository } from '../../forecast/infrastructure/repository.ts'
import { createForecastService } from '../../forecast/application/service.ts'
import { jmaFixture } from '../../forecast/fixtures/jma.ts'
import { createCoordinateService } from './service.ts'

let database: Awaited<ReturnType<typeof createTestDatabase>>
beforeAll(async () => {
  database = await createTestDatabase()
  database.migrate()
  await database.pool.query(
    'INSERT INTO "user" (id, name, email, area_code) VALUES ($1,$1,$2,$3)',
    ['owner', 'owner@example.com', '130000'],
  )
}, 30_000)
afterAll(async () => {
  await database?.close()
})
beforeEach(async () => {
  await database.pool.query('DELETE FROM coordinate')
  await database.pool.query('DELETE FROM coordinate_version')
})
const setup = () => {
  const forecast = createForecastService(
    createForecastRepository(database.db, {
      fetcher: async () => Response.json(jmaFixture()),
    }),
  )
  return {
    forecast,
    service: createCoordinateService(
      createCoordinateRepository(database.db),
      forecast,
    ),
  }
}
it('指定した世代の気温を保存し、省略した更新では全由来を維持する', async () => {
  const { forecast, service } = setup()
  const first = await forecast.getForecast('130000')
  const day = first.days[0]!
  const [saved] = await service.upsertCoordinates('owner', {
    snapshotId: first.snapshotId,
    items: [{ date: day.date, tops: '服' }],
  })
  expect(saved).toMatchObject({
    maxTemperature: day.maxTemperature,
    minTemperature: day.minTemperature,
    areaCode: first.areaCode,
    tempStation: first.tempStation,
    forecastIssuedAt: first.forecastIssuedAt,
    snapshotStatus: 'fresh',
    version: 1,
  })
  const [updated] = await service.upsertCoordinates('owner', {
    items: [{ date: day.date, tops: '別の服', version: 1 }],
  })
  expect(updated).toMatchObject({
    ...saved,
    tops: '別の服',
    version: 2,
    updatedAt: expect.any(Date),
  })
})
it('範囲外の新規と予報なしの新規は null + unavailable で保存できる', async () => {
  const { forecast, service } = setup()
  const generation = await forecast.getForecast('130000')
  for (const [date, snapshotId] of [
    ['2026-11-12', generation.snapshotId],
    ['2026-11-13', undefined],
  ]) {
    const [row] = await service.upsertCoordinates('owner', {
      snapshotId,
      items: [{ date: date!, tops: '服' }],
    })
    expect(row).toMatchObject({
      maxTemperature: null,
      minTemperature: null,
      snapshotStatus: 'unavailable',
      version: 1,
    })
  }
})
it('未知・失効した世代は保存前に SNAPSHOT_UNAVAILABLE とし、全 item を適用しない', async () => {
  const { forecast, service } = setup()
  const generation = await forecast.getForecast('130000')
  await database.pool.query(
    "UPDATE forecast_snapshot SET created_at = now() - interval '25 hours' WHERE snapshot_id = $1",
    [generation.snapshotId],
  )
  for (const snapshotId of ['missing', '', generation.snapshotId])
    await expect(
      service.upsertCoordinates('owner', {
        snapshotId,
        items: [{ date: '2026-11-13', tops: '服' }],
      }),
    ).rejects.toMatchObject({ code: 'SNAPSHOT_UNAVAILABLE' })
  expect(await service.listCoordinates('owner')).toEqual([])
})
it('24時間超の障害で stale GET が発行した新世代から保存できる', async () => {
  let now = Date.now()
  const fetcher = vi.fn(async () => Response.json(jmaFixture()))
  const forecast = createForecastService(
    createForecastRepository(database.db, {
      fetcher,
      now: () => now,
      sleep: async () => {},
    }),
  )
  const service = createCoordinateService(
    createCoordinateRepository(database.db),
    forecast,
  )
  const first = await forecast.getForecast('130000')
  await database.pool.query(
    "UPDATE forecast_snapshot SET created_at = now() - interval '25 hours' WHERE snapshot_id = $1",
    [first.snapshotId],
  )
  now += 25 * 60 * 60 * 1000
  fetcher.mockRejectedValue(new Error('offline'))
  const stale = await forecast.getForecast('130000')
  expect(stale.status).toBe('stale')
  const [saved] = await service.upsertCoordinates('owner', {
    snapshotId: stale.snapshotId,
    items: [{ date: stale.days[0]!.date, tops: '服' }],
  })
  expect(saved).toMatchObject({
    snapshotStatus: 'stale',
    maxTemperature: stale.days[0]!.maxTemperature,
    forecastIssuedAt: first.forecastIssuedAt,
  })
  expect(await service.listCoordinates('owner')).toEqual([saved])
})
it('保存時の版競合を VERSION_CONFLICT に、DB障害を型付きエラーに変換する', async () => {
  const { service, forecast } = setup()
  const item = { date: '2026-11-13', tops: '服' }
  await service.upsertCoordinates('owner', { items: [item] })
  await expect(
    service.upsertCoordinates('owner', { items: [item] }),
  ).rejects.toMatchObject({
    name: 'VersionConflictError',
    code: 'VERSION_CONFLICT',
  })
  const connection = createDb(database.url)
  const offline = createCoordinateService(
    createCoordinateRepository(connection.db),
    forecast,
  )
  await connection.pool.end()
  await expect(offline.listCoordinates('owner')).rejects.toMatchObject({
    name: 'CoordinateStorageError',
  })
  await expect(
    offline.upsertCoordinates('owner', { items: [item] }),
  ).rejects.toMatchObject({ name: 'CoordinateStorageError' })
})
