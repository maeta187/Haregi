import { describe, expect, it } from 'vitest'

import { formatTemperature } from '@haregi/schema'

describe('formatTemperature', () => {
  it.each([
    [12, '12℃'],
    [-3.5, '-3.5℃'],
  ])('気温%sを%sと表示する', (temperature, expected) => {
    expect(formatTemperature(temperature)).toBe(expected)
  })
})
