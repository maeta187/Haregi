import { once } from 'node:events'
import { serve } from '@hono/node-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../../app.ts'
import { createTestDatabase } from '../../../test/database.ts'
import { createAuth } from '../infrastructure/create-auth.ts'

// Better Auth の sign-in は 10 秒あたり 3 回まで(1.7.1 の既定ルール)
const LIMIT = 3

describe('実 HTTP 経路でのレート制限の bucket', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>
  let provider: ReturnType<typeof createAuth>

  beforeAll(async () => {
    database = await createTestDatabase()
    database.migrate()
    provider = createAuth(database.db, {
      baseURL: 'http://localhost:3000',
      secret: 'test-secret-with-at-least-32-characters',
      webOrigin: 'http://localhost:3000',
    })
  }, 30_000)
  afterAll(async () => {
    await database?.close()
  })

  async function withServer(
    trustedProxies: readonly string[],
    run: (signIn: (forwardedFor?: string) => Promise<number>) => Promise<void>,
    // 接続元のアドレスファミリを固定する(dns の解決順に左右されないため)
    host = '127.0.0.1',
  ) {
    const server = serve({
      fetch: createApp({ provider, trustedProxies }).fetch,
      port: 0,
      hostname: host,
    })
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('ポートを取得できませんでした')
    const origin = `http://${host.includes(':') ? `[${host}]` : host}:${address.port}`
    const signIn = async (forwardedFor?: string) =>
      (
        await fetch(`${origin}/api/auth/sign-in/email`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'http://localhost:3000',
            ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
          },
          body: JSON.stringify({
            email: 'nobody@example.com',
            password: 'password123',
          }),
        })
      ).status
    try {
      await run(signIn)
    } finally {
      server.close()
      await once(server, 'close')
    }
  }

  it('信頼できるプロキシがなければ、X-Forwarded-For を変えても制限を迂回できない', async () => {
    await withServer([], async (signIn) => {
      const statuses: number[] = []
      for (let attempt = 0; attempt < LIMIT + 2; attempt += 1)
        statuses.push(await signIn(`192.0.2.${100 + attempt}`))
      expect(statuses.slice(0, LIMIT).every((status) => status !== 429)).toBe(
        true,
      )
      expect(statuses.slice(LIMIT)).toEqual([429, 429])
    })
  }, 30_000)

  it('信頼できるプロキシ越しなら、クライアントごとに別の bucket になる', async () => {
    await withServer(['127.0.0.1'], async (signIn) => {
      const first: number[] = []
      for (let attempt = 0; attempt < LIMIT + 1; attempt += 1)
        first.push(await signIn('198.51.100.1'))
      expect(first.slice(0, LIMIT).every((status) => status !== 429)).toBe(true)
      expect(first.at(-1)).toBe(429)
      // 別クライアントは巻き添えにならない(全員共通 bucket ではない)
      expect(await signIn('198.51.100.2')).not.toBe(429)
    })
  }, 30_000)

  it('IPv6 ループバック(::1)経由でもクライアントごとに別の bucket になる', async () => {
    // 開発の転送先は http://localhost:4000 で、node:dns が localhost を ::1 に
    // 解決する環境では接続元が ::1 になる。IPv4 だけを信頼すると全員が
    // ::1 の共通 bucket へ潰れるため、.env.example は両方を信頼する
    await withServer(
      ['127.0.0.1', '::1'],
      async (signIn) => {
        const first: number[] = []
        for (let attempt = 0; attempt < LIMIT + 1; attempt += 1)
          first.push(await signIn('203.0.113.1'))
        expect(first.slice(0, LIMIT).every((status) => status !== 429)).toBe(
          true,
        )
        expect(first.at(-1)).toBe(429)
        expect(await signIn('203.0.113.2')).not.toBe(429)
      },
      '::1',
    )
  }, 30_000)
})
