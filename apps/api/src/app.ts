import { createRoute, z } from '@hono/zod-openapi'
import { auth } from './features/auth/infrastructure/auth.ts'
import { authRoutes } from './features/auth/presentation/routes.ts'
import type { AuthEnv } from './features/auth/presentation/session.ts'
import {
  type ClientIpEnv,
  clientIp,
  parseTrustedProxies,
} from './shared/client-ip.ts'
import { createOpenApiApp } from './shared/openapi.ts'

export type AppOptions = {
  provider?: Pick<typeof auth, 'handler'>
  /** 手前に立つリバースプロキシ / dev proxy の IP・CIDR(`TRUSTED_PROXY_IPS`)。 */
  trustedProxies?: readonly string[]
}

export const createApp = ({
  provider = auth,
  trustedProxies = parseTrustedProxies(process.env['TRUSTED_PROXY_IPS']),
}: AppOptions = {}) => {
  const app = createOpenApiApp<AuthEnv & ClientIpEnv>()
  // 委譲より前にクライアント IP の信頼境界を確定させる
  app.use('*', clientIp(trustedProxies))
  return app
    .openapi(
      createRoute({
        method: 'get',
        path: '/api/health',
        responses: {
          200: {
            description: '稼働確認',
            content: {
              'application/json': {
                schema: z.object({ status: z.literal('ok') }),
              },
            },
          },
        },
      }),
      (c) => c.json({ status: 'ok' as const }, 200),
    )
    .route('/', authRoutes(provider))
}

export const app = createApp()

export type AppType = typeof app
