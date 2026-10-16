import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { forecastFixture } from '../testing/forecast.ts'
import { ForecastTable } from './forecast-table.tsx'

it('7日の日付と気温を改変せず表示し、欠損はダッシュにする', () => {
  render(<ForecastTable days={forecastFixture.days} />)
  expect(
    screen.getByRole('table', { name: '週間の最高・最低気温' }),
  ).toBeVisible()
  const rows = screen.getAllByRole('row')
  expect(rows).toHaveLength(8)
  expect(within(rows[1]!).getByText('2026年10月11日')).toBeVisible()
  expect(within(rows[1]!).getAllByText('—')).toHaveLength(2)
  expect(within(rows[2]!).getByText('25.5℃')).toBeVisible()
  expect(within(rows[2]!).getByText('18℃')).toBeVisible()
})
