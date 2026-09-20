import { expect, it } from 'vitest'
import { ApplicationError, toHttpError } from './http-errors.ts'

it.each([
  ['VALIDATION', 400],
  ['UNAUTHORIZED', 401],
  ['NOT_FOUND', 404],
  ['CONFLICT', 409],
  ['UPSTREAM_UNAVAILABLE', 502],
] as const)('%s を HTTP %s に変換する', (code, status) => {
  expect(toHttpError(new ApplicationError(code, 'エラーです'))).toEqual({
    status,
    body: { code, message: 'エラーです' },
  })
})

it('未知の例外の詳細をクライアントへ公開しない', () => {
  expect(toHttpError(new Error('database password'))).toEqual({
    status: 500,
    body: { code: 'INTERNAL_ERROR', message: 'サーバーエラーが発生しました' },
  })
})
