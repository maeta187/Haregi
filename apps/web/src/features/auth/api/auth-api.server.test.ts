// SSR 経路の検証。jsdom(window あり)では相対 URL が解決できてしまい、
// サーバーで起きる失敗を再現できないため node 環境で実行する
// @vitest-environment node
import { createServer, type Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { fetchSession } from './auth-api.ts'

const SESSION_COOKIE = 'better-auth.session_token=valid-token'

const sessionUser = {
  id: 'user-1',
  name: 'ハレギ太郎',
  email: 'user@example.com',
  areaCode: '130000',
}

let server: Server
let apiOrigin: string
const requests: Array<{ url: string | undefined; cookie: string | undefined }> =
  []

/** api の `/api/auth/get-session` を模したスタブ(Cookie が無ければ未認証)。 */
beforeAll(async () => {
  server = createServer((req, res) => {
    requests.push({ url: req.url, cookie: req.headers.cookie })
    res.setHeader('content-type', 'application/json')
    res.end(
      req.headers.cookie?.includes(SESSION_COOKIE)
        ? JSON.stringify({ session: { id: 'session-1' }, user: sessionUser })
        : 'null',
    )
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('スタブサーバーのポートを取得できませんでした')
  }
  apiOrigin = `http://127.0.0.1:${address.port}`
})

afterAll(() => {
  server.close()
})

describe('fetchSession(SSR)', () => {
  it('ブラウザー用の呼び方はサーバーでは相対 URL を解決できない(SSR で文脈が必須である理由)', async () => {
    await expect(fetchSession()).rejects.toThrow(/Failed to parse URL/)
  })

  it('api の絶対 URL とリクエストの Cookie を伴ってセッションを検証する', async () => {
    requests.length = 0

    const session = await fetchSession({ apiOrigin, cookie: SESSION_COOKIE })

    expect(session?.user).toMatchObject({ id: 'user-1' })
    expect(requests).toEqual([
      { url: '/api/auth/get-session', cookie: SESSION_COOKIE },
    ])
  })

  it('Cookie が無ければ未認証(null)を返す', async () => {
    await expect(
      fetchSession({ apiOrigin, cookie: undefined }),
    ).resolves.toBeNull()
  })
})
