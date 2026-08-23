import { defineConfig } from 'drizzle-kit'

import { assertUtcTimezone } from './src/timezone.ts'

// drizzle-kit は独立したプロセスとして起動するため、リポジトリ直下の .env を自分で読む。
// CI やコンテナのように .env を置かない環境では、既に渡された環境変数をそのまま使う。
try {
  process.loadEnvFile('../../.env')
} catch (error) {
  // ファイルが無いだけなら既存の環境変数で続行する。権限エラーや壊れた .env まで
  // 握り潰すと、意図しない接続先へマイグレーションを当てかねないため区別する
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
    throw error
  }
}

// 認証テーブルの期限カラムはタイムゾーンを持たないため、マイグレーションも
// UTC で実行する(architecture.md §9)。設定漏れは黙って通さず、ここで落とす
assertUtcTimezone(process.env.TZ)

const url = process.env['DATABASE_URL']

if (!url) {
  throw new Error('DATABASE_URL が設定されていません(.env.example を参照)')
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
})
