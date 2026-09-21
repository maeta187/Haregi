import { isRedirect } from '@tanstack/react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchSession } from '../api/auth-api.ts'
import { getServerSession } from '../api/server-session.ts'
import { requireSession } from './require-session.ts'

vi.mock('../api/auth-api.ts', () => ({ fetchSession: vi.fn() }))
// ブラウザー(window あり)ではサーバー関数の経路を通らないことを固定するため、
// 呼ばれたら分かるようにモックしておく(SSR 側の検証は require-session.server.test.ts)
vi.mock('../api/server-session.ts', () => ({ getServerSession: vi.fn() }))

const fetchSessionMock = vi.mocked(fetchSession)
const getServerSessionMock = vi.mocked(getServerSession)

const user = {
  id: 'user-1',
  name: 'ハレギ太郎',
  email: 'user@example.com',
  areaCode: '130000',
}

describe('requireSession', () => {
  beforeEach(() => {
    fetchSessionMock.mockReset()
    getServerSessionMock.mockReset()
  })

  it('未認証なら /login へのリダイレクトを投げる', async () => {
    fetchSessionMock.mockResolvedValue(null)

    const error = await requireSession().catch((thrown: unknown) => thrown)

    expect(isRedirect(error)).toBe(true)
    expect((error as { options: { to: string } }).options.to).toBe('/login')
  })

  it('認証済みならセッションのユーザーを返す', async () => {
    fetchSessionMock.mockResolvedValue({ user } as never)

    await expect(requireSession()).resolves.toMatchObject({ id: 'user-1' })
    expect(getServerSessionMock).not.toHaveBeenCalled()
  })

  it('セッション取得が失敗した場合も /login へ送る(保護ルートを素通しさせない)', async () => {
    fetchSessionMock.mockRejectedValue(new Error('network down'))

    const error = await requireSession().catch((thrown: unknown) => thrown)

    expect(isRedirect(error)).toBe(true)
  })
})
