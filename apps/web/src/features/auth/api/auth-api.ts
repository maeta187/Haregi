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

// ブラウザーの取得順と認証変更を区別する。SSR の処理には使わない。
let browserSessionRevision = 0
// 値本体は Better Auth に置き、明示的に確認したセッションの識別子だけを保持する。
let trustedBrowserSession:
  | { sessionId: string; userId: string }
  | null
  | undefined

function sameSession(
  left: typeof authClient.$Infer.Session | null | undefined,
  right: typeof authClient.$Infer.Session | null | undefined,
) {
  return (
    left?.session.id === right?.session.id && left?.user.id === right?.user.id
  )
}

function clearBrowserSession() {
  if (typeof window === 'undefined') return
  browserSessionRevision++
  trustedBrowserSession = null
  const store = authClient.$store.atoms.session
  if (store)
    store.set({ ...store.get(), data: null, error: null, isPending: false })
}

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
  const result = unwrap(await authClient.signUp.email(values))
  clearBrowserSession()
  return result
}

export async function signIn(values: LoginValues) {
  const result = unwrap(await authClient.signIn.email(values))
  clearBrowserSession()
  return result
}

export async function signOut() {
  const result = unwrap(await authClient.signOut())
  clearBrowserSession()
  return result
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
  // SSR はリクエストの Cookie だけで検証し、プロセス共通のストアを参照しない。
  const store =
    context || typeof window === 'undefined'
      ? undefined
      : authClient.$store.atoms.session
  const revision = store ? ++browserSessionRevision : 0
  const initialData = store?.get().data
  // SDK の取得が先に成功しただけなら、同じセッションを示す最新の成功応答は有効。
  // 同一セッションの期限更新は変更とみなさず、ガードの最新の null / 401 を受け入れる。
  // 認証変更や後発リクエストで世代が変わった結果は常に無効とする。
  const superseded = (data?: typeof authClient.$Infer.Session | null) => {
    const current = store?.get().data
    const matchesCurrent = data && sameSession(data, current)
    return (
      store &&
      (revision !== browserSessionRevision ||
        (!sameSession(initialData, current) && !matchesCurrent))
    )
  }
  const recoverSession = () => {
    const cached = store?.get().data
    const trusted =
      trustedBrowserSession === undefined ||
      (trustedBrowserSession !== null &&
        trustedBrowserSession.sessionId === cached?.session.id &&
        trustedBrowserSession.userId === cached?.user.id)
    return trusted && cached && cached.session.expiresAt.getTime() > Date.now()
      ? cached
      : null
  }

  let result: Awaited<ReturnType<typeof authClient.getSession>>
  try {
    result = await authClient.getSession(
      context
        ? {
            fetchOptions: {
              baseURL: `${context.apiOrigin}/api/auth`,
              headers: context.cookie ? { cookie: context.cookie } : {},
            },
          }
        : undefined,
    )
  } catch (error) {
    if (superseded()) return recoverSession()
    const cached = recoverSession()
    if (cached) return cached
    throw error
  }

  if (superseded(result.error ? null : result.data)) return recoverSession()

  if (result.error && result.error.status >= 500) {
    const cached = recoverSession()
    if (cached) return cached
    throw new AuthRequestError('セッションを確認できませんでした')
  }

  // 正常な null / 401 を受けた後、障害時に古いセッションを復活させない。
  const data = result.error ? null : result.data
  if (store) {
    trustedBrowserSession = data
      ? { sessionId: data.session.id, userId: data.user.id }
      : null
    store.set({ ...store.get(), data, error: result.error, isPending: false })
  }
  return data
}

/**
 * Better Auth クライアントが保持するセッション。
 * セッションはサーバー状態(TanStack Query)ではなく Better Auth client が持つ
 * 方針のため(決定事項 #28)、ストアをそのまま公開する。
 */
export const useSessionStore = authClient.useSession
