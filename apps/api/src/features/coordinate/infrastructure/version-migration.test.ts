import { afterAll, expect, it } from 'vitest'
import { createTestDatabase } from '../../../test/database.ts'
let database: Awaited<ReturnType<typeof createTestDatabase>> | undefined
afterAll(async () => {
  await database?.close()
})
it('既存コーデの版を履歴へ引き継いでマイグレーションする', async () => {
  database = await createTestDatabase()
  database.migrate()
  await database.pool.query('DROP TABLE coordinate_version')
  await database.pool.query(
    'DELETE FROM drizzle.__drizzle_migrations WHERE created_at = (SELECT max(created_at) FROM drizzle.__drizzle_migrations)',
  )
  await database.pool.query(
    'INSERT INTO "user" (id,name,email,area_code) VALUES ($1,$1,$2,$3)',
    ['legacy', 'legacy@example.com', '130000'],
  )
  await database.pool.query(
    "INSERT INTO coordinate (user_id,date,tops,version) VALUES ('legacy','2026-11-13','服',7)",
  )
  database.migrate()
  expect(
    (
      await database.pool.query(
        'SELECT user_id, date::text, last_version FROM coordinate_version',
      )
    ).rows,
  ).toEqual([{ user_id: 'legacy', date: '2026-11-13', last_version: 7 }])
  await database.pool.query("DELETE FROM coordinate WHERE user_id='legacy'")
  expect(
    (await database.pool.query('SELECT last_version FROM coordinate_version'))
      .rows,
  ).toEqual([{ last_version: 7 }])
  await database.pool.query('DELETE FROM "user" WHERE id=\'legacy\'')
  expect(
    (await database.pool.query('SELECT * FROM coordinate_version')).rows,
  ).toEqual([])
}, 30_000)
