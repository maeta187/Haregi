/**
 * Better Auth のエラーを画面に出す日本語メッセージへ変換する。
 *
 * サーバー側の入力検証(`hooks.before`。architecture.md §7)は日本語の
 * メッセージを返すため、それがある場合はそのまま表示する。
 */
export type AuthErrorLike = {
  code?: string | undefined
  status?: number | undefined
  message?: string | undefined
}

const MESSAGES_BY_CODE: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'メールアドレスまたはパスワードが正しくありません',
  USER_ALREADY_EXISTS: 'このメールアドレスは既に登録されています',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    'このメールアドレスは既に登録されています',
}

const FALLBACK = '通信に失敗しました。時間をおいてもう一度お試しください'

export function toAuthErrorMessage(error: AuthErrorLike): string {
  const byCode = error.code ? MESSAGES_BY_CODE[error.code] : undefined
  if (byCode) {
    return byCode
  }

  if (error.status === 429) {
    return '試行回数が多すぎます。しばらく待ってからもう一度お試しください'
  }

  return error.message ?? FALLBACK
}
