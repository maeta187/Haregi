import { describe, expect, it } from 'vitest'

import { app } from './app.ts'

describe('GET /api/health', () => {
  it('200 と {status: "ok"} を返す', async () => {
    const res = await app.request('/api/health')

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ status: 'ok' })
  })

  it('Better Auth のセッション経路を公開し、ロギングを全ルートに適用する', async () => {
    for (const path of [
      '/api/health',
      '/api/doc',
      '/api/openapi.json',
      '/api/auth/get-session',
    ]) {
      const response = await app.request(path)
      expect(response.status).toBe(200)
      expect(response.headers.get('x-request-id')).toBeTruthy()
      if (path === '/api/auth/get-session')
        expect(await response.json()).toBeNull()
      if (path === '/api/openapi.json')
        expect(await response.json()).toHaveProperty('paths./api/health.get')
    }
  })
})
