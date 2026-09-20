import type { AuthUser, SessionReader } from '../domain/auth-user.ts'

export async function getCurrentUser(
  sessions: SessionReader,
  headers: Headers,
): Promise<AuthUser | null> {
  const session = await sessions.getSession({ headers })
  if (!session) return null
  const { id, name, email, areaCode } = session.user
  return { id, name, email, areaCode }
}
