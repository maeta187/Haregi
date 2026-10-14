export type ForecastDay = {
  date: string
  maxTemperature: number | null
  minTemperature: number | null
  weatherCode: string | null
}
export type NormalizedForecast = {
  areaCode: string
  tempStation: string
  forecastIssuedAt: Date
  days: ForecastDay[]
}
export type ForecastContent = NormalizedForecast & {
  fetchedAt: Date
  status: 'fresh' | 'stale'
}
export type Forecast = ForecastContent & { snapshotId: string }
