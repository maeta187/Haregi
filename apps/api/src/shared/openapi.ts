import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import type { Env } from 'hono'

import { toHttpError } from './http-errors.ts'
import { logger, requestLogger } from './logger.ts'

export function createOpenApiApp<E extends Env = Env>() {
  const app = new OpenAPIHono<E>()
  app.use('*', requestLogger())
  app.onError((error, c) => {
    const { status, body } = toHttpError(error)
    logger.error({ code: body.code, status }, 'リクエスト処理失敗')
    return c.json(body, status)
  })
  app.doc31('/api/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'Haregi API', version: '1.0.0' },
  })
  app.get('/api/doc', swaggerUI({ url: '/api/openapi.json' }))
  return app
}
