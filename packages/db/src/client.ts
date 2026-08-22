import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from './schema.ts'

/**
 * PostgreSQL 接続プールと Drizzle クライアントを作る。
 *
 * プロセス終了時にプールを閉じる責務は呼び出し側(`apps/api` のシャットダウン処理)にある。
 */
export const createDb = (connectionString: string) => {
  const pool = new Pool({ connectionString })

  return { db: drizzle(pool, { schema }), pool }
}

export type Db = ReturnType<typeof createDb>['db']
