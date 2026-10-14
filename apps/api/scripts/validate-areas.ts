// master-data/validate-areas.mjs の継続検証部分を移植。
// 確定済みマスタを入力にして対応を検証する。自動再生成・先頭区域への差し替えは行わない。
// リリース前と月次に pnpm --filter @haregi/api validate:areas で実行する。
import { pathToFileURL } from 'node:url'
import { areas, type Area, resolveForecastCode } from '@haregi/schema'
import { normalizeForecast } from '../src/features/forecast/domain/normalize.ts'

type Validation = {
  code: string
  name: string
  forecastCode: string
  ok: boolean
  error?: string
}

export async function validateAreas(
  master: readonly Area[] = areas,
  {
    fetcher = fetch,
    sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms)),
  }: { fetcher?: typeof fetch; sleep?: (ms: number) => Promise<void> } = {},
): Promise<Validation[]> {
  const cache = new Map<string, unknown>()
  const results: Validation[] = []
  for (const area of master) {
    const forecastCode = resolveForecastCode(area.code)!
    const result: Validation = {
      code: area.code,
      name: area.name,
      forecastCode,
      ok: true,
    }
    try {
      if (!cache.has(forecastCode)) {
        const response = await fetcher(
          `https://www.jma.go.jp/bosai/forecast/data/forecast/${forecastCode}.json`,
          { signal: AbortSignal.timeout(10_000) },
        )
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        cache.set(forecastCode, await response.json())
        await sleep(300)
      }
      normalizeForecast(cache.get(forecastCode), area)
    } catch (error) {
      result.ok = false
      result.error = error instanceof Error ? error.message : String(error)
    }
    results.push(result)
  }
  return results
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const results = await validateAreas()
  for (const result of results)
    console.log(
      `${result.ok ? 'OK' : 'NG'} ${result.code} ${result.name} (取得: ${result.forecastCode})${result.error ? `: ${result.error}` : ''}`,
    )
  const failed = results.filter((result) => !result.ok).length
  console.log(
    `検証 ${results.length} 件 / 成功 ${results.length - failed} 件 / 失敗 ${failed} 件`,
  )
  if (failed) process.exitCode = 1
}
