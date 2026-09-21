import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchSession } from '@/features/auth/api/auth-api.ts'
import { routeTree } from '@/routeTree.gen'
import { createQueryClient } from '@/lib/query-client.ts'

vi.mock('@/features/auth/api/auth-api.ts', () => ({
  fetchSession: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  useSessionStore: () => ({ data: null, isPending: false }),
}))

const fetchSessionMock = vi.mocked(fetchSession)

const renderAt = async (path: string) => {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  // QueryClientProvider は本番では __root の shellComponent が提供する
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  )

  return router
}

describe('/forecast(保護ルート)', () => {
  beforeEach(() => {
    fetchSessionMock.mockReset()
  })

  it('未認証のときは /login へリダイレクトする', async () => {
    fetchSessionMock.mockResolvedValue(null)

    const router = await renderAt('/forecast')

    expect(router.state.location.pathname).toBe('/login')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'ログイン' }),
    ).toBeVisible()
  })

  it('認証済みならメイン画面を表示する', async () => {
    fetchSessionMock.mockResolvedValue({
      user: {
        id: 'user-1',
        name: 'ハレギ太郎',
        email: 'user@example.com',
        areaCode: '130000',
      },
    } as never)

    const router = await renderAt('/forecast')

    expect(router.state.location.pathname).toBe('/forecast')
  })
})
