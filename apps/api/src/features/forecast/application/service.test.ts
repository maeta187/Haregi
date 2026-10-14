import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createTestDatabase } from '../../../test/database.ts'
import { toHttpError } from '../../../shared/http-errors.ts'
import { createForecastRepository } from '../infrastructure/repository.ts'
import { jmaFixture } from '../fixtures/jma.ts'
import { createForecastService } from './service.ts'
import {
  ForecastUnavailableError,
  SnapshotUnavailableError,
  UnknownAreaError,
} from './errors.ts'

describe('予報ユースケース', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>
  beforeAll(async () => {
    database = await createTestDatabase()
    database.migrate()
  }, 30_000)
  afterAll(async () => {
    await database?.close()
  })
  it('Result を公開せず、表示した世代を再取得なしで返す', async () => {
    const fetcher = vi.fn(async () => Response.json(jmaFixture()))
    const service = createForecastService(
      createForecastRepository(database.db, { fetcher }),
    )
    const forecast = await service.getForecast('130000')
    expect(await service.getForecastBySnapshotId(forecast.snapshotId)).toEqual(
      forecast,
    )
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it.each(['fetch', 'json', 'structure'] as const)(
    '%s 失敗は型付き 502 へ変換する',
    async (kind) => {
      const fetcher = vi.fn(async () => {
        if (kind === 'fetch') throw new Error('offline')
        return kind === 'json'
          ? new Response('invalid json')
          : Response.json({})
      })
      const service = createForecastService(
        createForecastRepository(database.db, {
          fetcher,
          sleep: async () => {},
        }),
      )
      const error = await service.getForecast('130000').catch((e: unknown) => e)
      expect(error).toBeInstanceOf(ForecastUnavailableError)
      expect(toHttpError(error).status).toBe(502)
      expect(fetcher).toHaveBeenCalledTimes(3)
    },
  )
  it('未知の地域は 400、失効・不存在の世代は競合と区別した 409 にする', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const service = createForecastService(
      createForecastRepository(database.db, { fetcher }),
    )
    const areaError = await service
      .getForecast('unknown')
      .catch((e: unknown) => e)
    expect(areaError).toBeInstanceOf(UnknownAreaError)
    expect(toHttpError(areaError).status).toBe(400)
    const snapshotError = await service
      .getForecastBySnapshotId('missing')
      .catch((e: unknown) => e)
    expect(snapshotError).toBeInstanceOf(SnapshotUnavailableError)
    expect(toHttpError(snapshotError)).toMatchObject({
      status: 409,
      body: { code: 'SNAPSHOT_UNAVAILABLE' },
    })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
