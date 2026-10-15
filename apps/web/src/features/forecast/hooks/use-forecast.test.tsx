import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { fetchForecast } from '../api/forecast-api.ts'
import { forecastFixture } from '../testing/forecast.ts'
import { useForecast } from './use-forecast.ts'

vi.mock('../api/forecast-api.ts', () => ({ fetchForecast: vi.fn() }))
beforeEach(() => vi.mocked(fetchForecast).mockReset())
const setup = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

it('地域ごとにキャッシュを分け、切替直後に旧地域を流用しない', async () => {
  vi.mocked(fetchForecast)
    .mockResolvedValueOnce(forecastFixture)
    .mockImplementationOnce(() => new Promise(() => {}))
  const { result, rerender } = renderHook(({ area }) => useForecast(area), {
    initialProps: { area: '130000' },
    wrapper: setup(),
  })
  await waitFor(() => expect(result.current.forecast).toEqual(forecastFixture))
  expect(result.current.snapshotId).toBe('snapshot-tokyo')
  rerender({ area: '460040' })
  expect(result.current.forecast).toBeUndefined()
  expect(result.current.snapshotId).toBeUndefined()
  expect(result.current.isPending).toBe(true)
  rerender({ area: '130000' })
  expect(result.current.forecast).toEqual(forecastFixture)
})

it('再取得失敗時は同じ地域のデータとエラーを返し、refetchで回復する', async () => {
  const failure = new Error('取得できませんでした')
  vi.mocked(fetchForecast)
    .mockResolvedValueOnce({ ...forecastFixture, status: 'stale' })
    .mockRejectedValueOnce(failure)
    .mockResolvedValueOnce(forecastFixture)
  const { result } = renderHook(() => useForecast('130000'), {
    wrapper: setup(),
  })
  await waitFor(() => expect(result.current.forecast).toBeDefined())
  expect(result.current.isStale).toBe(true)
  await act(async () => {
    await result.current.refetch()
  })
  await waitFor(() => expect(result.current.error).toBe(failure))
  expect(result.current.forecast?.areaCode).toBe('130000')
  expect(result.current.snapshotId).toBe('snapshot-tokyo')
  await act(async () => {
    await result.current.refetch()
  })
  await waitFor(() => expect(result.current.error).toBeNull())
  expect(result.current.isStale).toBe(false)
})
