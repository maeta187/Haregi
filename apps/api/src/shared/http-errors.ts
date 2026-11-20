import { HTTPException } from 'hono/http-exception'

const statuses = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  SNAPSHOT_UNAVAILABLE: 409,
  UPSTREAM_UNAVAILABLE: 502,
} as const

export type ApplicationErrorCode = keyof typeof statuses

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode

  constructor(
    code: ApplicationErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'ApplicationError'
    this.code = code
  }
}

export function toHttpError(error: unknown) {
  if (error instanceof HTTPException && error.status === 400) {
    return {
      status: 400 as const,
      body: { code: 'VALIDATION', message: '入力内容を確認してください' },
    }
  }
  if (error instanceof ApplicationError) {
    return {
      status: statuses[error.code],
      body: { code: error.code, message: error.message },
    }
  }
  return {
    status: 500 as const,
    body: { code: 'INTERNAL_ERROR', message: 'サーバーエラーが発生しました' },
  }
}
