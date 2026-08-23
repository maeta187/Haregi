import { describe, expect, it } from 'vitest'

import { withUtcTimezone } from '@haregi/db'

const base = 'postgresql://haregi:haregi@127.0.0.1:5432/haregi'

const optionsOf = (connectionString: string) =>
  new URL(connectionString).searchParams.get('options')

describe('接続文字列のタイムゾーン正規化', () => {
  it('options が無ければ UTC 固定だけを足す', () => {
    expect(optionsOf(withUtcTimezone(base))).toBe('-c timezone=UTC')
  })

  it('タイムゾーン以外の options は残す', () => {
    const url = `${base}?options=${encodeURIComponent('-c statement_timeout=5000 -c lock_timeout=1000')}`

    expect(optionsOf(withUtcTimezone(url))).toBe(
      '-c statement_timeout=5000 -c lock_timeout=1000 -c timezone=UTC',
    )
  })

  // libpq の options は後勝ちなので、除去しそこねると UTC 固定が黙って外れる
  it.each([
    '-c timezone=Asia/Tokyo',
    '-c TimeZone=Asia/Tokyo',
    '-c statement_timeout=5000 -c timezone=Asia/Tokyo',
  ])('仕込まれたタイムゾーン指定 %s を取り除く', (options) => {
    const url = `${base}?options=${encodeURIComponent(options)}`
    const normalized = optionsOf(withUtcTimezone(url))

    expect(normalized).not.toMatch(/Tokyo/)
    expect(normalized?.endsWith('-c timezone=UTC')).toBe(true)
  })

  it('タイムゾーン以外の options を残したまま仕込みを取り除く', () => {
    const url = `${base}?options=${encodeURIComponent('-c timezone=Asia/Tokyo -c statement_timeout=5000')}`

    expect(optionsOf(withUtcTimezone(url))).toBe(
      '-c statement_timeout=5000 -c timezone=UTC',
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
