// @vitest-environment node
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { fetchForecast } from '../api/forecast-api.ts'
import { useForecast } from './use-forecast.ts'

vi.mock('../api/forecast-api.ts', () => ({ fetchForecast: vi.fn() }))

it('SSRでは予報を取得せずローディングを返す', () => {
  function Probe() {
    const { isPending, forecast, snapshotId } = useForecast('130000')
    return (
      <output>
        {isPending && !forecast && !snapshotId ? '読み込み中' : '取得済み'}
      </output>
    )
  }
  const html = renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <Probe />
    </QueryClientProvider>,
  )
  expect(html).toContain('読み込み中')
  expect(fetchForecast).not.toHaveBeenCalled()
})
