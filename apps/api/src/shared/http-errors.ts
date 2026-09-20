const statuses = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
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
