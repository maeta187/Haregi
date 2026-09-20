import { fileURLToPath } from 'node:url'
import config from '../../../../../packages/db/drizzle.config.ts'

// 本番の設定・接続 URL をそのまま使い、検査用マイグレーションの場所だけ差し替える。
export default {
  ...config,
  out:
    process.env['HAREGI_TEST_DRIZZLE_OUT'] ??
    fileURLToPath(new URL('./timezone-migrations/', import.meta.url)),
  migrations: { schema: 'timezone_probe_migrations' },
}
