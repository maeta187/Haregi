import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { coordinatesUpsertSchema, isValidJstDate } from '@haregi/schema'
import type { SessionReader } from '../../auth/domain/auth-user.ts'
import {
  sessionMiddleware,
  type AuthEnv,
} from '../../auth/presentation/session.ts'
import type { CoordinateService } from '../application/service.ts'
import type { Coordinate } from '../domain/coordinate.ts'
import { ApplicationError } from '../../../shared/http-errors.ts'

const dateSchema = z
  .string()
  .refine(isValidJstDate, '日付は実在するYYYY-MM-DD形式で入力してください')
const rangeSchema = z
  .object({ from: dateSchema.optional(), to: dateSchema.optional() })
  .superRefine(({ from, to }, context) => {
    if ((from === undefined) !== (to === undefined))
      context.addIssue({
        code: 'custom',
        message: '開始日と終了日を両方指定してください',
      })
    if (from !== undefined && to !== undefined) {
      if (from > to)
        context.addIssue({
          code: 'custom',
          message: '開始日は終了日以前にしてください',
        })
      if (
        Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) >
        365 * 86400000
      )
        context.addIssue({ code: 'custom', message: '期間は最大366日です' })
    }
  })
const rowSchema = z.object({
  id: z.number().int(),
  date: z.iso.date(),
  outerwear: z.string(),
  tops: z.string(),
  bottoms: z.string(),
  maxTemperature: z.number().nullable(),
  minTemperature: z.number().nullable(),
  areaCode: z.string().nullable(),
  tempStation: z.string().nullable(),
  forecastIssuedAt: z.iso.datetime().nullable(),
  snapshotStatus: z.enum(['fresh', 'stale', 'unavailable']),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})
const responseSchema = z.object({ items: z.array(rowSchema) })
const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
})
const errorSchema = z.object({ code: z.string(), message: z.string() })
const responses = {
  200: {
    description: '保存されているコーデと現在の版',
    content: json(responseSchema),
  },
  400: { description: '入力が不正', content: json(errorSchema) },
  401: { description: '未認証', content: json(errorSchema) },
  500: { description: 'サーバーエラー', content: json(errorSchema) },
}
const serialize = (row: Coordinate) => ({
  id: row.id,
  date: row.date,
  outerwear: row.outerwear,
  tops: row.tops,
  bottoms: row.bottoms,
  maxTemperature: row.maxTemperature,
  minTemperature: row.minTemperature,
  areaCode: row.areaCode,
  tempStation: row.tempStation,
  forecastIssuedAt: row.forecastIssuedAt?.toISOString() ?? null,
  snapshotStatus: row.snapshotStatus,
  version: row.version,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})
export const coordinateRoutes = (
  sessions: SessionReader,
  service: CoordinateService,
) =>
  new OpenAPIHono<AuthEnv>({
    defaultHook: (result) => {
      if (!result.success)
        throw new ApplicationError(
          'VALIDATION',
          result.error.issues[0]?.message ?? '入力が不正です',
        )
    },
  })
    .openapi(
      createRoute({
        method: 'get',
        path: '/api/coordinates',
        middleware: [sessionMiddleware(sessions)] as const,
        request: { query: rangeSchema },
        responses,
      }),
      async (c) => {
        const { from, to } = c.req.valid('query')
        const rows = await service.listCoordinates(
          c.get('user').id,
          from !== undefined && to !== undefined ? { from, to } : undefined,
        )
        return c.json({ items: rows.map(serialize) }, 200)
      },
    )
    .openapi(
      createRoute({
        method: 'put',
        path: '/api/coordinates',
        middleware: [sessionMiddleware(sessions)] as const,
        request: {
          body: { required: true, content: json(coordinatesUpsertSchema) },
        },
        responses: {
          ...responses,
          409: {
            description:
              'VERSION_CONFLICT: 版の競合 / SNAPSHOT_UNAVAILABLE: 予報世代の失効',
            content: json(
              z.object({
                code: z.enum(['VERSION_CONFLICT', 'SNAPSHOT_UNAVAILABLE']),
                message: z.string(),
              }),
            ),
          },
        },
      }),
      async (c) => {
        const rows = await service.upsertCoordinates(
          c.get('user').id,
          c.req.valid('json'),
        )
        return c.json({ items: rows.map(serialize) }, 200)
      },
    )
