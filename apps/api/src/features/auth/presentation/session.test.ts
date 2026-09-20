import { expect, it } from 'vitest'
import { createOpenApiApp } from '../../../shared/openapi.ts'
import { sessionMiddleware } from './session.ts'
import type { AuthEnv } from './session.ts'

it('未認証の要求を 401 にする', async () => {
  const app = createOpenApiApp<AuthEnv>()
    .use('/private', sessionMiddleware({ getSession: async () => null }))
    .get('/private', (c) => c.json(c.get('user')))
  const response = await app.request('/private')
  expect(response.status).toBe(401)
  expect(await response.json()).toEqual({
    code: 'UNAUTHORIZED',
    message: 'ログインしてください',
  })
})

it('セッションのユーザーを c.get(user) から取得できる', async () => {
  const user = {
    id: '1',
    name: '晴れ',
    email: 'user@example.com',
    areaCode: '130000',
  }
  const app = createOpenApiApp<AuthEnv>()
    .use(
      '/private',
      sessionMiddleware({
        getSession: async ({ headers }) =>
          headers.get('cookie') === 'session=valid' ? { user } : null,
      }),
    )
    .get('/private', (c) => c.json(c.get('user')))
  const response = await app.request('/private', {
    headers: { cookie: 'session=valid' },
  })
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(user)
})
