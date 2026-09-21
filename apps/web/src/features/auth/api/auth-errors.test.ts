import { describe, expect, it } from 'vitest'

import { toAuthErrorMessage } from './auth-errors.ts'

describe('toAuthErrorMessage', () => {
  it('認証失敗を日本語で案内する', () => {
    expect(toAuthErrorMessage({ code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe(
      'メールアドレスまたはパスワードが正しくありません',
    )
  })

  it('メールアドレスの重複を日本語で案内する', () => {
    expect(toAuthErrorMessage({ code: 'USER_ALREADY_EXISTS' })).toBe(
      'このメールアドレスは既に登録されています',
    )
  })

  it('レート制限(429)を日本語で案内する', () => {
    expect(toAuthErrorMessage({ status: 429 })).toBe(
      '試行回数が多すぎます。しばらく待ってからもう一度お試しください',
    )
  })

  it('サーバーが返した日本語メッセージ(hooks.before の検証)をそのまま出す', () => {
    expect(
      toAuthErrorMessage({
        message: 'ユーザー名は20文字以内で入力してください',
      }),
    ).toBe('ユーザー名は20文字以内で入力してください')
  })

  it('未知のエラーには汎用の案内を出す', () => {
    expect(toAuthErrorMessage({})).toBe(
      '通信に失敗しました。時間をおいてもう一度お試しください',
    )
  })
})
