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

- エラーメッセージは日本語

## 実施場所

- フロント(React Hook Form + Zod resolver)は **UX 用**。防御はサーバー側が担う
- 通常 API は `@hono/zod-validator` + `packages/schema` の Zod スキーマで検証(フロントと同一スキーマを共有。二重定義しない)
- **`/api/auth/*` は zValidator を通らない**。signup / updateUser の入力検証(パスワード文字種・areaCode 実在・ユーザー名形式)は Better Auth の **`hooks.before`** で必ず強制する
- `PUT /api/coordinates` の `items` は **最大7件**をスキーマで強制する
- 気温スナップショット(`maxTemperature` / `minTemperature`)は**クライアントから受け取らない**。サーバーが登録地域の予報キャッシュから書き込む(予報範囲外は null)
