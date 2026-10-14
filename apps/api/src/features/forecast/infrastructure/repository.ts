import { randomUUID } from 'node:crypto'
import { type Db, forecastSnapshot } from '@haregi/db'
import { findArea, resolveForecastCode } from '@haregi/schema'
import { and, eq, gt, lte, sql } from 'drizzle-orm'
import { ResultAsync } from 'neverthrow'
import { logger } from '../../../shared/logger.ts'
import type { Forecast, ForecastContent } from '../domain/forecast.ts'
import type { ForecastError, ForecastRepository } from '../domain/repository.ts'
import { normalizeForecast } from '../domain/normalize.ts'

export type ForecastOptions = {
  fetcher?: typeof fetch
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

export function createForecastRepository(
  db: Db,
  {
    fetcher = fetch,
    now = Date.now,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    random = Math.random,
  }: ForecastOptions = {},
): ForecastRepository {
  const cache = new Map<string, ForecastContent>()
  const inFlight = new Map<string, Promise<ForecastContent>>()
  async function load(areaCode: string): Promise<ForecastContent> {
    const cached = cache.get(areaCode)
    if (cached && now() - cached.fetchedAt.getTime() < 30 * 60 * 1000)
      return cached
    const area = findArea(areaCode)
    if (!area) throw { kind: 'UnknownAreaError' } satisfies ForecastError
    let content: ForecastContent | undefined
    for (let attempt = 0; attempt < 3; attempt++) {
      let failure: ForecastError
      try {
        const response = await fetcher(
          `https://www.jma.go.jp/bosai/forecast/data/forecast/${resolveForecastCode(areaCode)}.json`,
          { signal: AbortSignal.timeout(10_000) },
        )
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        try {
          content = {
            ...normalizeForecast(await response.json(), area),
            fetchedAt: new Date(now()),
            status: 'fresh',
          }
          break
        } catch (cause) {
          failure = { kind: 'ParseError', cause }
        }
      } catch (cause) {
        failure = { kind: 'FetchError', cause }
      }
      if (attempt === 2) throw failure
      await sleep(500 * 2 ** attempt * (1 + random()))
    }
    if (!content) throw { kind: 'FetchError' } satisfies ForecastError
    cache.set(areaCode, content)
    return content
  }
  async function getForecast(areaCode: string): Promise<Forecast> {
    let pending = inFlight.get(areaCode)
    if (!pending) {
      pending = load(areaCode).finally(() => {
        inFlight.delete(areaCode)
      })
      inFlight.set(areaCode, pending)
    }
    let content: ForecastContent
    try {
      content = await pending
    } catch (error) {
      const cached = cache.get(areaCode)
      if (!cached) throw error
      logger.warn(
        { areaCode, error },
        '予報の再取得失敗。最後に成功した予報を返します',
      )
      content = { ...cached, status: 'stale' }
    }
    const forecast = { ...content, snapshotId: randomUUID() }
    try {
      await db
        .insert(forecastSnapshot)
        .values({ ...forecast, payload: forecast })
      await db
        .delete(forecastSnapshot)
        .where(
          lte(forecastSnapshot.createdAt, sql`now() - interval '24 hours'`),
        )
    } catch (cause) {
      throw { kind: 'DbError', cause } satisfies ForecastError
    }
    return forecast
  }
  async function getForecastBySnapshotId(
    snapshotId: string,
  ): Promise<Forecast> {
    let row
    try {
      ;[row] = await db
        .select()
        .from(forecastSnapshot)
        .where(
          and(
            eq(forecastSnapshot.snapshotId, snapshotId),
            gt(forecastSnapshot.createdAt, sql`now() - interval '24 hours'`),
          ),
        )
        .limit(1)
    } catch (cause) {
      throw { kind: 'DbError', cause } satisfies ForecastError
    }
    if (!row) throw { kind: 'SnapshotMissingError' } satisfies ForecastError
    return {
      ...(row.payload as Forecast),
      forecastIssuedAt: row.forecastIssuedAt,
      fetchedAt: row.fetchedAt,
    }
  }
  const failure = (error: unknown): ForecastError => error as ForecastError
  return {
    getForecast: (code) => ResultAsync.fromPromise(getForecast(code), failure),
    getForecastBySnapshotId: (id) =>
      ResultAsync.fromPromise(getForecastBySnapshotId(id), failure),
  }
}
