import { createRoute, z } from '@hono/zod-openapi'
import { auth } from './features/auth/infrastructure/auth.ts'
import { authRoutes } from './features/auth/presentation/routes.ts'
import type { AuthEnv } from './features/auth/presentation/session.ts'
import { createOpenApiApp } from './shared/openapi.ts'

export const createApp = (provider: Pick<typeof auth, 'handler'> = auth) =>
  createOpenApiApp<AuthEnv>()
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

export const app = createApp()

export type AppType = typeof app
