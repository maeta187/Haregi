import type { ResultAsync } from 'neverthrow'
import type { Coordinate, CoordinateInput } from './coordinate.ts'

export type DateRange = { from: string; to: string }
export type CoordinateDbError = {
  kind: 'DbError' | 'VersionConflict'
  cause?: unknown
}
export interface CoordinateRepository {
  listByUser(
    userId: string,
    range?: DateRange,
  ): ResultAsync<Coordinate[], CoordinateDbError>
  upsertForUser(
    userId: string,
    items: CoordinateInput[],
  ): ResultAsync<Coordinate[], CoordinateDbError>
}
