import type { loginSchema, signupSchema } from '@haregi/schema'
import type { z } from 'zod'

import { type AuthErrorLike, toAuthErrorMessage } from './auth-errors.ts'
import { authClient } from '@/lib/auth-client'

/**
 * 認証の外部 I/O(infrastructure 相当)。`authClient` の呼び出しはここに閉じる
 * (ui-web.md「ディレクトリ構成・依存方向」)。
 *
 * Better Auth のクライアントは `{ data, error }` を返すため、失敗は
 * 日本語メッセージを持つ例外に変換して hooks 側の分岐を単純にする。
 */
export class AuthRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthRequestError'
  }
}

type SignupValues = z.infer<typeof signupSchema>
type LoginValues = z.infer<typeof loginSchema>

const unwrap = <T>(result: {
  data: T
  error?: AuthErrorLike | null
}): NonNullable<T> => {
  if (result.error) {
    throw new AuthRequestError(toAuthErrorMessage(result.error))
  }

  return result.data as NonNullable<T>
}

export async function signUp(values: SignupValues) {
  return unwrap(await authClient.signUp.email(values))
}

export async function signIn(values: LoginValues) {
  return unwrap(await authClient.signIn.email(values))
}

export async function signOut() {
  return unwrap(await authClient.signOut())
}

/**
 * SSR でセッションを検証するための文脈。
 *
 * ブラウザーと違い、サーバーには「現在のオリジン」も「自動で載る Cookie」も無い。
 * 相対 URL のままだと `Failed to parse URL from /api/auth/get-session` で失敗し、
 * Cookie を転送しなければ常に未認証として扱われてしまうため、両方を明示的に渡す。
 */
export type ServerSessionContext = {
  /** api のオリジン(例: `http://localhost:4000`)。 */
  apiOrigin: string
  /** SSR 中のリクエストが持っていた Cookie ヘッダー(無ければ未認証)。 */
  cookie: string | undefined
}

/**
 * 未認証の場合は null を返す(例外にしない)。
 *
 * 引数なし(ブラウザー)では同一オリジンの `/api/auth` へ Cookie 付きで送られる。
 * SSR では呼び出し側が `ServerSessionContext` を渡す。
 */
export async function fetchSession(context?: ServerSessionContext) {
  if (!context) {
    const { data } = await authClient.getSession()
    return data
  }

  const { data } = await authClient.getSession({
    fetchOptions: {
      // Better Auth のクライアントは `{origin}/api/auth` を基準にするため、同じ形に揃える
      baseURL: `${context.apiOrigin}/api/auth`,
      headers: context.cookie ? { cookie: context.cookie } : {},
    },
  })

  return data
}

/**
 * Better Auth クライアントが保持するセッション。
 * セッションはサーバー状態(TanStack Query)ではなく Better Auth client が持つ
 * 方針のため(決定事項 #28)、ストアをそのまま公開する。
 */
export const useSessionStore = authClient.useSession
