import { createRoute, z } from '@hono/zod-openapi'
import { auth, authDatabase } from './features/auth/infrastructure/auth.ts'
import { authRoutes } from './features/auth/presentation/routes.ts'
import type { AuthEnv } from './features/auth/presentation/session.ts'
import {
  type ClientIpEnv,
  clientIp,
  parseTrustedProxies,
} from './shared/client-ip.ts'
import { createOpenApiApp } from './shared/openapi.ts'

import type { SessionReader } from './features/auth/domain/auth-user.ts'
import { createForecastRepository } from './features/forecast/infrastructure/repository.ts'
import {
  createForecastService,
  type ForecastService,
} from './features/forecast/application/service.ts'
import { forecastRoutes } from './features/forecast/presentation/routes.ts'

export type AppOptions = {
  sessions?: SessionReader
  forecastService?: Pick<ForecastService, 'getForecast'>
  provider?: Pick<typeof auth, 'handler'>
  /** 手前に立つリバースプロキシ / dev proxy の IP・CIDR(`TRUSTED_PROXY_IPS`)。 */
  trustedProxies?: readonly string[]
}

export const createApp = ({
  provider = auth,
  sessions = auth.api,
  forecastService = createForecastService(
    createForecastRepository(authDatabase.db),
  ),
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
    .route('/', forecastRoutes(sessions, forecastService))
}

export const app = createApp()

export type AppType = typeof app
