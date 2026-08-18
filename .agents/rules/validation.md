# バリデーションルール

## 入力ルール(specification.md §4 を厳守)

| 項目 | ルール |
| --- | --- |
| ユーザー名(表示名) | 必須 / **trim 後1〜20文字 / 文字種の制限なし(日本語可)** / **一意制約なし**(ログイン ID はメール) |
| メールアドレス | 必須 / メール形式 |
| 登録地域(areaCode) | 必須 / 地域マスタ(気象庁 府県予報区・全58区分)に実在するコード |
| パスワード | 必須 / 8〜20文字 / 小文字英字と数字を含む |
| パスワード確認 | パスワードと一致(フロントのみ) |
| コーデ各項目(outerwear/tops/bottoms) | 任意 / **前後の空白を除去した上で最大50文字** |
| コーデ保存の `snapshotId` | 任意 / `GET /api/forecast` が返した**予報世代 ID**。気温スナップショットの基準(決定事項 #30)。`areaCode` は送らない |
| コーデ保存の `items` | **最大7件** / **リクエスト内で日付が重複していたら 400**(先勝ち等の暗黙処理をしない) |
| コーデ保存の `updatedAt` | 任意(既存レコードの更新時は読み込み時の値を送る)/ DB の値と不一致なら **409**(決定事項 #32)。新規作成時は送らない |
| コーデ保存の `date` | 必須 / JST の `YYYY-MM-DD` 形式 / **実在する暦日**(`2026-02-30` 等は不正)/ **今日から前後1年以内** |

- エラーメッセージは日本語

## 実施場所

- フロント(React Hook Form + Zod resolver)は **UX 用**。防御はサーバー側が担う
- 通常 API は `@hono/zod-validator` + `packages/schema` の Zod スキーマで検証(フロントと同一スキーマを共有。二重定義しない)
- **`/api/auth/*` は zValidator を通らない**。**signup / updateUser / changePassword** の入力検証(パスワード文字種・areaCode 実在・ユーザー名形式)は Better Auth の **`hooks.before`** で必ず強制する。パスワード長(8〜20)は `minPasswordLength` / `maxPasswordLength` に任せる
- `PUT /api/coordinates` の `items` は **最大7件**・**日付重複禁止**・**実在する暦日**・**保存可能範囲(今日から前後1年)**をスキーマで強制する
- **空のコーデは作らない**。3項目を trim した上ですべて空の item は、upsert ではなく**その日付のレコードを削除**する(specification.md §4)
- 気温スナップショット(`maxTemperature` / `minTemperature`)は**クライアントから受け取らない**。サーバーがリクエストの **`snapshotId`(画面に表示していた予報の世代。決定事項 #30)**が指すキャッシュから書き込む(予報範囲外・取得失敗時は null)
- **`snapshotId` が送られない/失効している保存では、既存の気温・由来(`areaCode` / `tempStation` / `forecastIssuedAt` / `snapshotStatus`)をそのまま維持する**(過去日の文言修正で蓄積データを失わない。決定事項 #31)
