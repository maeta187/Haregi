import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

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
/**
 * 接続文字列に `options` が入っていないことを確認する。
 *
 * libpq の `options` は接続時に渡すオプションより**後勝ち**になるため、
 * `?options=-c timezone=Asia/Tokyo` を仕込まれると下の UTC 固定が黙って外れる。
 * 接続の設定は `createDb()` に集約し、URL から差し込む経路を塞ぐ。
 */
const assertNoConnectionOptions = (connectionString: string): void => {
  const hasOptions = URL.canParse(connectionString)
    ? new URL(connectionString).searchParams.has('options')
    : /(^|[?&\s])options=/.test(connectionString)

  if (hasOptions) {
    throw new Error(
      '接続文字列に options を含めないでください。' +
        'DB セッションのタイムゾーン(UTC 固定)を上書きしてしまいます。',
    )
  }
}

export const createDb = (connectionString: string) => {
  assertUtcTimezone(process.env.TZ)
  assertNoConnectionOptions(connectionString)

  // DB セッションのタイムゾーンも UTC に固定する。Node 側だけ UTC にしても、
  // 認証テーブルの `timestamp DEFAULT now()` は **DB 側のタイムゾーン**で
  // 壁時計化されるため、DB が JST ならそこでズレが入る(architecture.md §9)
  const pool = new Pool({ connectionString, options: '-c timezone=UTC' })

  return { db: drizzle(pool, { schema }), pool }
}

export type Db = ReturnType<typeof createDb>['db']
