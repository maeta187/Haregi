import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import userEvent from '@testing-library/user-event'
import { fetchForecast } from '@/features/forecast/api/forecast-api.ts'
import { forecastFixture } from '@/features/forecast/testing/forecast.ts'

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

vi.mock('@/features/forecast/api/forecast-api.ts', () => ({
  fetchForecast: vi.fn(),
}))

vi.mock('@/lib/query-client.ts', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/lib/query-client.ts')>()
  return {
    createQueryClient: () => {
      const client = original.createQueryClient()
      client.setDefaultOptions({ queries: { retry: false } })
      return client
    },
  }
})

const fetchSessionMock = vi.mocked(fetchSession)

const renderAt = async (path: string) => {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  // QueryClientProvider は本番では __root の shellComponent が提供する
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  )

  return router
}

beforeEach(() => {
  fetchSessionMock.mockReset()
  vi.mocked(fetchForecast).mockReset().mockResolvedValue(forecastFixture)
})

describe('/forecast(保護ルート)', () => {
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
    expect(await screen.findByRole('table')).toBeVisible()
    expect(fetchForecast).toHaveBeenCalledWith('130000')
    expect(
      screen.getByRole('link', { name: '出典: 気象庁ホームページ' }),
    ).toBeVisible()
  })
})

const authenticate = () =>
  fetchSessionMock.mockResolvedValue({
    user: {
      id: 'user-1',
      name: 'ハレギ太郎',
      email: 'user@example.com',
      areaCode: '130000',
    },
  } as never)

it('地域選択でURLと予報が切り替わり、URLから再表示できる', async () => {
  authenticate()
  vi.mocked(fetchForecast).mockImplementation(async (area) => ({
    ...forecastFixture,
    areaCode: area!,
    snapshotId: `snapshot-${area}`,
    days: [
      {
        ...forecastFixture.days[1]!,
        maxTemperature: area === '460040' ? 30 : 25.5,
      },
    ],
  }))
  const router = await renderAt('/forecast')
  await screen.findByText('25.5℃')
  await userEvent.selectOptions(
    screen.getByRole('combobox', { name: '表示地域' }),
    '460040',
  )
  await waitFor(() =>
    expect(router.state.location.search).toEqual({ area: '460040' }),
  )
  expect(await screen.findByText('30℃')).toBeVisible()
  expect(screen.queryByText('25.5℃')).not.toBeInTheDocument()
})

it.each([
  '/forecast?area=460040',
  '/forecast?area=invalid',
  '/forecast?area=1300000',
  '/forecast?area=',
])('URL %s の地域を検証して取得する', async (path) => {
  authenticate()
  vi.mocked(fetchForecast).mockClear().mockResolvedValue(forecastFixture)
  await renderAt(path)
  await screen.findByRole('table')
  expect(fetchForecast).toHaveBeenCalledWith(
    path.includes('460040') ? '460040' : '130000',
  )
})

it('502でも出典と再試行を表示し、再試行で回復する', async () => {
  authenticate()
  vi.mocked(fetchForecast)
    .mockRejectedValueOnce(new Error('予報を取得できませんでした'))
    .mockResolvedValue(forecastFixture)
  await renderAt('/forecast')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '予報を取得できませんでした',
  )
  expect(
    screen.getByRole('link', { name: '出典: 気象庁ホームページ' }),
  ).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: '再試行' }))
  expect(await screen.findByRole('table')).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
