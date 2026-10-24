import { redirect } from '@tanstack/react-router'

import { fetchSession } from '../api/auth-api.ts'
import { getServerSession } from '../api/server-session.ts'

/**
 * 保護ルートの `beforeLoad` から呼ぶセッションガード(application 相当)。
 *
 * 通信障害時は fetchSession が取得済みの期限内セッションを使う。
 * 未認証、または維持できるセッションが無い場合は `/login` へ送る。
 */
export async function requireSession() {
  const session = await loadSession().catch(() => null)

  if (!session?.user) {
    throw redirect({ to: '/login' })
  }

  return session.user
}

/**
 * `beforeLoad` は直接アクセス・再読み込みではサーバーでも動く。
 * サーバーではブラウザー用のクライアント(相対 URL + Cookie 自動送信)が使えないため、
 * リクエストの Cookie を転送するサーバー関数に切り替える(`api/server-session.ts`)。
 */
async function loadSession() {
  if (typeof window === 'undefined') {
    return await getServerSession()
  }

  return await fetchSession()
}
