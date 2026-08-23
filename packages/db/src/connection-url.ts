/** libpq の `options` から `timezone` の指定だけを取り除く(`-c timezone=…` / `-ctimezone=…`) */
const stripTimezone = (options: string): string =>
  options
    .replace(/-c\s*timezone=\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * 接続文字列の `options` を正規化し、DB セッションを UTC に固定する。
 *
 * Node 側の `TZ` を UTC にしても、**DB セッションのタイムゾーンは DB の既定値**に
 * なるため、認証テーブルの `timestamp DEFAULT now()` がそこでズレる(architecture.md §9)。
 *
 * libpq の `options` は**後勝ち**なので、`?options=-c timezone=Asia/Tokyo` を
 * 仕込まれると固定が黙って外れる。タイムゾーンの指定だけを取り除き、
 * `statement_timeout` などの正当な設定は残したうえで、末尾に UTC を置く。
 */
export const withUtcTimezone = (connectionString: string): string => {
  if (!URL.canParse(connectionString)) {
    throw new Error(
      'DATABASE_URL は URL 形式(postgresql://…)で指定してください。' +
        'DB セッションのタイムゾーンを UTC に固定できません。',
    )
  }

  const url = new URL(connectionString)
  const kept = stripTimezone(url.searchParams.get('options') ?? '')

  url.searchParams.set(
    'options',
    kept ? `${kept} -c timezone=UTC` : '-c timezone=UTC',
  )

  return url.toString()
}
