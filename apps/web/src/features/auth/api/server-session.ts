import { createServerFn } from '@tanstack/react-start'

/**
 * SSR(サーバーレンダリング)でのセッション検証。
 *
 * `beforeLoad` は直接アクセス・再読み込みではサーバーでも動くが、ブラウザー用の
 * `authClient.getSession()` はそこでは使えない:
 *
 * - 相対 URL(`/api/auth/get-session`)を解決できず `TypeError: Failed to parse URL` になる
 * - ブラウザーのように Cookie が自動で載らないため、絶対 URL にしただけでは常に未認証になる
 *
 * そのため api のオリジンを明示し、**そのリクエストが持っていた Cookie を転送**する。
 *
 * 実体(`server-session.impl.ts`)とサーバー専用 API は **handler の中で動的に import** する。
 * 静的 import にすると、クライアント側からも到達できるモジュールグラフに載ってしまう。
 */
export const getServerSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const [{ getRequestHeader }, { loadServerSession }] = await Promise.all([
      import('@tanstack/react-start/server'),
      import('./server-session.impl.ts'),
    ])

    return loadServerSession(getRequestHeader('cookie'))
  },
)
