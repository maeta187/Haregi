import { expect, it } from 'vitest'
import { createOpenApiApp } from './openapi.ts'
import { ApplicationError } from './http-errors.ts'

it('認証なしで OpenAPI 定義と Swagger UI を取得できる', async () => {
  const app = createOpenApiApp()
  const schema = await app.request('/api/openapi.json')
  expect(schema.status).toBe(200)
  expect(await schema.json()).toMatchObject({
    openapi: '3.1.0',
    info: { title: 'Haregi API' },
  })
  const doc = await app.request('/api/doc')
  expect(doc.status).toBe(200)
  expect(await doc.text()).toContain('/api/openapi.json')
})

it('application の例外を JSON の HTTP エラーにする', async () => {
  const app = createOpenApiApp().get('/conflict', () => {
    throw new ApplicationError('CONFLICT', '競合しています')
  })
  const response = await app.request('/conflict')
  expect(response.status).toBe(409)
  expect(await response.json()).toEqual({
    code: 'CONFLICT',
    message: '競合しています',
  })
})
