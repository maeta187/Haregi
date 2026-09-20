import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase, dbDirectory } from './database.ts'

const testConfig = fileURLToPath(
  new URL('./fixtures/drizzle-test.config.ts', import.meta.url),
)

describe('空の PostgreSQL へのマイグレーション', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>
  beforeAll(async () => {
    database = await createTestDatabase()
    expect(
      (
        await database.pool.query(
          "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
        )
      ).rows,
    ).toEqual([])
    database.migrate()
  }, 30_000)
  afterAll(async () => {
    await database?.close()
  })

  it('同じユーザー・暦日の重複 INSERT を一意制約違反にする', async () => {
    await database.pool.query(
      'INSERT INTO "user" (id, name, email, area_code) VALUES ($1,$2,$3,$4)',
      ['duplicate', '晴れ', 'duplicate@example.com', '130000'],
    )
    await database.pool.query(
      'INSERT INTO coordinate (user_id, date) VALUES ($1,$2)',
      ['duplicate', '2026-09-06'],
    )
    await expect(
      database.pool.query(
        'INSERT INTO coordinate (user_id, date) VALUES ($1,$2)',
        ['duplicate', '2026-09-06'],
      ),
    ).rejects.toMatchObject({ code: '23505' })
  })

  it('ユーザー削除に伴い、そのユーザーの coordinate のみ cascade 削除する', async () => {
    for (const id of ['delete', 'keep']) {
      await database.pool.query(
        'INSERT INTO "user" (id, name, email, area_code) VALUES ($1,$2,$3,$4)',
        [id, '晴れ', `${id}@example.com`, '130000'],
      )
      await database.pool.query(
        'INSERT INTO coordinate (user_id, date) VALUES ($1,$2)',
        [id, '2026-09-06'],
      )
    }
    await database.pool.query('DELETE FROM "user" WHERE id = $1', ['delete'])
    expect(
      (
        await database.pool.query(
          'SELECT user_id FROM coordinate WHERE user_id = ANY($1)',
          [['delete', 'keep']],
        )
      ).rows,
    ).toEqual([{ user_id: 'keep' }])
  })

  it('drizzle-kit generate でスキーマ差分もファイル変更も発生しない', () => {
    // 差分が生じた失敗時にもリポジトリへ SQL を生成しない。
    const directory = mkdtempSync(join(tmpdir(), 'haregi-drizzle-'))
    const out = join(directory, 'drizzle')
    try {
      cpSync(`${dbDirectory}/drizzle`, out, { recursive: true })
      const snapshot = () =>
        Object.fromEntries(
          readdirSync(out, {
            recursive: true,
            withFileTypes: true,
          })
            .filter((entry) => entry.isFile())
            .map((entry) => [
              entry.name,
              readFileSync(`${entry.parentPath}/${entry.name}`, 'utf8'),
            ]),
        )
      const before = snapshot()
      const output = execFileSync(
        './node_modules/.bin/drizzle-kit',
        ['generate', `--config=${testConfig}`],
        {
          cwd: dbDirectory,
          env: {
            ...process.env,
            DATABASE_URL: database.url,
            TZ: 'UTC',
            // drizzle-kit 0.31 は snapshot 読み込み時に './' を付けるため相対パスで渡す。
            HAREGI_TEST_DRIZZLE_OUT: relative(dbDirectory, out),
          },
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'inherit'],
          timeout: 30_000,
        },
      )
      expect(output).toContain('No schema changes')
      expect(snapshot()).toEqual(before)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }, 30_000)

  it('DB の既定 TZ が Asia/Tokyo でも createDb 接続は UTC になる', async () => {
    const settings = await database.pool.query(
      'SELECT unnest(setconfig) AS setting FROM pg_db_role_setting WHERE setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database())',
    )
    expect(settings.rows).toContainEqual({ setting: 'TimeZone=Asia/Tokyo' })
    expect((await database.pool.query('SHOW TimeZone')).rows).toEqual([
      { TimeZone: 'UTC' },
    ])
  })

  it('drizzle-kit の実接続でも SHOW TimeZone が UTC を返す', async () => {
    execFileSync(
      './node_modules/.bin/drizzle-kit',
      ['migrate', `--config=${testConfig}`],
      {
        cwd: dbDirectory,
        env: { ...process.env, DATABASE_URL: database.url, TZ: 'UTC' },
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 30_000,
      },
    )
    expect(
      (await database.pool.query('SELECT timezone FROM timezone_probe')).rows,
    ).toEqual([{ timezone: 'UTC' }])
  }, 30_000)
})
