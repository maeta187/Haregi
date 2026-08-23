import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import { withUtcTimezone } from './connection-url.ts'
import * as schema from './schema.ts'
import { assertUtcTimezone } from './timezone.ts'

/**
 * PostgreSQL 接続プールと Drizzle クライアントを作る。
 *
 * プロセス終了時にプールを閉じる責務は呼び出し側(`apps/api` のシャットダウン処理)にある。
 *
 * **DB へ時刻を書き読みする唯一の入口としてタイムゾーンを検査する**(architecture.md §9)。
 * 呼び出し側の責務にすると、api・シード・保守スクリプトのどれか1つが呼び忘れただけで
 * 迂回でき、認証テーブルの期限カラム(タイムゾーンなし)がローカル時刻で書かれてしまう。
 */
export const createDb = (connectionString: string) => {
  assertUtcTimezone(process.env.TZ)

  // DB セッションのタイムゾーンも UTC に固定する。Node 側だけ UTC にしても、
  // 認証テーブルの `timestamp DEFAULT now()` は **DB 側のタイムゾーン**で
  // 壁時計化されるため、DB が JST ならそこでズレが入る(architecture.md §9)。
  // 接続文字列に仕込まれたタイムゾーン指定は取り除かれ、他の options は残る
  const pool = new Pool({ connectionString: withUtcTimezone(connectionString) })

  return { db: drizzle(pool, { schema }), pool }
}

export type Db = ReturnType<typeof createDb>['db']
