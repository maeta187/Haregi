import { createMiddleware } from 'hono/factory'
import { getCurrentUser } from '../application/get-current-user.ts'
import type { AuthUser, SessionReader } from '../domain/auth-user.ts'
import { ApplicationError } from '../../../shared/http-errors.ts'

export type AuthEnv = { Variables: { user: AuthUser } }

export const sessionMiddleware = (sessions: SessionReader) =>
  createMiddleware<AuthEnv>(async (c, next) => {
    const user = await getCurrentUser(sessions, c.req.raw.headers)
    if (!user)
      throw new ApplicationError('UNAUTHORIZED', 'ログインしてください')
    c.set('user', user)
    await next()
  })
