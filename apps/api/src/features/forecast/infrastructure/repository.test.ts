import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createDb } from '@haregi/db'
import { createTestDatabase } from '../../../test/database.ts'
import { jmaFixture } from '../fixtures/jma.ts'
import { createForecastRepository } from './repository.ts'

describe('予報取得と永続化', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>
  beforeAll(async () => {
    database = await createTestDatabase()
    database.migrate()
  }, 30_000)
  afterAll(async () => {
    await database?.close()
  })
  it('予報世代を DB へ保存し、別インスタンスで同じ内容を引き当てる', async () => {
    const fetcher = vi.fn(async () => Response.json(jmaFixture()))
    const repository = createForecastRepository(database.db, { fetcher })
    const result = await repository.getForecast('130000')
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error
    expect(result.value).toMatchObject({
      status: 'fresh',
      areaCode: '130000',
      tempStation: '44132',
    })
    const stored = await database.pool.query(
      'SELECT * FROM forecast_snapshot WHERE snapshot_id = $1',
      [result.value.snapshotId],
    )
    expect(stored.rows[0].payload.days).toEqual(result.value.days)
    expect(stored.rows[0].status).toBe('fresh')
    const restarted = createForecastRepository(database.db, { fetcher })
    const lookup = await restarted.getForecastBySnapshotId(
      result.value.snapshotId,
    )
    expect(lookup.isOk() && lookup.value).toEqual(result.value)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('TTL 内は同一地域の発信を抑え、地域を混同せずキャッシュ失効後は取り直す', async () => {
    let now = Date.parse('2026-10-11T03:00:00Z')
    const fetcher = vi.fn(async (url: string | URL | Request) =>
      Response.json(
        jmaFixture(String(url).includes('460100') ? '460040' : '130000'),
      ),
    )
    const repository = createForecastRepository(database.db, {
      fetcher,
      now: () => now,
      sleep: async () => {},
    })
    const first = await repository.getForecast('130000')
    const second = await repository.getForecast('130000')
    expect(
      first.isOk() &&
        second.isOk() &&
        first.value.snapshotId !== second.value.snapshotId,
    ).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
    await repository.getForecast('460040')
    expect(fetcher).toHaveBeenCalledTimes(2)
    now += 30 * 60 * 1000
    await repository.getForecast('130000')
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('24時間超の障害でも last-known-good の時刻を保ち、新しい有効な stale 世代を発行する', async () => {
    let now = Date.now()
    const fetcher = vi.fn(async () => Response.json(jmaFixture()))
    const repository = createForecastRepository(database.db, {
      fetcher,
      now: () => now,
      sleep: async () => {},
    })
    const first = await repository.getForecast('130000')
    if (first.isErr()) throw first.error
    await database.pool.query(
      "UPDATE forecast_snapshot SET created_at = now() - interval '25 hours' WHERE snapshot_id = $1",
      [first.value.snapshotId],
    )
    const expired = await repository.getForecastBySnapshotId(
      first.value.snapshotId,
    )
    expect(expired.isErr() && expired.error.kind).toBe('SnapshotMissingError')
    expect(
      (
        await database.pool.query(
          'SELECT snapshot_id FROM forecast_snapshot WHERE snapshot_id = $1',
          [first.value.snapshotId],
        )
      ).rowCount,
    ).toBe(1)
    now += 25 * 60 * 60 * 1000
    fetcher.mockRejectedValue(new Error('offline'))
    const stale = await repository.getForecast('130000')
    expect(stale.isOk()).toBe(true)
    if (stale.isErr()) throw stale.error
    expect(stale.value.snapshotId).not.toBe(first.value.snapshotId)
    expect(stale.value).toMatchObject({
      status: 'stale',
      fetchedAt: first.value.fetchedAt,
      forecastIssuedAt: first.value.forecastIssuedAt,
      days: first.value.days,
    })
    const resolved = await repository.getForecastBySnapshotId(
      stale.value.snapshotId,
    )
    expect(resolved.isOk() && resolved.value).toEqual(stale.value)
    expect(
      (
        await database.pool.query(
          'SELECT status FROM forecast_snapshot WHERE snapshot_id = $1',
          [stale.value.snapshotId],
        )
      ).rows[0].status,
    ).toBe('stale')
    expect(
      (
        await database.pool.query(
          'SELECT snapshot_id FROM forecast_snapshot WHERE snapshot_id = $1',
          [first.value.snapshotId],
        )
      ).rowCount,
    ).toBe(0)
    fetcher.mockResolvedValue(Response.json(jmaFixture()))
    const recovered = await repository.getForecast('130000')
    expect(recovered.isOk() && recovered.value.status).toBe('fresh')
  })

  it('同一地域の並行取得を1本に束ね、完了後は失効時に再取得できる', async () => {
    let now = Date.now()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const fetcher = vi.fn(async () => {
      await gate
      return Response.json(jmaFixture())
    })
    const repository = createForecastRepository(database.db, {
      fetcher,
      now: () => now,
      sleep: async () => {},
    })
    const requests = Array.from({ length: 10 }, () =>
      repository.getForecast('130000'),
    )
    expect(fetcher).toHaveBeenCalledTimes(1)
    release()
    const results = await Promise.all(requests)
    expect(results.every((r) => r.isOk())).toBe(true)
    now += 30 * 60 * 1000
    await repository.getForecast('130000')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('タイムアウトを毎回設定し、指数バックオフとジッターを挟んで最大3回再試行する', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json(jmaFixture('014030')))
    const sleep = vi.fn(async (_ms: number) => {})
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    try {
      const repository = createForecastRepository(database.db, {
        fetcher,
        sleep,
        random: () => 0.5,
      })
      const result = await repository.getForecast('014030')
      expect(result.isOk()).toBe(true)
      expect(fetcher).toHaveBeenCalledTimes(3)
      expect(
        fetcher.mock.calls.every(([url]) =>
          String(url).endsWith('/014100.json'),
        ),
      ).toBe(true)
      expect(sleep.mock.calls).toEqual([[750], [1500]])
      expect(timeout.mock.calls).toEqual([[10000], [10000], [10000]])
    } finally {
      timeout.mockRestore()
    }
  })

  it('DB 書き込みに失敗したら有効でない snapshotId を成功として返さない', async () => {
    const connection = createDb(database.url)
    const repository = createForecastRepository(connection.db, {
      fetcher: async () => Response.json(jmaFixture()),
    })
    await connection.pool.end()
    const result = await repository.getForecast('130000')
    expect(result.isErr() && result.error.kind).toBe('DbError')
    const lookup = await repository.getForecastBySnapshotId('any')
    expect(lookup.isErr() && lookup.error.kind).toBe('DbError')
  })
  it('失敗した並行取得も解放し、次回は成功できる', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('offline'))
    const repository = createForecastRepository(database.db, {
      fetcher,
      sleep: async () => {},
    })
    const results = await Promise.all([
      repository.getForecast('130000'),
      repository.getForecast('130000'),
    ])
    expect(
      results.every((r) => r.isErr() && r.error.kind === 'FetchError'),
    ).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(3)
    fetcher.mockImplementation(async () => Response.json(jmaFixture()))
    expect((await repository.getForecast('130000')).isOk()).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(4)
  })
})
