# 日付・タイムゾーンルール

- **暦日**(ユーザーが選ぶ日付)はすべて **JST 固定の `YYYY-MM-DD` 文字列**として扱う。API 境界・DB(`date` カラム)・URL パラメータ・コンポーネント間で `Date` オブジェクトを渡さない
- 「今日」の判定・コーデ upsert キー・気象庁 JSON の `timeDefines`(+09:00)はすべて JST 基準で解決する。サーバーの実行タイムゾーン(UTC 等)に依存するコード(`new Date()` からのローカル日付切り出し等)を書かない
- **この規定の対象は「暦日」**(ユーザーが選ぶ日付。コーデの `date`、履歴の `from` / `to`)。DB は `date` 型・Drizzle は `mode: 'string'` で持つ
- **「絶対時刻」は別扱い**。予報発表時刻・取得時刻・レコードの作成/更新時刻は時点を指す値であり、`timestamptz` + `Date` で扱う(architecture.md §4 / §9)。絶対時刻まで `YYYY-MM-DD` 文字列にしない
- **DB に時刻を書き読みするプロセスは `TZ=UTC` で起動する**(api・シード・マイグレーション・DB に触れるテスト)。認証テーブルの期限カラムは Better Auth CLI 生成物でタイムゾーンを持たず、Node 側のローカル TZ で解釈されるため、プロセス間で TZ が違うと期限判定がずれる(architecture.md §9)
- **検査は `createDb()`(`packages/db`)の内側にある**。接続プールを作る前に `assertUtcTimezone(process.env.TZ)` を呼ぶため、`createDb()` を使う限り迂回できない。**呼び出し側で個別に呼ぶ設計にしない**(1箇所の呼び忘れで穴が開く)。`createDb()` を通らない drizzle-kit は `drizzle.config.ts` 側で同じ検査を行う
- **DB セッションのタイムゾーンも UTC に固定する**。Node 側だけ UTC にしても、`timestamp DEFAULT now()` は DB 側のタイムゾーンで壁時計化されるため、DB が JST なら同じズレが入る
- **固定は `withUtcTimezone()` が接続文字列の `options` の末尾に `-c timezone=UTC` を置くことで行う**。libpq の `options` は後勝ちなので、`?options=-c timezone=Asia/Tokyo` が仕込まれていても打ち消せる。**既存の指定は削らない** — 文字列置換で消しにかかると `-c application_name=worker-ctimezone=foo` のような正当な値を壊し、かつ `--timezone=` の長形式は取りこぼすため。`createDb()` と `drizzle.config.ts` の両方がこの関数を通る
- 各スクリプトには `TZ=UTC` を注入する。**`.env.example` への記載は実効性を持たない**(自動では読まれない)
- **`packages/schema` の日付ユーティリティのテストは `TZ=UTC` を強制しない**。意図的に別の TZ で回して JST 判定の正しさを確認するため。ただし親環境の TZ に偶然依存しないよう、**`TZ=UTC` と `TZ=Asia/Tokyo` の明示的なマトリクスで実行する**
- 日付ユーティリティは `packages/schema` に置き、必ず Vitest のテスト対象にする
- 画面表示は `YYYY年M月D日`、気温は `℃` 表示
