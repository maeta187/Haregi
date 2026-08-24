import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

// 関数の単体テスト(timezone.test.ts)だけでは、設定ファイルからの呼び出しを消しても
// スクリプトの TZ 注入を壊してもテストが通ってしまう。実行経路そのものを固定する
describe('drizzle-kit の実行経路', () => {
  const scripts = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ).scripts as Record<string, string>

  it.each(['db:generate', 'db:migrate'])('%s を UTC で起動する', (name) => {
    expect(scripts[name]).toMatch(/^TZ=UTC /)
  })

  it('UTC でないタイムゾーンでは drizzle-kit を走らせない', () => {
    const run = () =>
      execFileSync('./node_modules/.bin/drizzle-kit', ['generate'], {
        env: { ...process.env, TZ: 'Asia/Tokyo' },
        encoding: 'utf8',
        stdio: 'pipe',
      })

    // 設定ファイルの評価時点で落ちるため、マイグレーションは生成されない
    expect(run).toThrow(/TZ=UTC/)
  }, 30_000)
})
