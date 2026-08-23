import { describe, expect, it } from 'vitest'

import { withUtcTimezone } from '@haregi/db'

const base = 'postgresql://haregi:haregi@127.0.0.1:5432/haregi'

const optionsOf = (connectionString: string) =>
  new URL(connectionString).searchParams.get('options')

describe('接続文字列のタイムゾーン固定', () => {
  it('options が無ければ UTC 固定だけを足す', () => {
    expect(optionsOf(withUtcTimezone(base))).toBe('-c timezone=UTC')
  })

  // libpq の options は後勝ちで、末尾の指定が必ず効く(実 DB で確認済み)。
  // 既存の指定を「消す」実装にすると、値の中に紛れた文字列まで壊しうる
  it.each([
    '-c statement_timeout=5000',
    '-c timezone=Asia/Tokyo',
    '-ctimezone=Asia/Tokyo',
    '--timezone=Asia/Tokyo',
    '--TimeZone=Asia/Tokyo',
    '-c application_name=worker-ctimezone=foo',
    '-c statement_timeout=5000 -c timezone=Asia/Tokyo',
  ])('%s の後ろに UTC 固定を置く', (options) => {
    const normalized = optionsOf(
      withUtcTimezone(`${base}?options=${encodeURIComponent(options)}`),
    )

    expect(normalized).toBe(`${options} -c timezone=UTC`)
  })

  // node-postgres は重複したパラメータの**最後**を採用する。最初を拾うと、
  // 実際に効いていた設定を捨てて別の接続設定に変えてしまう
  it('options が重複していたら最後の指定を土台にする', () => {
    const url =
      `${base}?options=${encodeURIComponent('-c statement_timeout=5000')}` +
      `&options=${encodeURIComponent('-c lock_timeout=1000')}`

    expect(optionsOf(withUtcTimezone(url))).toBe(
      '-c lock_timeout=1000 -c timezone=UTC',
    )
  })

  it('他のクエリパラメータを残す', () => {
    expect(withUtcTimezone(`${base}?sslmode=require`)).toContain(
      'sslmode=require',
    )
  })

  it('URL として解釈できない接続文字列を拒否する', () => {
    expect(() => withUtcTimezone('host=localhost dbname=haregi')).toThrow(
      /DATABASE_URL/,
    )
  })
})
