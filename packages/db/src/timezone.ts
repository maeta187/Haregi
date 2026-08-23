/**
 * Node プロセスのタイムゾーンが UTC であることを確認する。
 *
 * 認証テーブル(`auth-schema.ts`)の期限カラムは Better Auth CLI の生成物で
 * `timestamp without time zone` のため、**書き込むプロセスと読み込むプロセスの
 * タイムゾーンが違うと、その差がそのまま期限のズレになる**(architecture.md §9)。
 * 設定漏れを黙って動かさず、起動の時点で落とす。
 *
 * DB へ時刻を書き込む・読み込む経路(api の起動・シード・マイグレーション)で呼ぶ。
 * 日付ユーティリティのテストのように、意図的に別のタイムゾーンで動かす経路では呼ばない。
 */
export const assertUtcTimezone = (timeZone: string | undefined): void => {
  if (timeZone === 'UTC') {
    return
  }

  throw new Error(
    `TZ=UTC で起動してください(現在: ${timeZone ?? '未設定'})。` +
      '認証テーブルの期限カラムはタイムゾーンを持たないため、' +
      'プロセスごとにタイムゾーンが違うとセッションの期限判定がずれます。',
  )
}
