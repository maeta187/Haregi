import type { Db } from '@haregi/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthMiddleware } from 'better-auth/api'

import { CLIENT_IP_HEADER } from '../../../shared/client-ip.ts'
import {
  validateSignup,
  validateUpdateUser,
  validateChangePassword,
} from '../domain/validation.ts'

export type AuthConfig = { baseURL: string; secret: string; webOrigin: string }

const validationError = (issues: ReadonlyArray<{ message: string }>) =>
  new APIError('BAD_REQUEST', {
    code: 'VALIDATION_ERROR',
    message: issues.map((issue) => issue.message).join('、'),
  })

export function createAuth(db: Db, config: AuthConfig) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg' }),
    baseURL: config.baseURL,
    basePath: '/api/auth',
    secret: config.secret,
    trustedOrigins: [config.webOrigin],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 20,
    },
    user: {
      additionalFields: {
        areaCode: { type: 'string', required: true, input: true },
      },
    },
    // 入口(`shared/client-ip.ts`)が確定した IP だけを読む。
    // 既定の `x-forwarded-for` はクライアントの自己申告で、bucket を分けて
    // レート制限を迂回できるため信用しない。
    advanced: { ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] } },
    rateLimit: { enabled: true },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/change-password') {
          const result = validateChangePassword(ctx.body?.newPassword)
          if (!result.success) {
            throw validationError(result.error.issues)
          }
          return
        }
        if (ctx.path !== '/sign-up/email' && ctx.path !== '/update-user') return
        const result =
          ctx.path === '/sign-up/email'
            ? validateSignup(ctx.body)
            : validateUpdateUser(ctx.body)
        if (!result.success) {
          throw validationError(result.error.issues)
        }
        return { context: { ...ctx, body: { ...ctx.body, ...result.data } } }
      }),
    },
  })
}
