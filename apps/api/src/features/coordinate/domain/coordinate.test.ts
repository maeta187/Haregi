import { expect, it } from 'vitest'
import { coordinatesUpsertSchema, todayJst } from '@haregi/schema'
import { decideSnapshot, isEmptyCoordinate } from './coordinate.ts'
import type { Forecast } from '../../forecast/domain/forecast.ts'

const forecast: Forecast = {
  snapshotId: 'generation',
  areaCode: '130000',
  tempStation: '44132',
  fetchedAt: new Date(),
  forecastIssuedAt: new Date(),
  status: 'stale',
  days: [
    {
      date: todayJst(),
      maxTemperature: 20,
      minTemperature: null,
      weatherCode: '100',
    },
  ],
}
it('表示した予報の日から欠損も含め気温と由来を決定する', () => {
  expect(decideSnapshot(forecast, todayJst())).toEqual({
    maxTemperature: 20,
    minTemperature: null,
    areaCode: '130000',
    tempStation: '44132',
    forecastIssuedAt: forecast.forecastIssuedAt,
    snapshotStatus: 'stale',
  })
})
it('予報範囲外・予報なしは null と unavailable にする', () => {
  for (const value of [forecast, undefined]) {
    expect(decideSnapshot(value, '2000-01-01')).toEqual({
      maxTemperature: null,
      minTemperature: null,
      areaCode: null,
      tempStation: null,
      forecastIssuedAt: null,
      snapshotStatus: 'unavailable',
    })
  }
})
it('省略と空白を含む3項目すべてが空なら削除と判定する', () => {
  expect(isEmptyCoordinate({ outerwear: '　 ', tops: '\n' })).toBe(true)
  for (const key of ['outerwear', 'tops', 'bottoms'])
    expect(isEmptyCoordinate({ [key]: '服' })).toBe(false)
})
it('共有スキーマで上限・重複・暦日・保存範囲・trim を強制する', () => {
  const item = { date: todayJst(), tops: ' シャツ ' }
  expect(coordinatesUpsertSchema.parse({ items: [item] }).items[0]?.tops).toBe(
    'シャツ',
  )
  for (const items of [
    Array(8).fill(item),
    [item, item],
    [{ date: '2026-02-30' }],
    [{ date: '1900-01-01' }],
  ]) {
    expect(coordinatesUpsertSchema.safeParse({ items }).success).toBe(false)
  }
})
