import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDb } from '@haregi/db'

const connectionString = 'postgresql://haregi:haregi@127.0.0.1:5432/haregi'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('DB クライアントの生成', () => {
  it('UTC のプロセスではクライアントを作る', () => {
    vi.stubEnv('TZ', 'UTC')

    const { pool } = createDb(connectionString)

    expect(pool).toBeDefined()
    void pool.end()
  })

  // 門番を呼び出し側の責務にすると、api・シード・保守スクリプトが1つ呼び忘れた
  // だけで迂回できる。DB へ触れる唯一の入口で必ず検査する
  it.each(['Asia/Tokyo', undefined])(
    'TZ が %s のプロセスにはクライアントを作らせない',
    (tz) => {
      if (tz === undefined) {
        vi.stubEnv('TZ', undefined)
      } else {
        vi.stubEnv('TZ', tz)
      }

      expect(() => createDb(connectionString)).toThrow(/TZ=UTC/)
    },
  )
})

describe('接続の設定', () => {
  // Node が UTC でも、DB セッションのタイムゾーンが違えば
  // `timestamp DEFAULT now()` が別の壁時計で書かれてズレる
  it('DB セッションのタイムゾーンも UTC に固定する', () => {
    vi.stubEnv('TZ', 'UTC')

    const { pool } = createDb(connectionString)

    expect(pool.options.options).toContain('timezone=UTC')
    void pool.end()
  })

  // 接続 URL の `options` は接続時のオプションより後勝ちになる。
  // `?options=-c timezone=Asia/Tokyo` を仕込まれると UTC 固定が黙って外れる
  it.each([
    'postgresql://u:p@127.0.0.1:5432/db?options=-c%20timezone%3DAsia%2FTokyo',
    'postgresql://u:p@127.0.0.1:5432/db?options=-c+statement_timeout%3D1000',
  ])('接続文字列で options を渡す経路を塞ぐ', (url) => {
    vi.stubEnv('TZ', 'UTC')

    expect(() => createDb(url)).toThrow(/options/)
  })

  it('options を含まない接続文字列は通す', () => {
    vi.stubEnv('TZ', 'UTC')

    const { pool } = createDb(`${connectionString}?application_name=haregi`)

    expect(pool.options.options).toContain('timezone=UTC')
    void pool.end()
  })
})
