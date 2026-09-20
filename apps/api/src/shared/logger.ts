import { createMiddleware } from 'hono/factory'
import { pino } from 'pino'
import type { DestinationStream, Logger } from 'pino'

export function createLogger(
  level = process.env['LOG_LEVEL'] ?? 'info',
  destination?: DestinationStream,
) {
  return destination ? pino({ level }, destination) : pino({ level })
}

export const logger = createLogger()

export const requestLogger = (log: Logger = logger) =>
  createMiddleware(async (c, next) => {
    const requestId = crypto.randomUUID()
    const start = performance.now()
    await next()
    c.header('x-request-id', requestId)
    log.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        duration: performance.now() - start,
        requestId,
      },
      'リクエスト完了',
    )
  })
