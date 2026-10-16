import type { Forecast } from '../api/forecast-api.ts'

export const forecastFixture: Forecast = {
  areaCode: '130000',
  tempStation: '44132',
  snapshotId: 'snapshot-tokyo',
  forecastIssuedAt: '2026-10-11T02:00:00.000Z',
  fetchedAt: '2026-10-11T02:10:00.000Z',
  status: 'fresh',
  days: Array.from({ length: 7 }, (_, index) => ({
    date: `2026-10-${11 + index}`,
    maxTemperature: index === 0 ? null : 25.5,
    minTemperature: index === 0 ? null : 18,
    weatherCode: null,
  })),
}
