import { coordinate, coordinateVersion, type Db } from '@haregi/db'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { ResultAsync } from 'neverthrow'
import {
  decideSnapshot,
  isEmptyCoordinate,
  type Coordinate,
} from '../domain/coordinate.ts'
import type { CoordinateRepository } from '../domain/repository.ts'

class VersionConflict extends Error {}
function isUniqueConflict(cause: unknown): boolean {
  if (!cause || typeof cause !== 'object') return false
  if ('code' in cause && cause.code === '23505') return true
  return 'cause' in cause && isUniqueConflict(cause.cause)
}

export function createCoordinateRepository(db: Db): CoordinateRepository {
  return {
    listByUser(userId, range) {
      const query = db
        .select()
        .from(coordinate)
        .where(
          and(
            eq(coordinate.userId, userId),
            range ? gte(coordinate.date, range.from) : undefined,
            range ? lte(coordinate.date, range.to) : undefined,
          ),
        )
        .orderBy(desc(coordinate.date))
        .$dynamic()
      return ResultAsync.fromPromise(
        (range ? query : query.limit(30)).then((rows) => rows as Coordinate[]),
        (cause) => ({ kind: 'DbError' as const, cause }),
      )
    },
    upsertForUser(userId, items) {
      return ResultAsync.fromPromise(
        db.transaction(async (tx) => {
          // 存在しない日付にも永続するロック行を使う。削除と再作成の間にも同じキーを直列化する。
          // 複数キーは日付順でロックし、逆順の一括送信によるデッドロックを避ける。
          const versions = new Map<string, number>()
          for (const date of [
            ...new Set(items.map((item) => item.date)),
          ].sort()) {
            const [history] = await tx
              .insert(coordinateVersion)
              .values({ userId, date })
              .onConflictDoUpdate({
                target: [coordinateVersion.userId, coordinateVersion.date],
                set: { lastVersion: sql`${coordinateVersion.lastVersion}` },
              })
              .returning()
            versions.set(date, history!.lastVersion)
          }
          const saved: Coordinate[] = []
          for (const item of items) {
            const ownerDate = and(
              eq(coordinate.userId, userId),
              eq(coordinate.date, item.date),
            )
            const versionCondition = and(
              ownerDate,
              eq(coordinate.version, item.version ?? 0),
            )
            if (isEmptyCoordinate(item)) {
              const deleted =
                item.version === undefined
                  ? []
                  : await tx
                      .delete(coordinate)
                      .where(versionCondition)
                      .returning({ version: coordinate.version })
              if (deleted[0]) {
                await tx
                  .update(coordinateVersion)
                  .set({ lastVersion: deleted[0].version })
                  .where(
                    and(
                      eq(coordinateVersion.userId, userId),
                      eq(coordinateVersion.date, item.date),
                    ),
                  )
              }
              if (deleted.length === 0) {
                const existing = await tx
                  .select({ id: coordinate.id })
                  .from(coordinate)
                  .where(ownerDate)
                  .for('update')
                if (existing.length) throw new VersionConflict()
              }
              continue
            }
            const clothing = {
              outerwear: item.outerwear?.trim() ?? '',
              tops: item.tops?.trim() ?? '',
              bottoms: item.bottoms?.trim() ?? '',
            }
            const rows =
              item.version === undefined
                ? await tx
                    .insert(coordinate)
                    .values({
                      ...clothing,
                      userId,
                      date: item.date,
                      ...(item.snapshot ??
                        decideSnapshot(undefined, item.date)),
                      version: versions.get(item.date)! + 1,
                    })
                    .returning()
                : await tx
                    .update(coordinate)
                    .set({
                      ...clothing,
                      ...item.snapshot,
                      version: sql`${coordinate.version} + 1`,
                      updatedAt: sql`clock_timestamp()`,
                    })
                    .where(versionCondition)
                    .returning()
            if (!rows.length) throw new VersionConflict()
            await tx
              .update(coordinateVersion)
              .set({ lastVersion: rows[0]!.version })
              .where(
                and(
                  eq(coordinateVersion.userId, userId),
                  eq(coordinateVersion.date, item.date),
                ),
              )
            saved.push(...(rows as Coordinate[]))
          }
          return saved
        }),
        (cause) => ({
          kind:
            cause instanceof VersionConflict || isUniqueConflict(cause)
              ? ('VersionConflict' as const)
              : ('DbError' as const),
          cause,
        }),
      )
    },
  }
}
