import type { Coordinate, CoordinateInput } from '../domain/coordinate.ts'
import { decideSnapshot } from '../domain/coordinate.ts'
import type {
  CoordinateDbError,
  CoordinateRepository,
  DateRange,
} from '../domain/repository.ts'
import type { ForecastService } from '../../forecast/application/service.ts'
import { logger } from '../../../shared/logger.ts'
import { CoordinateStorageError, VersionConflictError } from './errors.ts'

export type CoordinatesUpsert = {
  snapshotId?: string | undefined
  items: Omit<CoordinateInput, 'snapshot'>[]
}
function fail(error: CoordinateDbError): never {
  logger.error({ kind: error.kind, cause: error.cause }, 'コーデの読み書き失敗')
  switch (error.kind) {
    case 'VersionConflict':
      throw new VersionConflictError(error)
    case 'DbError':
      throw new CoordinateStorageError(error)
  }
}
export function createCoordinateService(
  repository: CoordinateRepository,
  forecast: Pick<ForecastService, 'getForecastBySnapshotId'>,
) {
  return {
    listCoordinates(userId: string, range?: DateRange): Promise<Coordinate[]> {
      return repository.listByUser(userId, range).match((rows) => rows, fail)
    },
    async upsertCoordinates(
      userId: string,
      input: CoordinatesUpsert,
    ): Promise<Coordinate[]> {
      const generation =
        input.snapshotId === undefined
          ? undefined
          : await forecast.getForecastBySnapshotId(input.snapshotId)
      return repository
        .upsertForUser(
          userId,
          input.items.map((item) => ({
            date: item.date,
            outerwear: item.outerwear,
            tops: item.tops,
            bottoms: item.bottoms,
            version: item.version,
            snapshot: generation
              ? decideSnapshot(generation, item.date)
              : undefined,
          })),
        )
        .match((rows) => rows, fail)
    },
  }
}
export type CoordinateService = ReturnType<typeof createCoordinateService>
