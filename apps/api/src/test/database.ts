import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createDb } from '@haregi/db'

export const dbDirectory = fileURLToPath(
  new URL('../../../../packages/db/', import.meta.url),
)

// 既存の開発 DB のテーブルには触れず、テストごとに空の DB を作る。
export async function createTestDatabase() {
  const sourceUrl = process.env['DATABASE_URL']
  if (!sourceUrl) throw new Error('実 DB テストには DATABASE_URL が必要です')
  const admin = createDb(sourceUrl)
  const name = `haregi_test_${randomUUID().replaceAll('-', '')}`
  const url = new URL(sourceUrl)
  url.pathname = `/${name}`
  url.searchParams.delete('options')
  try {
    await admin.pool.query(`CREATE DATABASE "${name}" TEMPLATE template0`)
    await admin.pool.query(
      `ALTER DATABASE "${name}" SET timezone TO 'Asia/Tokyo'`,
    )
  } catch (error) {
    await admin.pool.end()
    throw error
  }
  const connection = createDb(url.toString())
  return {
    ...connection,
    url: url.toString(),
    migrate() {
      return execFileSync('./node_modules/.bin/drizzle-kit', ['migrate'], {
        cwd: dbDirectory,
        env: { ...process.env, DATABASE_URL: url.toString(), TZ: 'UTC' },
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 30_000,
      })
    },
    async close() {
      await connection.pool.end()
      try {
        await admin.pool.query(`DROP DATABASE "${name}" WITH (FORCE)`)
      } finally {
        await admin.pool.end()
      }
    },
  }
}
