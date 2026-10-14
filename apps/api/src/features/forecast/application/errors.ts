import { ApplicationError } from '../../../shared/http-errors.ts'

export class ForecastUnavailableError extends ApplicationError {
  constructor(cause: unknown) {
    super('UPSTREAM_UNAVAILABLE', '天気予報を取得できませんでした', { cause })
    this.name = 'ForecastUnavailableError'
  }
}
export class SnapshotUnavailableError extends ApplicationError {
  constructor(cause: unknown) {
    super('SNAPSHOT_UNAVAILABLE', '予報を再取得してから保存してください', {
      cause,
    })
    this.name = 'SnapshotUnavailableError'
  }
}
export class UnknownAreaError extends ApplicationError {
  constructor(cause: unknown) {
    super('VALIDATION', '地域コードが不正です', { cause })
    this.name = 'UnknownAreaError'
  }
}
