import { shiftJstDay, todayJst } from '@haregi/schema'
import { toast } from 'sonner'
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
import { forecastFixture as baseForecastFixture } from '@/features/forecast/testing/forecast.ts'

import {
  CoordinateConflictError,
  fetchCoordinates,
  saveCoordinates,
} from '@/features/coordinate/api/coordinate-api.ts'
import { authClient } from '@/lib/auth-client.ts'
import { routeTree } from '@/routeTree.gen'
import { createQueryClient } from '@/lib/query-client.ts'

vi.mock('@/lib/auth-client.ts', () => {
  let state = { data: null, error: null, isPending: false }
  return {
    authClient: {
      getSession: vi.fn(),
      useSession: () => state,
      $store: {
        atoms: {
          session: {
            get: () => state,
            set: (next: typeof state) => {
              state = next
            },
          },
        },
      },
    },
  }
})

vi.mock('@/features/forecast/api/forecast-api.ts', () => ({
  fetchForecast: vi.fn(),
}))

vi.mock(
  '@/features/coordinate/api/coordinate-api.ts',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('@/features/coordinate/api/coordinate-api.ts')
    >()),
    fetchCoordinates: vi.fn(),
    saveCoordinates: vi.fn(),
  }),
)

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

const forecastFixture = {
  ...baseForecastFixture,
  days: baseForecastFixture.days.map((day, index) => ({
    ...day,
    date: shiftJstDay(todayJst(), index),
  })),
}

const findVisibleForecast = async () => {
  await screen.findByRole('form', { name: 'コーデ入力' })
  return (await screen.findAllByText(/最高気温 .*℃/))[0]!
}

const getSessionMock = vi.mocked(authClient.getSession)
const fetchSessionMock = {
  mockReset: () => getSessionMock.mockReset(),
  mockResolvedValue: (data: unknown) =>
    getSessionMock.mockResolvedValue({ data, error: null } as never),
}

// ドキュメントシェルを外し、jsdom の既存の html/body を使う。
Object.assign(routeTree.options, { shellComponent: undefined })

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
  vi.mocked(fetchCoordinates).mockReset().mockResolvedValue([])
  vi.mocked(saveCoordinates).mockReset().mockResolvedValue([])
  fetchSessionMock.mockReset()
  authClient.$store.atoms.session!.set({
    data: null,
    error: null,
    isPending: false,
  } as never)
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
      session: { expiresAt: new Date(Date.now() + 60_000) },
      user: {
        id: 'user-1',
        name: 'ハレギ太郎',
        email: 'user@example.com',
        areaCode: '130000',
      },
    } as never)

    const router = await renderAt('/forecast')

    expect(router.state.location.pathname).toBe('/forecast')
    expect(await findVisibleForecast()).toBeVisible()
    expect(fetchForecast).toHaveBeenCalledWith('130000')
    expect(
      screen.getByRole('link', { name: '出典: 気象庁ホームページ' }),
    ).toBeVisible()
  })
})

const authenticate = () =>
  fetchSessionMock.mockResolvedValue({
    session: { expiresAt: new Date(Date.now() + 60_000) },
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
  await screen.findByText('最高気温 25.5℃')
  await userEvent.selectOptions(
    screen.getByRole('combobox', { name: '表示地域' }),
    '460040',
  )
  await waitFor(() =>
    expect(router.state.location.search).toEqual({ area: '460040' }),
  )
  expect(await screen.findByText('最高気温 30℃')).toBeVisible()
  expect(screen.queryByText('最高気温 25.5℃')).not.toBeInTheDocument()
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
  await findVisibleForecast()
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
  expect(await findVisibleForecast()).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it.each(['通信エラー', '500', '502', '503'])(
  '到達不能(%s)でも取得済みセッションがあれば地域変更後も予報エラーと再試行を表示する',
  async (failure) => {
    authenticate()
    const router = await renderAt('/forecast')
    await findVisibleForecast()
    if (failure === '通信エラー') {
      getSessionMock.mockRejectedValue(new TypeError('Failed to fetch'))
    } else {
      getSessionMock.mockResolvedValue({
        data: null,
        error: { status: Number(failure) },
      } as never)
    }
    vi.mocked(fetchForecast).mockRejectedValue(
      new Error('予報を取得できませんでした'),
    )
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: '表示地域' }),
      '460040',
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '予報を取得できませんでした',
    )
    expect(router.state.location.pathname).toBe('/forecast')
    expect(router.state.location.search).toEqual({ area: '460040' })
    expect(screen.getByRole('button', { name: '再試行' })).toBeVisible()
    expect(
      screen.getByRole('link', { name: '出典: 気象庁ホームページ' }),
    ).toBeVisible()
    vi.mocked(fetchForecast).mockClear().mockResolvedValue(forecastFixture)
    await userEvent.click(screen.getByRole('button', { name: '再試行' }))
    expect(await findVisibleForecast()).toBeVisible()
    expect(fetchForecast).toHaveBeenCalledWith('460040')
  },
)

it('取得済みセッションがあっても401なら地域変更時に /login へ送る', async () => {
  authenticate()
  const router = await renderAt('/forecast')
  await findVisibleForecast()
  getSessionMock.mockResolvedValue({
    data: null,
    error: { status: 401 },
  } as never)
  await userEvent.selectOptions(
    screen.getByRole('combobox', { name: '表示地域' }),
    '460040',
  )
  expect(
    await screen.findByRole('heading', { name: 'ログイン', level: 1 }),
  ).toBeVisible()
  expect(router.state.location.pathname).toBe('/login')

  // 未認証を確認した後の障害で、前のセッションを復活させない。
  getSessionMock.mockRejectedValue(new TypeError('Failed to fetch'))
  await router.navigate({ to: '/forecast' })
  expect(router.state.location.pathname).toBe('/login')
})

it.each(['通信エラー', '503'])(
  '到達不能(%s)で取得済みセッションがなければ /login へ送る',
  async (failure) => {
    if (failure === '通信エラー')
      getSessionMock.mockRejectedValue(new TypeError('Failed to fetch'))
    else
      getSessionMock.mockResolvedValue({
        data: null,
        error: { status: 503 },
      } as never)
    const router = await renderAt('/forecast')
    expect(router.state.location.pathname).toBe('/login')
    expect(
      await screen.findByRole('heading', { name: 'ログイン', level: 1 }),
    ).toBeVisible()
  },
)

it('予報取得失敗時も今日から7日分を取得し、snapshotId なしで保存する', async () => {
  authenticate()
  vi.mocked(fetchForecast).mockRejectedValue(
    new Error('予報を取得できませんでした'),
  )
  await renderAt('/forecast')
  expect(await screen.findByText('予報を取得できませんでした')).toBeVisible()
  expect(
    screen.getByRole('link', { name: '出典: 気象庁ホームページ' }),
  ).toBeVisible()
  const user = userEvent.setup()
  const outerwear = await screen.findAllByRole('textbox', { name: 'アウター' })
  expect(outerwear).toHaveLength(7)
  expect(fetchCoordinates).toHaveBeenCalledWith({
    from: todayJst(),
    to: new Date(Date.parse(todayJst()) + 6 * 86400000)
      .toISOString()
      .slice(0, 10),
  })
  await user.type(outerwear[0]!, 'コート')
  await user.click(screen.getByRole('button', { name: 'コーデを保存' }))
  await waitFor(() => expect(saveCoordinates).toHaveBeenCalledOnce())
  const request = vi.mocked(saveCoordinates).mock.calls[0]![0]
  expect(request).not.toHaveProperty('snapshotId')
  expect(request.items).toHaveLength(1)
  expect(request.items[0]).toMatchObject({
    date: todayJst(),
    outerwear: 'コート',
  })
})

const savedCoordinate = (outerwear: string, version: number) => ({
  id: 1,
  date: todayJst(),
  outerwear,
  tops: 'シャツ',
  bottoms: 'デニム',
  version,
  maxTemperature: null,
  minTemperature: null,
  areaCode: null,
  tempStation: null,
  forecastIssuedAt: null,
  snapshotStatus: 'unavailable' as const,
  createdAt: '2026-10-11T02:00:00.000Z',
  updatedAt: '2026-10-11T02:00:00.000Z',
})

it('東京で保存した日の値と version を、大阪で別の日を保存した後も保持する', async () => {
  authenticate()
  const firstDay = todayJst()
  const secondDay = shiftJstDay(firstDay, 1)
  vi.mocked(fetchForecast).mockImplementation(async (area) => ({
    ...forecastFixture,
    areaCode: area!,
    snapshotId: `snapshot-${area}`,
    days: forecastFixture.days.slice(0, 2).map((day) => ({
      ...day,
      maxTemperature: area === '270000' ? 30 : 25.5,
    })),
  }))
  const tokyo = {
    ...savedCoordinate('コート', 3),
    areaCode: '130000',
    maxTemperature: 25.5,
  }
  const osaka = {
    ...savedCoordinate('ジャケット', 1),
    id: 2,
    date: secondDay,
    areaCode: '270000',
    maxTemperature: 30,
  }
  vi.mocked(saveCoordinates)
    .mockResolvedValueOnce([tokyo])
    .mockResolvedValueOnce([osaka])
    .mockResolvedValueOnce([{ ...tokyo, outerwear: 'コート 春', version: 4 }])
  await renderAt('/forecast')
  await findVisibleForecast()
  const user = userEvent.setup()
  const [first, second] = await screen.findAllByRole('textbox', {
    name: 'アウター',
  })
  const save = screen.getByRole('button', { name: 'コーデを保存' })
  await user.type(first!, 'コート')
  await user.click(save)
  await waitFor(() => expect(first).toHaveValue('コート'))
  await waitFor(() => expect(first).not.toHaveAttribute('readonly'))
  expect(saveCoordinates).toHaveBeenNthCalledWith(1, {
    snapshotId: 'snapshot-130000',
    items: [{ date: firstDay, outerwear: 'コート', tops: '', bottoms: '' }],
  })

  await user.selectOptions(
    screen.getByRole('combobox', { name: '表示地域' }),
    '270000',
  )
  await screen.findAllByText('最高気温 30℃')
  await user.type(second!, 'ジャケット')
  await user.click(save)
  await waitFor(() => expect(second).not.toHaveAttribute('readonly'))
  expect(saveCoordinates).toHaveBeenNthCalledWith(2, {
    snapshotId: 'snapshot-270000',
    items: [
      { date: secondDay, outerwear: 'ジャケット', tops: '', bottoms: '' },
    ],
  })
  expect(first).toHaveValue('コート')
  expect(second).toHaveValue('ジャケット')
  expect(save).toBeDisabled()

  await user.type(first!, ' 春')
  await user.click(save)
  await waitFor(() => expect(saveCoordinates).toHaveBeenCalledTimes(3))
  expect(saveCoordinates).toHaveBeenNthCalledWith(3, {
    snapshotId: 'snapshot-270000',
    items: [
      {
        date: firstDay,
        outerwear: 'コート 春',
        tops: 'シャツ',
        bottoms: 'デニム',
        version: 3,
      },
    ],
  })
})

it('各項目に trim 後の文字数エラーを関連付け、50文字なら保存できる', async () => {
  authenticate()
  await renderAt('/forecast')
  const user = userEvent.setup()
  const labels = ['アウター', 'トップス', 'ボトムス'] as const
  await screen.findAllByRole('textbox', { name: labels[0] })
  const fields = labels.map(
    (name) => screen.getAllByRole('textbox', { name })[0]!,
  )
  for (const field of fields) {
    await user.click(field)
    await user.paste(' ' + 'あ'.repeat(51) + ' ')
  }
  const save = screen.getByRole('button', { name: 'コーデを保存' })
  await user.click(save)
  for (const field of fields) {
    expect(field).toHaveAccessibleDescription(
      'コーデ項目は50文字以内で入力してください',
    )
  }
  expect(saveCoordinates).not.toHaveBeenCalled()

  for (const field of fields) {
    await user.clear(field)
    await user.paste(' ' + 'あ'.repeat(50) + ' ')
  }
  await user.click(save)
  await waitFor(() => expect(saveCoordinates).toHaveBeenCalledOnce())
  expect(vi.mocked(saveCoordinates).mock.calls[0]![0].items[0]).toMatchObject({
    outerwear: 'あ'.repeat(50),
    tops: 'あ'.repeat(50),
    bottoms: 'あ'.repeat(50),
  })
})

it('保存済みデータを編集し、取得し直さずに新しい version で続けて保存する', async () => {
  authenticate()
  vi.mocked(fetchCoordinates).mockResolvedValue([savedCoordinate('コート', 3)])
  vi.mocked(saveCoordinates)
    .mockResolvedValueOnce([savedCoordinate('コート 春', 4)])
    .mockResolvedValueOnce([savedCoordinate('コート 春 夏', 5)])
  await renderAt('/forecast')
  const user = userEvent.setup()
  const input = await screen.findByDisplayValue('コート')
  expect(screen.getByDisplayValue('シャツ')).toBeVisible()
  expect(screen.getByDisplayValue('デニム')).toBeVisible()
  const save = screen.getByRole('button', { name: 'コーデを保存' })
  await user.type(input, ' 春')
  await user.click(save)
  await waitFor(() => expect(save).toBeDisabled())
  await user.type(input, ' 夏')
  await user.click(save)
  await waitFor(() => expect(saveCoordinates).toHaveBeenCalledTimes(2))
  const requests = vi
    .mocked(saveCoordinates)
    .mock.calls.map(([request]) => request)
  expect(requests[0]!.items[0]).toMatchObject({
    outerwear: 'コート 春',
    version: 3,
  })
  expect(requests[1]!.items[0]).toMatchObject({
    outerwear: 'コート 春 夏',
    version: 4,
  })
  expect(fetchCoordinates).toHaveBeenCalledOnce()
})

it('地域切替で編集中のコーデを保持し、切替先の snapshotId で保存する', async () => {
  authenticate()
  vi.mocked(fetchForecast).mockImplementation(async (area) => ({
    ...forecastFixture,
    areaCode: area!,
    snapshotId: `snapshot-${area}`,
    days: [
      {
        ...forecastFixture.days[1]!,
        date: todayJst(),
        maxTemperature: area === '460040' ? 30 : 25.5,
      },
    ],
  }))
  await renderAt('/forecast')
  await findVisibleForecast()
  const user = userEvent.setup()
  const [input] = await screen.findAllByRole('textbox', { name: 'アウター' })
  await user.type(input!, 'コート')
  await user.selectOptions(
    screen.getByRole('combobox', { name: '表示地域' }),
    '460040',
  )
  await screen.findByText('最高気温 30℃')
  expect(input).toHaveValue('コート')
  await user.click(screen.getByRole('button', { name: 'コーデを保存' }))
  await waitFor(() =>
    expect(vi.mocked(saveCoordinates).mock.calls[0]?.[0]).toMatchObject({
      snapshotId: 'snapshot-460040',
      items: expect.arrayContaining([
        expect.objectContaining({ outerwear: 'コート' }),
      ]),
    }),
  )
})

it('VERSION_CONFLICT は再読み込みを案内し、入力と読み込み時の版を保持する', async () => {
  authenticate()
  vi.mocked(fetchCoordinates).mockResolvedValue([savedCoordinate('コート', 3)])
  vi.mocked(saveCoordinates).mockRejectedValue(
    new CoordinateConflictError('VERSION_CONFLICT'),
  )
  const toastError = vi.spyOn(toast, 'error')
  try {
    await renderAt('/forecast')
    const user = userEvent.setup()
    const input = await screen.findByDisplayValue('コート')
    await user.type(input, ' 春')
    await user.click(screen.getByRole('button', { name: 'コーデを保存' }))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining('再読み込み'),
      ),
    )
    expect(input).toHaveValue('コート 春')
    expect(saveCoordinates).toHaveBeenCalledOnce()
    expect(fetchForecast).toHaveBeenCalledOnce()
    expect(fetchCoordinates).toHaveBeenCalledOnce()
  } finally {
    toastError.mockRestore()
  }
})

it.each(['保存成功', '再送も失効', '予報の再取得に失敗'])(
  'SNAPSHOT_UNAVAILABLE で入力を保持して予報を再取得する（%s）',
  async (result) => {
    authenticate()
    const nextForecast = { ...forecastFixture, snapshotId: 'new-snapshot' }
    const fetch = vi
      .mocked(fetchForecast)
      .mockResolvedValueOnce(forecastFixture)
    if (result === '予報の再取得に失敗') {
      fetch.mockRejectedValue(new Error('予報を取得できませんでした'))
    } else {
      fetch.mockResolvedValue(nextForecast)
    }

    const save = vi.mocked(saveCoordinates)
    save.mockRejectedValueOnce(
      new CoordinateConflictError('SNAPSHOT_UNAVAILABLE'),
    )
    if (result === '再送も失効') {
      save.mockRejectedValue(
        new CoordinateConflictError('SNAPSHOT_UNAVAILABLE'),
      )
    } else {
      save.mockResolvedValue([savedCoordinate('コート', 1)])
    }

    await renderAt('/forecast')
    await findVisibleForecast()
    const user = userEvent.setup()
    const [input] = await screen.findAllByRole('textbox', { name: 'アウター' })
    await user.type(input!, 'コート')
    const button = screen.getByRole('button', { name: 'コーデを保存' })
    await user.click(button)

    if (result === '保存成功') {
      await waitFor(() => expect(button).toBeDisabled())
    } else {
      expect(
        await screen.findByText(
          '最新の予報で保存できませんでした。時間をおいてもう一度保存してください。',
        ),
      ).toBeVisible()
      expect(button).toBeEnabled()
    }
    expect(input).toHaveValue('コート')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenCalledTimes(result === '予報の再取得に失敗' ? 1 : 2)
    const firstRequest = save.mock.calls[0]![0]
    expect(firstRequest.snapshotId).toBe(forecastFixture.snapshotId)
    if (result !== '予報の再取得に失敗') {
      expect(save.mock.calls[1]![0]).toEqual({
        ...firstRequest,
        snapshotId: nextForecast.snapshotId,
      })
    }
  },
)

it('未保存の変更がある間だけ、ルート遷移と beforeunload を警告する', async () => {
  authenticate()
  const router = await renderAt('/forecast')
  const [input] = await screen.findAllByRole('textbox', { name: 'アウター' })
  const user = userEvent.setup()
  const beforeUnload = () =>
    window.dispatchEvent(new Event('beforeunload', { cancelable: true }))
  expect(beforeUnload()).toBe(true)
  await user.type(input!, 'コート')
  expect(beforeUnload()).toBe(false)

  await user.click(screen.getByRole('link', { name: 'Haregi' }))
  const warning = await screen.findByRole('alertdialog', {
    name: '未保存の変更があります',
  })
  expect(warning).toBeVisible()
  expect(router.state.location.pathname).toBe('/forecast')
  await user.click(screen.getByRole('button', { name: '編集を続ける' }))
  expect(input).toHaveValue('コート')
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

  await user.click(screen.getByRole('link', { name: 'Haregi' }))
  await user.click(
    await screen.findByRole('button', { name: '保存せずに離れる' }),
  )
  await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  expect(beforeUnload()).toBe(true)
})
