import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { ForecastMeta } from './forecast-meta.tsx'

it.each([false, true])(
  '発表日時と代表地点、stale=%sの鮮度を示す',
  (isStale) => {
    render(
      <ForecastMeta
        forecastIssuedAt="2026-10-11T02:00:00Z"
        isStale={isStale}
      />,
    )
    expect(screen.getByText('地域の代表地点(アメダス)の予報')).toBeVisible()
    expect(
      screen.getByText('2026年10月11日 11時00分').closest('p'),
    ).toHaveTextContent(
      isStale
        ? '2026年10月11日 11時00分時点の予報(最新を取得できませんでした)'
        : '2026年10月11日 11時00分発表',
    )
  },
)
