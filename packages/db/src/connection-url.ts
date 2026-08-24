/**
 * 接続文字列の `options` の末尾に「DB セッションを UTC に固定する」指定を置く。
 *
 * Node 側の `TZ` を UTC にしても、**DB セッションのタイムゾーンは DB の既定値**に
 * なるため、認証テーブルの `timestamp DEFAULT now()` がそこでズレる(architecture.md §9)。
 *
 * libpq の `options` は**後勝ち**なので、`?options=-c timezone=Asia/Tokyo` を
 * 仕込まれていても、末尾に `-c timezone=UTC` を置けば UTC になる(実 DB で確認済み)。
 *
 * **既存の指定を消さない**。`options` は `-c name=value` / `-cname=value` /
 * `--name=value` を取り、値の中に任意の文字列が入りうる。文字列置換で消しにかかると
 * `-c application_name=worker-ctimezone=foo` のような正当な値まで壊す一方、
 * 長形式は取りこぼす。**末尾に置くだけで保証は足りる**ため、何も削らない。
 */
export const withUtcTimezone = (connectionString: string): string => {
  if (!URL.canParse(connectionString)) {
    throw new Error(
      'DATABASE_URL は URL 形式(postgresql://…)で指定してください。' +
        'DB セッションのタイムゾーンを UTC に固定できません。',
    )
  }

  const url = new URL(connectionString)
  // node-postgres は重複したパラメータの**最後**を採用する。`get()` は最初を返すため、
  // それを土台にすると実際に効いていた設定を捨てて別の接続設定にしてしまう
  const existing = url.searchParams.getAll('options').at(-1)

  url.searchParams.set(
    'options',
    existing ? `${existing} -c timezone=UTC` : '-c timezone=UTC',
  )

  return url.toString()
}
