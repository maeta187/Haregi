import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { createTestDatabase, dbDirectory } from '../../../test/database.ts'
import { createAuth } from './create-auth.ts'

type TestDatabase = Awaited<ReturnType<typeof createTestDatabase>>

const authConfig = {
  baseURL: 'http://localhost:3000',
  secret: 'test-secret-with-at-least-32-characters',
  webOrigin: 'http://localhost:3000',
}

// 0001 適用前(フェーズ3 の 0000 のみ)の account テーブルへ戻す。
// 既存行を消さないため、0000 から作り直すのではなく issuer だけを取り除く。
async function rollbackToInitialSchema(database: TestDatabase) {
  await database.pool.query('ALTER TABLE "account" DROP COLUMN "issuer"')
  await database.pool.query(
    'DELETE FROM drizzle.__drizzle_migrations WHERE hash = (SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1)',
  )
}

describe('0001_auth_issuer の既存データ移行', () => {
  let database: TestDatabase | undefined
  afterEach(async () => {
    await database?.close()
    database = undefined
  })

  it('既存の credential アカウントがある状態でも適用でき、移行後もログインできる', async () => {
    database = await createTestDatabase()
    database.migrate()
    const auth = createAuth(database.db, authConfig)
    await auth.api.signUpEmail({
      body: {
        name: '晴れ',
        email: 'existing@example.com',
        password: 'password123',
        areaCode: '130000',
      },
    })
    await rollbackToInitialSchema(database)
    expect(
      (await database.pool.query('SELECT count(*)::int AS count FROM account'))
        .rows,
    ).toEqual([{ count: 1 }])

    // 旧 SQL(ADD COLUMN ... NOT NULL)はここで 23502 になっていた
    database.migrate()

    expect(
      (await database.pool.query('SELECT issuer, account_id FROM account'))
        .rows,
    ).toEqual([{ issuer: 'local:credential', account_id: expect.any(String) }])
    const login = await createAuth(database.db, authConfig).api.signInEmail({
      body: { email: 'existing@example.com', password: 'password123' },
    })
    expect(login.user.email).toBe('existing@example.com')
    expect(login.token).toBeTruthy()
  }, 60_000)

  it('credential 以外の provider が残っていたら、推測で埋めずに失敗させる', async () => {
    database = await createTestDatabase()
    database.migrate()
    await rollbackToInitialSchema(database)
    await database.pool.query(
      'INSERT INTO "user" (id, name, email, area_code) VALUES ($1,$2,$3,$4)',
      ['social-user', '晴れ', 'social@example.com', '130000'],
    )
    await database.pool.query(
      'INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES ($1,$2,$3,$4,now())',
      ['social-account', 'google-123', 'google', 'social-user'],
    )

    // 実経路(drizzle-kit)が失敗し、issuer 列が作られないこと
    expect(() => database?.migrate()).toThrow()
    expect(
      (
        await database.pool.query(
          "SELECT count(*)::int AS count FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'issuer'",
        )
      ).rows,
    ).toEqual([{ count: 0 }])

    // 失敗理由が「推測で埋めない」ための明示的な中断であること
    await expect(
      database.pool.query(
        readFileSync(`${dbDirectory}/drizzle/0001_auth_issuer.sql`, 'utf8')
          .split('--> statement-breakpoint')
          .join(';'),
      ),
    ).rejects.toMatchObject({
      code: 'P0001',
      message: expect.stringContaining(
        'account.issuer を補完できない provider_id があります: google',
      ),
    })
  }, 60_000)
})
