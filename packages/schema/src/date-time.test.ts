import { describe, expect, it } from 'vitest'
import { formatJstDateTime } from './index.ts'

describe('formatJstDateTime', () => {
  it.each([
    ['2026-10-11T02:00:00Z', '2026年10月11日 11時00分'],
    ['2026-10-11T15:00:00Z', '2026年10月12日 0時00分'],
    ['2026-10-11T14:59:00Z', '2026年10月11日 23時59分'],
    ['2026-10-11T11:05:00+09:00', '2026年10月11日 11時05分'],
  ])('%s をJSTで表示する', (iso, expected) => {
    expect(formatJstDateTime(iso)).toBe(expected)
  })
})
