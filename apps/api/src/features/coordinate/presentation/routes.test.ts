import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { todayJst } from '@haregi/schema'
import { createTestDatabase } from '../../../test/database.ts'
import { hc, type InferResponseType } from 'hono/client'
import type { AppType } from '../../../app.ts'
import { createApp } from '../../../app.ts'
import { createCoordinateRepository } from '../infrastructure/repository.ts'
import { createCoordinateService } from '../application/service.ts'
import { createForecastService } from '../../forecast/application/service.ts'
import { createForecastRepository } from '../../forecast/infrastructure/repository.ts'
import { jmaFixture } from '../../forecast/fixtures/jma.ts'
import type { SessionReader } from '../../auth/domain/auth-user.ts'

type Client = ReturnType<typeof hc<AppType>>
type ForecastJson = InferResponseType<Client['api']['forecast']['$get'], 200>
type CoordinatesJson = InferResponseType<
  Client['api']['coordinates']['$put'],
  200
>
type RouteDoc = {
  parameters: { name: string }[]
  responses: Record<
    string,
    {
      content: {
        'application/json': {
          schema: {
            properties: {
              items: { items: { required: string[] } }
              code: { enum: string[] }
            }
          }
        }
      }
    }
  >
}
type ApiDoc = {
  paths: { '/api/coordinates': { get: RouteDoc; put: RouteDoc } }
}

let database: Awaited<ReturnType<typeof createTestDatabase>>
let service: ReturnType<typeof createCoordinateService>
let forecast: ReturnType<typeof createForecastService>
let app: ReturnType<typeof createApp>
const sessions = (id: string): SessionReader => ({
  getSession: async () => ({
    user: { id, name: '晴れ', email: `${id}@example.com`, areaCode: '130000' },
  }),
})
const item = () => ({ date: todayJst(), tops: ' シャツ ' })
const put = (body: unknown, target = app) =>
  target.request('/api/coordinates', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
beforeAll(async () => {
  // 固定の予報fixtureとは別の日を今日にし、保存範囲と新規作成日を安定させる。
  // DB接続やリトライのタイマーは実時間で動かす。
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-12T12:00:00+09:00'))
  database = await createTestDatabase()
  database.migrate()
  for (const id of ['owner', 'other'])
    await database.pool.query(
      'INSERT INTO "user" (id, name, email, area_code) VALUES ($1,$1,$2,$3)',
      [id, `${id}@example.com`, '130000'],
    )
  forecast = createForecastService(
    createForecastRepository(database.db, {
      fetcher: async () => Response.json(jmaFixture()),
    }),
  )
  service = createCoordinateService(
    createCoordinateRepository(database.db),
    forecast,
  )
  app = createApp({
    sessions: sessions('owner'),
    coordinateService: service,
    forecastService: forecast,
  })
}, 30_000)
afterAll(async () => {
  vi.useRealTimers()
  await database?.close()
})
beforeEach(async () => {
  await database.pool.query('DELETE FROM coordinate')
  await database.pool.query('DELETE FROM coordinate_version')
})
it('PUT は新しい version を含む items を返し、GET にも同じ行を返す', async () => {
  const response = await put({ items: [item()] })
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body).toMatchObject({
    items: [
      {
        date: todayJst(),
        tops: 'シャツ',
        version: 1,
        snapshotStatus: 'unavailable',
      },
    ],
  })
  const listed = await app.request('/api/coordinates')
  expect(listed.status).toBe(200)
  expect(await listed.json()).toEqual(body)
})
const day = (offset: number) =>
  new Date(Date.parse(`${todayJst()}T00:00:00Z`) + offset * 86400000)
    .toISOString()
    .slice(0, 10)
it('連続保存で版が進み、新版で更新でき、旧版と省略は409で全件戻る', async () => {
  await put({ items: [item()] })
  for (const version of [1, 2]) {
    const response = await put({ items: [{ ...item(), version }] })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      items: [{ version: version + 1 }],
    })
  }
  for (const version of [undefined, 1, 2, 99]) {
    const response = await put({
      items: [
        { date: day(1), tops: '先行' },
        { ...item(), version },
      ],
    })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'VERSION_CONFLICT' })
    expect(await (await app.request('/api/coordinates')).json()).toMatchObject({
      items: [{ date: todayJst(), version: 3 }],
    })
    expect(await service.listCoordinates('owner')).toHaveLength(1)
  }
})
it('同じ版の並行PUTは片方だけ成功し、後着の他itemを適用しない', async () => {
  await put({ items: [item()] })
  const responses = await Promise.all(
    [1, 2].map((offset) =>
      put({
        items: [
          { date: day(offset), tops: '服' },
          { ...item(), version: 1 },
        ],
      }),
    ),
  )
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409])
  expect(await service.listCoordinates('owner')).toHaveLength(2)
})
it('GETはセッションの所有者だけを返し、他人と同日のPUTも自分の新規になる', async () => {
  await service.upsertCoordinates('other', {
    items: [{ ...item(), tops: '他人' }],
  })
  expect(await (await app.request('/api/coordinates')).json()).toEqual({
    items: [],
  })
  const response = await put({ userId: 'other', items: [item()] })
  expect(response.status).toBe(200)
  expect((await service.listCoordinates('other'))[0]?.tops).toBe('他人')
  expect((await service.listCoordinates('owner'))[0]?.tops).toBe('シャツ')
})
it('空入力のno-op・所有権・一致削除・省略/不一致409と全件ロールバック', async () => {
  await service.upsertCoordinates('other', {
    items: [{ ...item(), tops: '他人' }],
  })
  for (const version of [undefined, 99]) {
    const response = await put({ items: [{ date: todayJst(), version }] })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ items: [] })
  }
  expect(await service.listCoordinates('other')).toHaveLength(1)
  await put({ items: [item()] })
  for (const version of [undefined, 99]) {
    const response = await put({
      items: [
        { date: day(1), tops: '先行' },
        { date: todayJst(), version },
      ],
    })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'VERSION_CONFLICT' })
    expect(await service.listCoordinates('owner')).toHaveLength(1)
  }
  const response = await put({
    items: [
      { date: todayJst(), tops: '　', version: 1 },
      { date: day(1) },
      { date: day(2), tops: '服' },
    ],
  })
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    items: [{ date: day(2), version: 1 }],
  })
  expect(
    (await service.listCoordinates('owner')).map((row) => row.date),
  ).toEqual([day(2)])
})
it('未認証GET/PUTは401で、保存しない', async () => {
  const unauthenticated = createApp({
    sessions: { getSession: async () => null },
    coordinateService: service,
  })
  expect((await unauthenticated.request('/api/coordinates')).status).toBe(401)
  expect((await put({ items: [item()] }, unauthenticated)).status).toBe(401)
  expect(await service.listCoordinates('owner')).toEqual([])
})
it('件数・重複・暦日・範囲・文字数・versionの不正は400', async () => {
  for (const items of [
    Array(8).fill(item()),
    [item(), item()],
    [{ date: '2026-02-30', tops: '服' }],
    [{ date: '1900-01-01', tops: '服' }],
    [{ ...item(), tops: 'a'.repeat(51) }],
    [{ ...item(), version: 0 }],
  ]) {
    const response = await put({ items })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'VALIDATION' })
  }
  expect(await service.listCoordinates('owner')).toEqual([])
})
it('不正なJSONは日本語のVALIDATIONエラーと400を返し保存しない', async () => {
  const response = await app.request('/api/coordinates', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: '{',
  })
  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({
    code: 'VALIDATION',
    message: '入力内容を確認してください',
  })
  expect(await service.listCoordinates('owner')).toEqual([])
})
it('GET範囲は両方必要・実在日・from<=to・包含366日まで', async () => {
  for (const query of [
    'from=2026-01-01',
    'to=2026-01-01',
    'from=&to=',
    'from=2026-02-30&to=2026-03-01',
    'from=2026-01-02&to=2026-01-01',
    'from=2026-01-01&to=2027-01-02',
  ])
    expect((await app.request(`/api/coordinates?${query}`)).status).toBe(400)
  for (const query of [
    'from=2026-01-01&to=2027-01-01',
    `from=${todayJst()}&to=${todayJst()}`,
  ])
    expect((await app.request(`/api/coordinates?${query}`)).status).toBe(200)
})
it('指定世代からの保存・省略時の保持・解決不能世代の409をHTTP経由でも保証する', async () => {
  const generation = (await (
    await app.request('/api/forecast')
  ).json()) as ForecastJson
  const forecastDay = generation.days[0]!
  const response = await put({
    snapshotId: generation.snapshotId,
    items: [
      {
        date: forecastDay.date,
        tops: '服',
        maxTemperature: 999,
        areaCode: 'other',
      },
    ],
  })
  expect(response.status).toBe(200)
  const saved = ((await response.json()) as CoordinatesJson).items[0]!
  expect(saved).toMatchObject({
    maxTemperature: forecastDay.maxTemperature,
    minTemperature: forecastDay.minTemperature,
    areaCode: generation.areaCode,
    tempStation: generation.tempStation,
    forecastIssuedAt: generation.forecastIssuedAt,
    snapshotStatus: 'fresh',
  })
  const updated = await put({
    items: [{ date: forecastDay.date, tops: '変更', version: 1 }],
  })
  expect(updated.status).toBe(200)
  expect(((await updated.json()) as CoordinatesJson).items[0]!).toMatchObject({
    ...saved,
    tops: '変更',
    version: 2,
    updatedAt: expect.any(String),
  })
  for (const snapshotId of ['missing', '']) {
    const missing = await put({
      snapshotId,
      items: [
        { date: forecastDay.date, tops: '適用しない', version: 2 },
        { date: day(1), tops: '他item' },
      ],
    })
    expect(missing.status).toBe(409)
    expect(await missing.json()).toMatchObject({ code: 'SNAPSHOT_UNAVAILABLE' })
    expect(await service.listCoordinates('owner')).toHaveLength(1)
    expect((await service.listCoordinates('owner'))[0]?.version).toBe(2)
  }
})
it('24時間超の障害でstale GET→PUTが成功し stale を記録する', async () => {
  let now = Date.now()
  const fetcher = vi.fn(async () => Response.json(jmaFixture()))
  const staleForecast = createForecastService(
    createForecastRepository(database.db, {
      fetcher,
      now: () => now,
      sleep: async () => {},
    }),
  )
  const staleService = createCoordinateService(
    createCoordinateRepository(database.db),
    staleForecast,
  )
  const target = createApp({
    sessions: sessions('owner'),
    forecastService: staleForecast,
    coordinateService: staleService,
  })
  const first = (await (
    await target.request('/api/forecast')
  ).json()) as ForecastJson
  await database.pool.query(
    "UPDATE forecast_snapshot SET created_at = now() - interval '25 hours' WHERE snapshot_id = $1",
    [first.snapshotId],
  )
  now += 25 * 60 * 60 * 1000
  fetcher.mockRejectedValue(new Error('offline'))
  const stale = (await (
    await target.request('/api/forecast')
  ).json()) as ForecastJson
  expect(stale).toMatchObject({
    status: 'stale',
    forecastIssuedAt: first.forecastIssuedAt,
  })
  expect(stale.snapshotId).not.toBe(first.snapshotId)
  const response = await put(
    {
      snapshotId: stale.snapshotId,
      items: [{ date: stale.days[0]!.date, tops: '服' }],
    },
    target,
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    items: [
      {
        snapshotStatus: 'stale',
        version: 1,
        maxTemperature: stale.days[0]!.maxTemperature,
      },
    ],
  })
})
it('OpenAPIにGET/PUT、version、409の2コードを掲載しDELETEは作らない', async () => {
  const doc = (await (await app.request('/api/openapi.json')).json()) as ApiDoc
  const routes = doc.paths['/api/coordinates']
  expect(Object.keys(routes).sort()).toEqual(['get', 'put'])
  expect(routes.get.parameters.map((p: { name: string }) => p.name)).toEqual([
    'from',
    'to',
  ])
  for (const route of [routes.get, routes.put])
    expect(
      route.responses['200']!.content['application/json'].schema.properties
        .items.items.required,
    ).toContain('version')
  expect(
    routes.put.responses['409']!.content['application/json'].schema.properties
      .code.enum,
  ).toEqual(['VERSION_CONFLICT', 'SNAPSHOT_UNAVAILABLE'])
  expect((await app.request('/api/doc')).status).toBe(200)
  expect(
    (await app.request(`/api/coordinates/${todayJst()}`, { method: 'DELETE' }))
      .status,
  ).toBe(404)
})
it('DB障害は内部情報を含まない500としてGET/PUTへ返す', async () => {
  const { createDb } = await import('@haregi/db')
  const connection = createDb(database.url)
  const offlineService = createCoordinateService(
    createCoordinateRepository(connection.db),
    forecast,
  )
  const target = createApp({
    sessions: sessions('owner'),
    coordinateService: offlineService,
  })
  await connection.pool.end()
  for (const response of [
    await target.request('/api/coordinates'),
    await put({ items: [item()] }, target),
  ]) {
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'サーバーエラーが発生しました',
    })
  }
})
it('保存した全行の鮮度と正のversionの不変条件を実DBで固定する', async () => {
  const generation = await forecast.getForecast('130000')
  await service.upsertCoordinates('owner', {
    snapshotId: generation.snapshotId,
    items: [{ date: generation.days[0]!.date, tops: '服' }],
  })
  await service.upsertCoordinates('owner', {
    snapshotId: generation.snapshotId,
    items: [{ date: todayJst(), tops: '服' }],
  })
  await service.upsertCoordinates('owner', {
    items: [{ date: todayJst(), tops: '変更', version: 1 }],
  })
  const stored = await database.pool.query(
    'SELECT snapshot_status, version FROM coordinate',
  )
  expect(stored.rows).toHaveLength(2)
  for (const row of stored.rows) {
    expect(['fresh', 'stale', 'unavailable']).toContain(row.snapshot_status)
    expect(Number.isInteger(row.version) && row.version >= 1).toBe(true)
  }
})
it.each(['更新', '削除'])(
  '削除・再作成を跨いで旧版による%sを409にし、他itemも戻す',
  async (operation) => {
    const first = await put({ items: [item()] })
    const oldVersion = ((await first.json()) as CoordinatesJson).items[0]!
      .version
    expect(
      (await put({ items: [{ date: todayJst(), version: oldVersion }] }))
        .status,
    ).toBe(200)
    const recreated = await put({ items: [{ ...item(), tops: '新しい記録' }] })
    expect(recreated.status).toBe(200)
    const newVersion = ((await recreated.json()) as CoordinatesJson).items[0]!
      .version
    const obsolete = await put({
      items: [
        { date: day(1), tops: '適用されない' },
        {
          date: todayJst(),
          version: oldVersion,
          ...(operation === '更新' ? { tops: '古い画面' } : {}),
        },
      ],
    })
    expect(obsolete.status).toBe(409)
    expect(await obsolete.json()).toMatchObject({ code: 'VERSION_CONFLICT' })
    expect(newVersion).toBe(oldVersion + 1)
    expect(await service.listCoordinates('owner')).toMatchObject([
      { date: todayJst(), tops: '新しい記録', version: newVersion },
    ])
    expect(
      (await put({ items: [{ ...item(), version: newVersion }] })).status,
    ).toBe(200)
  },
)
