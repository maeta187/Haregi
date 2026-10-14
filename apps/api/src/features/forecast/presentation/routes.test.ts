import { describe, expect, it, vi } from 'vitest'
import type { SessionReader } from '../../auth/domain/auth-user.ts'
import type { Forecast } from '../domain/forecast.ts'
import { createApp } from '../../../app.ts'
import { ForecastUnavailableError } from '../application/errors.ts'

const user = {
  id: 'user',
  name: '晴れ',
  email: 'test@example.com',
  areaCode: '130000',
}
const sessions: SessionReader = { getSession: async () => ({ user }) }
const forecast: Forecast = {
  snapshotId: 'snapshot',
  areaCode: '130000',
  tempStation: '44132',
  fetchedAt: new Date('2026-10-11T03:00:00Z'),
  forecastIssuedAt: new Date('2026-10-11T02:00:00Z'),
  status: 'fresh',
  days: [
    {
      date: '2026-10-11',
      maxTemperature: 27,
      minTemperature: null,
      weatherCode: '100',
    },
  ],
}
const setup = () => {
  const getForecast = vi.fn(async (_code: string) => forecast)
  return {
    getForecast,
    app: createApp({ sessions, forecastService: { getForecast } }),
  }
}

describe('GET /api/forecast', () => {
  it('省略時はセッションの登録地域を使い、絶対時刻を ISO 文字列で返す', async () => {
    const { app, getForecast } = setup()
    const response = await app.request('/api/forecast')
    expect(response.status).toBe(200)
    expect(getForecast).toHaveBeenCalledWith('130000')
    expect(await response.json()).toEqual(JSON.parse(JSON.stringify(forecast)))
  })
  it('地域切替をマスタで照合し、未知コード・空値は 400 にする', async () => {
    const { app, getForecast } = setup()
    expect((await app.request('/api/forecast?area=460040')).status).toBe(200)
    expect(getForecast).toHaveBeenCalledWith('460040')
    for (const area of ['unknown', '', '999999']) {
      const response = await app.request(`/api/forecast?area=${area}`)
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'VALIDATION' })
    }
    expect(getForecast).toHaveBeenCalledTimes(1)
  })
  it('未認証は 401 で取得しない', async () => {
    const getForecast = vi.fn(async () => forecast)
    const app = createApp({
      sessions: { getSession: async () => null },
      forecastService: { getForecast },
    })
    expect((await app.request('/api/forecast')).status).toBe(401)
    expect(getForecast).not.toHaveBeenCalled()
  })
  it('取得失敗を shared/http-errors 経由で 502 にする', async () => {
    const { app, getForecast } = setup()
    getForecast.mockRejectedValue(new ForecastUnavailableError('offline'))
    const response = await app.request('/api/forecast')
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
    })
  })
  it('OpenAPI にクエリと世代を含む応答を掲載する', async () => {
    const { app } = setup()
    const response = await app.request('/api/openapi.json')
    const doc = (await response.json()) as {
      paths: Record<
        string,
        {
          get: {
            parameters: unknown[]
            responses: Record<
              string,
              {
                content: {
                  'application/json': { schema: { required: string[] } }
                }
              }
            >
          }
        }
      >
    }
    expect(doc.paths['/api/forecast']!.get.parameters).toContainEqual(
      expect.objectContaining({ name: 'area', in: 'query', required: false }),
    )
    const responseSchema =
      doc.paths['/api/forecast']!.get.responses['200']!.content[
        'application/json'
      ].schema
    expect(responseSchema.required).toEqual(
      expect.arrayContaining([
        'snapshotId',
        'areaCode',
        'tempStation',
        'fetchedAt',
        'forecastIssuedAt',
        'status',
        'days',
      ]),
    )
    expect((await app.request('/api/doc')).status).toBe(200)
  })
})
