import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatJstDate, isValidJstDate, todayJst } from '@haregi/schema'

describe('todayJst', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    ['2026-01-01T14:59:59Z', '2026-01-01'],
    ['2026-01-01T15:00:00Z', '2026-01-02'],
  ])('UTCの%sではJSTの日付として%sを返す', (now, expected) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(now))

    expect(todayJst()).toBe(expected)
  })
})

describe('isValidJstDate', () => {
  it.each(['2026-01-01', '2024-02-29'])(
    '形式どおりの実在する暦日 %s を受理する',
    (date) => {
      expect(isValidJstDate(date)).toBe(true)
    },
  )

  it.each(['2026/01/01', '2026-1-1', '2026-02-29', '2026-02-30', 'not-a-date'])(
    '形式違反または実在しない暦日 %s を拒否する',
    (date) => {
      expect(isValidJstDate(date)).toBe(false)
    },
  )
})

describe('formatJstDate', () => {
  it('YYYY-MM-DDを年月日の表示へ整形する', () => {
    expect(formatJstDate('2026-01-02')).toBe('2026年1月2日')
  })
})
