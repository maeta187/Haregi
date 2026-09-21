// SSR(window の無い環境)での分岐を検証する
// @vitest-environment node
import { isRedirect } from '@tanstack/react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchSession } from '../api/auth-api.ts'
import { getServerSession } from '../api/server-session.ts'
import { requireSession } from './require-session.ts'

vi.mock('../api/auth-api.ts', () => ({ fetchSession: vi.fn() }))
vi.mock('../api/server-session.ts', () => ({ getServerSession: vi.fn() }))

const fetchSessionMock = vi.mocked(fetchSession)
const getServerSessionMock = vi.mocked(getServerSession)

const user = {
  id: 'user-1',
  name: 'ハレギ太郎',
  email: 'user@example.com',
  areaCode: '130000',
}

describe('requireSession(SSR)', () => {
  beforeEach(() => {
    fetchSessionMock.mockReset()
    getServerSessionMock.mockReset()
  })

  it('認証済みの直接アクセス・再読み込みでは Cookie 付きのサーバー検証を使い、/login へ送らない', async () => {
    getServerSessionMock.mockResolvedValue({ user } as never)

    await expect(requireSession()).resolves.toMatchObject({ id: 'user-1' })
    // ブラウザー用クライアント(相対 URL・Cookie 自動送信頼み)はサーバーでは呼ばない
    expect(fetchSessionMock).not.toHaveBeenCalled()
  })

  it('未認証の直接アクセスは /login へ送る', async () => {
    getServerSessionMock.mockResolvedValue(null as never)

    const error = await requireSession().catch((thrown: unknown) => thrown)

    expect(isRedirect(error)).toBe(true)
    expect((error as { options: { to: string } }).options.to).toBe('/login')
  })

  it('サーバー検証が失敗した場合も /login へ送る(保護ルートを素通しさせない)', async () => {
    getServerSessionMock.mockRejectedValue(new Error('api down'))

    const error = await requireSession().catch((thrown: unknown) => thrown)

    expect(isRedirect(error)).toBe(true)
  })
})
