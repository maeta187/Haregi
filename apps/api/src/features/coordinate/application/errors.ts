import { ApplicationError } from '../../../shared/http-errors.ts'

export class VersionConflictError extends ApplicationError {
  constructor(cause: unknown) {
    super(
      'VERSION_CONFLICT',
      'コーデが更新されています。再読み込みしてください',
      { cause },
    )
    this.name = 'VersionConflictError'
  }
}
export class CoordinateStorageError extends Error {
  constructor(cause: unknown) {
    super('コーデの読み書きに失敗しました', { cause })
    this.name = 'CoordinateStorageError'
  }
}
