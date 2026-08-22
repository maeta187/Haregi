import {
  date,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

import { user } from './auth-schema.ts'

export {
  account,
  accountRelations,
  session,
  sessionRelations,
  user,
  userRelations,
  verification,
} from './auth-schema.ts'

/**
 * 日ごとのコーディネート。ユーザー×日付で一意(upsert 前提)。
 *
 * 気温スナップショット(`maxTemperature` / `minTemperature`)とその由来は、
 * 保存時にサーバーが `snapshotId` の指す予報世代から書き込む。クライアントからは受け取らない。
 */
export const coordinate = pgTable(
  'coordinate',
  {
    id: serial('id').primaryKey(),
    // JST 固定の `YYYY-MM-DD` 文字列として扱う(Date オブジェクトを境界越しに渡さない)
    date: date('date', { mode: 'string' }).notNull(),
    outerwear: text('outerwear').notNull().default(''),
    tops: text('tops').notNull().default(''),
    bottoms: text('bottoms').notNull().default(''),
    // コーデ写真のオブジェクトキー(Should 機能。写真なしは null)
    imageKey: text('image_key'),
    // 記録時点の予報気温スナップショット(表示中の地域基準。予報範囲外・取得失敗時は null)
    maxTemperature: real('max_temperature'),
    minTemperature: real('min_temperature'),
    // 気温スナップショットの由来。気温値だけでは後から出どころを説明できないため併せて保存する
    areaCode: text('area_code'),
    tempStation: text('temp_station'),
    forecastIssuedAt: timestamp('forecast_issued_at'),
    // 'fresh' | 'stale' | 'unavailable'
    snapshotStatus: text('snapshot_status'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // 楽観ロックのトークン。条件付き更新の中で `version = version + 1` する。
    // wall-clock 値(updatedAt)は精度内の同値・時計の逆行でトークンとして成立しないため使わない
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    // 監査用。楽観ロックには使わない
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.date)],
)

/**
 * 予報世代。`GET /api/forecast` が発行し、`PUT /api/coordinates` が `snapshotId` で引き当てる。
 *
 * プロセス再起動・複数インスタンスでも解決できるよう、インメモリキャッシュではなく DB に永続化する。
 * 保持は24時間だが、失効の判定は引き当てクエリの条件(`created_at > now() - interval '24 hours'`)で行い、
 * 行の掃除は容量管理として別に走らせる。
 */
export const forecastSnapshot = pgTable('forecast_snapshot', {
  snapshotId: text('snapshot_id').primaryKey(),
  areaCode: text('area_code').notNull(),
  forecastIssuedAt: timestamp('forecast_issued_at').notNull(),
  fetchedAt: timestamp('fetched_at').notNull(),
  // 'fresh' | 'stale'
  status: text('status').notNull(),
  // 正規化済みの Forecast(気象庁の生 JSON は入れない)
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
