# バリデーションルール

## 入力ルール(specification.md §4 を厳守)

| 項目 | ルール |
| --- | --- |
| ユーザー名(表示名) | 必須 / 8文字以上 / 英数字のみ / **一意制約なし**(ログイン ID はメール) |
| メールアドレス | 必須 / メール形式 |
| 登録地域(areaCode) | 必須 / 地域マスタ(気象庁 府県予報区・全58区分)に実在するコード |
| パスワード | 必須 / 8〜20文字 / 小文字英字と数字を含む |
| パスワード確認 | パスワードと一致(フロントのみ) |
| コーデ各項目(outerwear/tops/bottoms) | 任意 / 最大50文字程度 |
| コーデ保存の `areaCode`(表示中の地域) | 必須 / 地域マスタに実在するコード(気温スナップショットの基準。決定事項 #29) |
| コーデ保存の `date` | 必須 / JST の `YYYY-MM-DD` 形式 |

- エラーメッセージは日本語

## 実施場所

- フロント(React Hook Form + Zod resolver)は **UX 用**。防御はサーバー側が担う
- 通常 API は `@hono/zod-validator` + `packages/schema` の Zod スキーマで検証(フロントと同一スキーマを共有。二重定義しない)
- **`/api/auth/*` は zValidator を通らない**。**signup / updateUser / changePassword** の入力検証(パスワード文字種・areaCode 実在・ユーザー名形式)は Better Auth の **`hooks.before`** で必ず強制する。パスワード長(8〜20)は `minPasswordLength` / `maxPasswordLength` に任せる
- `PUT /api/coordinates` の `items` は **最大7件**をスキーマで強制する
- 気温スナップショット(`maxTemperature` / `minTemperature`)は**クライアントから受け取らない**。サーバーがリクエストの `areaCode`(**画面で表示中の地域**。決定事項 #29)をマスタ照合し、その地域の予報キャッシュから書き込む(予報範囲外・取得失敗時は null)
