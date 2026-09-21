import { inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

/**
 * Better Auth のクライアント。
 *
 * `areaCode` は user の additionalField(architecture.md §7)であり、
 * `inferAdditionalFields` で型を付けないと signUp / updateUser で渡せない。
 * サーバーの `auth` インスタンスを型 import すると web の型検査に api の
 * 内部依存(Drizzle・pg)が乗るため、フィールド定義を明示する形をとる。
 *
 * baseURL は指定しない。web(:3000)が `/api/*` を api(:4000)へプロキシするため、
 * 同一オリジンの `/api/auth` を叩けば Cookie がそのまま載る。
 */
export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        areaCode: { type: 'string', required: true, input: true },
      },
    }),
  ],
})

export type SessionUser = typeof authClient.$Infer.Session.user
