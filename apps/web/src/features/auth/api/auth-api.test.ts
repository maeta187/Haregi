import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authClient } from '@/lib/auth-client.ts'
import { fetchSession, signOut } from './auth-api.ts'

vi.mock('@/lib/auth-client.ts', () => ({
  authClient: {
    getSession: vi.fn(),
    signOut: vi.fn(),
    signIn: { email: vi.fn() },
    signUp: { email: vi.fn() },
    $store: { atoms: { session: { get: vi.fn(), set: vi.fn() } } },
  },
}))

const session = {
  user: { id: 'user-1', areaCode: '130000' },
  session: { expiresAt: new Date(Date.now() + 60_000) },
}

beforeEach(async () => {
  vi.resetAllMocks()
  vi.mocked(authClient.$store.atoms.session!.get).mockReturnValue({
    data: session,
  } as never)
  vi.mocked(authClient.$store.atoms.session!.set).mockImplementation((next) => {
    vi.mocked(authClient.$store.atoms.session!.get).mockReturnValue(next)
  })
  vi.mocked(authClient.getSession).mockResolvedValue({
    data: session,
    error: null,
  } as never)
  await fetchSession()
  vi.mocked(authClient.getSession).mockReset()
})

afterEach(() => vi.restoreAllMocks())

describe('fetchSession(ブラウザー)', () => {
  it('ログアウト成功後は取得済みセッションを破棄し、503 でも復活させない', async () => {
    vi.mocked(authClient.signOut).mockResolvedValue({
      data: { success: true },
      error: null,
    } as never)
    await signOut()
    expect(authClient.$store.atoms.session!.get().data).toBeNull()
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: null,
      error: { status: 503 },
    } as never)
    await expect(fetchSession()).rejects.toThrow(
      'セッションを確認できませんでした',
    )
  })
  it.each([401, 403])(
    '%s は取得済みセッションがあっても未認証にする',
    async (status) => {
      vi.mocked(authClient.getSession).mockResolvedValue({
        data: null,
        error: { status },
      } as never)
      await expect(fetchSession()).resolves.toBeNull()
    },
  )

  it('正常応答の null は取得済みセッションがあっても維持しない', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: null,
      error: null,
    } as never)
    await expect(fetchSession()).resolves.toBeNull()
  })

  it.each(['なし', '期限切れ', '期限ちょうど'])(
    '通信障害でも取得済みセッションが %s なら維持しない',
    async (state) => {
      vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000)
      vi.mocked(authClient.$store.atoms.session!.get).mockReturnValue({
        data:
          state === 'なし'
            ? null
            : {
                ...session,
                session: {
                  expiresAt: new Date(
                    Date.now() - (state === '期限切れ' ? 1 : 0),
                  ),
                },
              },
      } as never)
      vi.mocked(authClient.getSession).mockRejectedValue(
        new TypeError('Failed to fetch'),
      )
      await expect(fetchSession()).rejects.toThrow('Failed to fetch')
    },
  )

  it('SSR ではブラウザーの取得済みセッションを使わない', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: null,
      error: { status: 503 },
    } as never)
    await expect(
      fetchSession({ apiOrigin: 'http://localhost:4000', cookie: undefined }),
    ).rejects.toThrow()
  })
  it('通信障害でも取得済みの期限内セッションを返す', async () => {
    vi.mocked(authClient.getSession).mockRejectedValue(
      new TypeError('Failed to fetch'),
    )
    await expect(fetchSession()).resolves.toEqual(session)
  })

  it.each([500, 502, 503])(
    '%s でも取得済みの期限内セッションを返す',
    async (status) => {
      vi.mocked(authClient.getSession).mockResolvedValue({
        data: null,
        error: { status },
      } as never)
      await expect(fetchSession()).resolves.toEqual(session)
    },
  )
})
