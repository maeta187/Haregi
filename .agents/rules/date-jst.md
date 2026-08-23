# 日付・タイムゾーンルール

- **暦日**(ユーザーが選ぶ日付)はすべて **JST 固定の `YYYY-MM-DD` 文字列**として扱う。API 境界・DB(`date` カラム)・URL パラメータ・コンポーネント間で `Date` オブジェクトを渡さない
- 「今日」の判定・コーデ upsert キー・気象庁 JSON の `timeDefines`(+09:00)はすべて JST 基準で解決する。サーバーの実行タイムゾーン(UTC 等)に依存するコード(`new Date()` からのローカル日付切り出し等)を書かない
- **この規定の対象は「暦日」**(ユーザーが選ぶ日付。コーデの `date`、履歴の `from` / `to`)。DB は `date` 型・Drizzle は `mode: 'string'` で持つ
- **「絶対時刻」は別扱い**。予報発表時刻・取得時刻・レコードの作成/更新時刻は時点を指す値であり、`timestamptz` + `Date` で扱う(architecture.md §4 / §9)。絶対時刻まで `YYYY-MM-DD` 文字列にしない
- **DB に時刻を書き読みするプロセスは `TZ=UTC` で起動する**(api・シード・マイグレーション・DB に触れるテスト)。認証テーブルの期限カラムは Better Auth CLI 生成物でタイムゾーンを持たず、Node 側のローカル TZ で解釈されるため、プロセス間で TZ が違うと期限判定がずれる。各スクリプトで `TZ=UTC` を注入し、起動時に `assertUtcTimezone(process.env.TZ)`(`packages/db`)で **fail-fast** する(architecture.md §9)。`.env.example` への記載は実効性を持たない
- **`packages/schema` の日付ユーティリティのテストは `TZ=UTC` を強制しない**。意図的に別の TZ で回して JST 判定の正しさを確認するため
- 日付ユーティリティは `packages/schema` に置き、必ず Vitest のテスト対象にする
- 画面表示は `YYYY年M月D日`、気温は `℃` 表示
