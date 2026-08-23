import { describe, expect, it } from 'vitest'

import { withUtcTimezone } from '@haregi/db'

const base = 'postgresql://haregi:haregi@127.0.0.1:5432/haregi'

describe('マイグレーション用の接続文字列', () => {
  it('DB セッションを UTC に固定する options を付ける', () => {
    expect(withUtcTimezone(base)).toContain('options=-c+timezone%3DUTC')
  })

  it('既存のクエリパラメータを残す', () => {
    expect(withUtcTimezone(`${base}?sslmode=require`)).toContain(
      'sslmode=require',
    )
  })

  it('接続文字列に仕込まれた options を上書きする', () => {
    const injected = `${base}?options=-c%20timezone%3DAsia%2FTokyo`

    expect(withUtcTimezone(injected)).not.toContain('Tokyo')
  })

  it('URL として解釈できない接続文字列を拒否する', () => {
    expect(() => withUtcTimezone('host=localhost dbname=haregi')).toThrow(
      /DATABASE_URL/,
    )
  })
})
