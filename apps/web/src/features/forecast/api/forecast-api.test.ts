import { expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client.ts'
import { fetchForecast } from './forecast-api.ts'

vi.mock('@/lib/api-client.ts', () => ({
  apiClient: { api: { forecast: { $get: vi.fn() } } },
}))

it('200の予報を返し、指定地域をクエリで渡す', async () => {
  const forecast = { snapshotId: 'snapshot-1', areaCode: '130000', days: [] }
  vi.mocked(apiClient.api.forecast.$get).mockResolvedValue(
    new Response(JSON.stringify(forecast)) as never,
  )
  expect(await fetchForecast('130000')).toEqual(forecast)
  expect(apiClient.api.forecast.$get).toHaveBeenCalledWith({
    query: { area: '130000' },
  })
})

it.each([502, 400, 401])(
  '%sをcode/message/status付きエラーに変換する',
  async (status) => {
    const body = {
      code: 'FORECAST_UNAVAILABLE',
      message: '予報を取得できませんでした',
    }
    vi.mocked(apiClient.api.forecast.$get).mockResolvedValue(
      new Response(JSON.stringify(body), { status }) as never,
    )
    await expect(fetchForecast()).rejects.toMatchObject({
      ...body,
      status,
      name: 'ForecastApiError',
    })
  },
)

it('地域省略時はクエリを付けない', async () => {
  vi.mocked(apiClient.api.forecast.$get).mockResolvedValue(
    new Response('{}') as never,
  )
  await fetchForecast()
  expect(apiClient.api.forecast.$get).toHaveBeenLastCalledWith({ query: {} })
})

it('プロキシが空の非ok応答を返してもHTTP statusを保持する', async () => {
  vi.mocked(apiClient.api.forecast.$get).mockResolvedValue(
    new Response('', { status: 500 }) as never,
  )
  await expect(fetchForecast('130000')).rejects.toMatchObject({
    name: 'ForecastApiError',
    status: 500,
    code: 'FORECAST_UNAVAILABLE',
    message: '予報を取得できませんでした',
  })
})
