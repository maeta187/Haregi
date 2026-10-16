import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { forecastFixture } from '../testing/forecast.ts'
import { ForecastSection } from './forecast-section.tsx'

const props = {
  area: '130000',
  forecast: undefined,
  isPending: true,
  error: null,
  isStale: false,
  onAreaChange: vi.fn(),
  onRetry: vi.fn(),
}
it('読み込み中も地域選択と出典を表示する', async () => {
  render(<ForecastSection {...props} />)
  expect(screen.getByRole('status')).toHaveTextContent('予報を読み込んでいます')
  expect(screen.getByText('出典: 気象庁ホームページ')).toBeVisible()
  await userEvent.selectOptions(
    screen.getByRole('combobox', { name: '表示地域' }),
    '460040',
  )
  expect(props.onAreaChange).toHaveBeenCalledWith('460040')
})

it.each([undefined, forecastFixture])(
  '失敗時も出典を表示し、同一地域の既存データがあれば併記する',
  async (forecast) => {
    const onRetry = vi.fn()
    render(
      <ForecastSection
        {...props}
        forecast={forecast}
        isPending={false}
        error={new Error('failed')}
        onRetry={onRetry}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      '予報を取得できませんでした',
    )
    expect(screen.getByText('出典: 気象庁ホームページ')).toBeVisible()
    if (forecast) {
      expect(screen.getByRole('table')).toBeVisible()
      expect(screen.getByText(/時点の予報/)).toHaveTextContent(
        '最新を取得できませんでした',
      )
    } else expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '再試行' }))
    expect(onRetry).toHaveBeenCalledOnce()
  },
)
