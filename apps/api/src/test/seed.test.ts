import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createAuth } from '../features/auth/infrastructure/create-auth.ts'
import { createTestDatabase } from './database.ts'

let database: Awaited<ReturnType<typeof createTestDatabase>>
beforeAll(async () => {
  database = await createTestDatabase()
  database.migrate()
}, 30_000)
afterAll(async () => {
  await database?.close()
})

it('seed コマンドで作成したユーザーが Better Auth でログインでき、再実行しても重複しない', async () => {
  const scripts = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  ).scripts
  for (let i = 0; i < 2; i++) {
    execFileSync('/bin/sh', ['-c', scripts['db:seed']], {
      env: { ...process.env, DATABASE_URL: database.url, TZ: 'Asia/Tokyo' },
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 20_000,
    })
  }
  const auth = createAuth(database.db, {
    baseURL: 'http://localhost:3000',
    secret: 'test-secret-with-at-least-32-characters',
    webOrigin: 'http://localhost:3000',
  })
  const login = await auth.api.signInEmail({
    body: { email: 'admin@example.com', password: 'password123' },
  })
  expect(login.user).toMatchObject({
    email: 'admin@example.com',
    areaCode: '130000',
  })
  expect(
    (await database.pool.query('SELECT id FROM "user"')).rows,
  ).toHaveLength(1)
}, 45_000)
