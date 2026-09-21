// サーバー関数の中身を検証するため node 環境で実行する
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchSession } from './auth-api.ts'
import { loadServerSession } from './server-session.impl.ts'

vi.mock('./auth-api.ts', () => ({ fetchSession: vi.fn() }))

const fetchSessionMock = vi.mocked(fetchSession)

describe('loadServerSession', () => {
  beforeEach(() => {
    fetchSessionMock.mockReset()
    fetchSessionMock.mockResolvedValue(null as never)
  })

  it('リクエストの Cookie を api のオリジンへ転送する', async () => {
    await loadServerSession('better-auth.session_token=abc', {})

    expect(fetchSessionMock).toHaveBeenCalledWith({
      apiOrigin: 'http://localhost:4000',
      cookie: 'better-auth.session_token=abc',
    })
  })

  it('転送先は Vite dev proxy と同じ環境変数から解決する(両者がずれない)', async () => {
    await loadServerSession(undefined, { API_PORT: '4100' })

    expect(fetchSessionMock).toHaveBeenCalledWith({
      apiOrigin: 'http://localhost:4100',
      cookie: undefined,
    })
  })
})
