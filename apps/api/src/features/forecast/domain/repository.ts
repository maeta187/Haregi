import type { ResultAsync } from 'neverthrow'
import type { Forecast } from './forecast.ts'

export type ForecastError = {
  kind:
    | 'FetchError'
    | 'ParseError'
    | 'UnknownAreaError'
    | 'DbError'
    | 'SnapshotMissingError'
  cause?: unknown
}
export interface ForecastRepository {
  getForecast(areaCode: string): ResultAsync<Forecast, ForecastError>
  getForecastBySnapshotId(
    snapshotId: string,
  ): ResultAsync<Forecast, ForecastError>
}
