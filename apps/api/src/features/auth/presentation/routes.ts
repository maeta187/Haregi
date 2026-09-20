import { OpenAPIHono } from '@hono/zod-openapi'
import type { auth } from '../infrastructure/auth.ts'
import type { AuthEnv } from './session.ts'

export const authRoutes = (provider: Pick<typeof auth, 'handler'>) =>
  new OpenAPIHono<AuthEnv>().all('/api/auth/*', (c) =>
    provider.handler(c.req.raw),
  )
