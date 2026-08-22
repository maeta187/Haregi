import { defineConfig } from 'drizzle-kit'

// drizzle-kit は独立したプロセスとして起動するため、リポジトリ直下の .env を自分で読む。
// CI やコンテナのように .env を置かない環境では、既に渡された環境変数をそのまま使う。
try {
  process.loadEnvFile('../../.env')
} catch {
  // .env が無い場合は何もしない
}

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
