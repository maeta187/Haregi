import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const scripts = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).scripts as Record<string, string>

it.each(['dev', 'start', 'db:seed', 'test'])(
  '%s の実行プロセスに TZ=UTC を注入する',
  (name) => {
    expect(scripts[name]).toBeDefined()
    const output = execFileSync('/bin/sh', ['-c', scripts[name]!], {
      env: {
        ...process.env,
        TZ: 'Asia/Tokyo',
        NODE_OPTIONS: `--import=${new URL('./test/fixtures/timezone-probe.mjs', import.meta.url).href}`,
      },
      encoding: 'utf8',
      timeout: 10_000,
    })
    expect(JSON.parse(output)).toEqual({ timezone: 'UTC' })
  },
)

it.each(['Asia/Tokyo', undefined])(
  'TZ=%s の API プロセスは DB クライアント生成前に起動を拒否する',
  (timezone) => {
    const env = { ...process.env }
    if (timezone === undefined) delete env.TZ
    else env.TZ = timezone
    expect(() =>
      execFileSync(process.execPath, ['src/index.ts'], {
        env,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 10_000,
      }),
    ).toThrow(/TZ=UTC/)
  },
)
