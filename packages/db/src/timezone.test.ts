import { describe, expect, it } from 'vitest'

import { assertUtcTimezone } from '@haregi/db'

describe('タイムゾーンの検証', () => {
  it('UTC のプロセスを通す', () => {
    expect(() => assertUtcTimezone('UTC')).not.toThrow()
  })

  it.each(['Asia/Tokyo', 'utc', 'Etc/UTC', ''])(
    'UTC でない %s のプロセスを拒否する',
    (tz) => {
      expect(() => assertUtcTimezone(tz)).toThrow(/TZ=UTC/)
    },
  )

  it('タイムゾーンが未設定のプロセスを拒否する', () => {
    // 未設定を「たぶん UTC だろう」と通すと、実行環境のローカル時刻で
    // 認証テーブルの期限カラム(タイムゾーンなし)が書かれてしまう
    expect(() => assertUtcTimezone(undefined)).toThrow(/TZ=UTC/)
  })

  it('拒否のメッセージに実際の値と対処を含める', () => {
    expect(() => assertUtcTimezone('Asia/Tokyo')).toThrow(/Asia\/Tokyo/)
  })
})
