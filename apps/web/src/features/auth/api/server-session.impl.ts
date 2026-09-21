import { resolveApiOrigin } from '../../../../api-origin.ts'
import { fetchSession, type ServerSessionContext } from './auth-api.ts'

/**
 * SSR(サーバーレンダリング)でのセッション検証の実体。
 *
 * このモジュールは **サーバー関数の handler からのみ動的に import する**
 * (`server-session.ts`)。静的に import すると、クライアント側からも到達可能な
 * モジュールグラフに載ってしまうため。
 */
export type ServerSessionEnv = {
  API_ORIGIN?: string | undefined
  API_PORT?: string | undefined
}

export async function loadServerSession(
  cookie: string | undefined,
  env: ServerSessionEnv = process.env,
) {
  const context: ServerSessionContext = {
    // Vite dev proxy の転送先と同じ解決規則を使い、両者がずれないようにする
    apiOrigin: resolveApiOrigin(env),
    cookie,
  }

  return fetchSession(context)
}
