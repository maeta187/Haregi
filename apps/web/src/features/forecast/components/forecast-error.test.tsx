import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ForecastError } from './forecast-error.tsx'

it('日本語でエラーを表示し、再試行を通知する', async () => {
  const onRetry = vi.fn()
  render(<ForecastError onRetry={onRetry} />)
  expect(screen.getByRole('alert')).toHaveTextContent(
    '予報を取得できませんでした',
  )
  await userEvent.click(screen.getByRole('button', { name: '再試行' }))
  expect(onRetry).toHaveBeenCalledOnce()
})
