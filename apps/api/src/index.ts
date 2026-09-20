import { serve } from '@hono/node-server'

import { app } from './app.ts'
import { resolveApiPort } from './port.ts'
import { authDatabase } from './features/auth/infrastructure/auth.ts'
import { logger } from './shared/logger.ts'

const port = resolveApiPort(process.env['API_PORT'])

const server = serve({ fetch: app.fetch, port }, (info) => {
  logger.info({ port: info.port }, 'API サーバーを起動しました')
})

let stopping = false
const shutdown = () => {
  if (stopping) return
  stopping = true
  server.close(async (error) => {
    try {
      await authDatabase.pool.end()
    } catch {
      process.exitCode = 1
    }
    if (error) process.exitCode = 1
  })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
