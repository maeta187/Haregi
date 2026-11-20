import type { InferRequestType, InferResponseType } from 'hono/client'
import { apiClient } from '@/lib/api-client.ts'

type CoordinateEndpoint = typeof apiClient.api.coordinates
export type Coordinate = InferResponseType<
  CoordinateEndpoint['$get'],
  200
>['items'][number]
export type CoordinateValues = InferRequestType<
  CoordinateEndpoint['$put']
>['json']

export async function fetchCoordinates(query: {
  from: string
  to: string
}): Promise<Coordinate[]> {
  const response = await apiClient.api.coordinates.$get({ query })
  if (response.status !== 200) {
    throw new Error('コーデを読み込めませんでした')
  }
  return (await response.json()).items
}

export class CoordinateConflictError extends Error {
  readonly code: 'VERSION_CONFLICT' | 'SNAPSHOT_UNAVAILABLE'

  constructor(code: CoordinateConflictError['code']) {
    super(code)
    this.code = code
  }
}

export async function saveCoordinates(
  json: CoordinateValues,
): Promise<Coordinate[]> {
  const response = await apiClient.api.coordinates.$put({ json })
  if (response.status === 409) {
    const body = await response.json().catch(() => null)
    if (
      body?.code === 'VERSION_CONFLICT' ||
      body?.code === 'SNAPSHOT_UNAVAILABLE'
    ) {
      throw new CoordinateConflictError(body.code)
    }
  }
  if (response.status !== 200) {
    throw new Error('コーデを保存できませんでした')
  }
  return (await response.json()).items
}
