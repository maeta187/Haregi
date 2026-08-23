/**
 * 接続文字列に「DB セッションを UTC に固定する」オプションを付ける。
 *
 * drizzle-kit は接続を自分で組み立てるため `createDb()` を通らない。
 * Node 側の `TZ` を UTC にしても、**DB セッションのタイムゾーンは DB の既定値**に
 * なるため、時刻を評価するマイグレーションを将来足したときに同じズレが入る
 * (architecture.md §9)。libpq の `options` は後勝ちなので、仕込まれていても上書きする。
 */
export const withUtcTimezone = (connectionString: string): string => {
  if (!URL.canParse(connectionString)) {
    throw new Error(
      'DATABASE_URL は URL 形式(postgresql://…)で指定してください。' +
        'DB セッションのタイムゾーンを UTC に固定できません。',
    )
  }

  const url = new URL(connectionString)
  url.searchParams.set('options', '-c timezone=UTC')

  return url.toString()
}
