import type { Forecast } from '../../forecast/domain/forecast.ts'

export type TemperatureSnapshot = {
  maxTemperature: number | null
  minTemperature: number | null
  areaCode: string | null
  tempStation: string | null
  forecastIssuedAt: Date | null
  snapshotStatus: 'fresh' | 'stale' | 'unavailable'
}
export type Clothing = {
  outerwear?: string | undefined
  tops?: string | undefined
  bottoms?: string | undefined
}
export type CoordinateInput = Clothing & {
  date: string
  version?: number | undefined
  // undefined は既存の気温・由来を UPDATE しないことを表す。
  snapshot?: TemperatureSnapshot | undefined
}
export type Coordinate = TemperatureSnapshot & {
  id: number
  userId: string
  date: string
  outerwear: string
  tops: string
  bottoms: string
  version: number
  createdAt: Date
  updatedAt: Date
}
export const isEmptyCoordinate = (item: Clothing): boolean =>
  ![item.outerwear, item.tops, item.bottoms].some((value) => value?.trim())

export function decideSnapshot(
  forecast: Forecast | undefined,
  date: string,
): TemperatureSnapshot {
  const day = forecast?.days.find((day) => day.date === date)
  if (!forecast || !day)
    return {
      maxTemperature: null,
      minTemperature: null,
      areaCode: null,
      tempStation: null,
      forecastIssuedAt: null,
      snapshotStatus: 'unavailable',
    }
  return {
    maxTemperature: day.maxTemperature,
    minTemperature: day.minTemperature,
    areaCode: forecast.areaCode,
    tempStation: forecast.tempStation,
    forecastIssuedAt: forecast.forecastIssuedAt,
    snapshotStatus: forecast.status,
  }
}
