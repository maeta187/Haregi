import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { findArea } from '@haregi/schema'
import type { SessionReader } from '../../auth/domain/auth-user.ts'
import {
  type AuthEnv,
  sessionMiddleware,
} from '../../auth/presentation/session.ts'
import type { ForecastService } from '../application/service.ts'
import { ApplicationError } from '../../../shared/http-errors.ts'

const errorSchema = z.object({ code: z.string(), message: z.string() })
const json = (schema: z.ZodType) => ({ 'application/json': { schema } })
const responseSchema = z.object({
  snapshotId: z.string(),
  areaCode: z.string(),
  tempStation: z.string(),
  fetchedAt: z.iso.datetime(),
  forecastIssuedAt: z.iso.datetime(),
  status: z.enum(['fresh', 'stale']),
  days: z.array(
    z.object({
      date: z.iso.date(),
      maxTemperature: z.number().nullable(),
      minTemperature: z.number().nullable(),
      weatherCode: z.string().nullable(),
    }),
  ),
})

export const forecastRoutes = (
  sessions: SessionReader,
  service: Pick<ForecastService, 'getForecast'>,
) =>
  new OpenAPIHono<AuthEnv>({
    defaultHook: (result) => {
      if (!result.success)
        throw new ApplicationError('VALIDATION', '地域コードが不正です')
    },
  }).openapi(
    createRoute({
      method: 'get',
      path: '/api/forecast',
      middleware: [sessionMiddleware(sessions)] as const,
      request: {
        query: z.object({
          area: z
            .string()
            .refine((code) => !!findArea(code))
            .optional(),
        }),
      },
      responses: {
        200: {
          description: '週間予報と永続化された予報世代',
          content: { 'application/json': { schema: responseSchema } },
        },
        400: { description: '不正な地域コード', content: json(errorSchema) },
        401: { description: '未認証', content: json(errorSchema) },
        502: { description: '予報取得失敗', content: json(errorSchema) },
      },
    }),
    async (c) => {
      const forecast = await service.getForecast(
        c.req.valid('query').area ?? c.get('user').areaCode,
      )
      return c.json(
        {
          ...forecast,
          fetchedAt: forecast.fetchedAt.toISOString(),
          forecastIssuedAt: forecast.forecastIssuedAt.toISOString(),
        },
        200,
      )
    },
  )
