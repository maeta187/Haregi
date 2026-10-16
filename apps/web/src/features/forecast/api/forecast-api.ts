import type { InferResponseType } from 'hono/client'
import { apiClient } from '@/lib/api-client.ts'

export type Forecast = InferResponseType<
  typeof apiClient.api.forecast.$get,
  200
>

export class ForecastApiError extends Error {
  override readonly name = 'ForecastApiError'
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function fetchForecast(area?: string): Promise<Forecast> {
  const response = await apiClient.api.forecast.$get({
    query: area === undefined ? {} : { area },
  })
  if (!response.ok) {
    // 開発プロキシ等がJSON以外の障害応答を返しても、HTTP statusを失わない。
    const body: unknown = await response.json().catch(() => null)
    const code =
      body &&
      typeof body === 'object' &&
      'code' in body &&
      typeof body.code === 'string'
        ? body.code
        : 'FORECAST_UNAVAILABLE'
    const message =
      body &&
      typeof body === 'object' &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : '予報を取得できませんでした'
    throw new ForecastApiError(response.status, code, message)
  }
  return (await response.json()) as Forecast
}
