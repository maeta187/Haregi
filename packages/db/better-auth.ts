import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

/**
 * Better Auth CLI(`npx @better-auth/cli generate`)に認証テーブルの形を伝えるためだけの設定。
 * 実行時には使わない(実際の auth インスタンスはフェーズ4a で
 * `apps/api/src/features/auth/infrastructure/auth.ts` に作る)。
 *
 * フェーズ4a で api 側の設定ができたら、このファイルは削除し、
 * CLI は `--config` で api 側を指すようにする(設定の二重管理を残さないため)。
 */
export const auth = betterAuth({
  database: drizzleAdapter({}, { provider: 'pg' }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 20,
  },
  user: {
    additionalFields: {
      areaCode: { type: 'string', required: true, input: true },
    },
  },
})
