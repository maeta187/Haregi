import type { Forecast } from '../domain/forecast.ts'
import type { ForecastRepository } from '../domain/repository.ts'
import { logger } from '../../../shared/logger.ts'
import {
  ForecastUnavailableError,
  SnapshotUnavailableError,
  UnknownAreaError,
} from './errors.ts'

export function createForecastService(repository: ForecastRepository) {
  return {
    getForecast(areaCode: string): Promise<Forecast> {
      return repository.getForecast(areaCode).match(
        (value) => value,
        (error) => {
          logger.error(
            { areaCode, kind: error.kind, cause: error.cause },
            '予報取得失敗',
          )
          if (error.kind === 'UnknownAreaError')
            throw new UnknownAreaError(error)
          throw new ForecastUnavailableError(error)
        },
      )
    },
    getForecastBySnapshotId(snapshotId: string): Promise<Forecast> {
      return repository.getForecastBySnapshotId(snapshotId).match(
        (value) => value,
        (error) => {
          logger.error(
            { snapshotId, kind: error.kind, cause: error.cause },
            '予報世代の引き当て失敗',
          )
          throw new SnapshotUnavailableError(error)
        },
      )
    },
  }
}
export type ForecastService = ReturnType<typeof createForecastService>
