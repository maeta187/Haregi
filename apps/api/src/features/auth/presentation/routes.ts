import { OpenAPIHono } from '@hono/zod-openapi'
import type { auth } from '../infrastructure/auth.ts'
import type { AuthEnv } from './session.ts'
import { type ClientIpEnv, withClientIp } from '../../../shared/client-ip.ts'

export const authRoutes = (provider: Pick<typeof auth, 'handler'>) =>
  new OpenAPIHono<AuthEnv & ClientIpEnv>().all('/api/auth/*', (c) =>
    provider.handler(withClientIp(c.req.raw, c.get('clientIp'))),
  )
