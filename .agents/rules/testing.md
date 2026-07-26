# テストルール(Vitest・TDD)

## TDD(必須)

フロントエンド・バックエンドともに **TDD(テスト駆動開発)** で実装する。実装前に失敗するテストを書き(Red)→ 実装して通す(Green)→ 必要ならリファクタリング(Refactor)、のサイクルを各層・各コンポーネントで回す。テストを後追いで書かない。

必須のテスト対象:

- `packages/schema`: Zod バリデーションスキーマ(境界値)/ 地域マスタ(コードの一意性・形式)/ 日付(JST)・気温整形ユーティリティ(**`TZ=UTC` でも JST 判定が正しいこと**)
- `apps/api`
  - `domain`: 気象庁 JSON → `Forecast` 型への正規化(短期・週間の統合、欠損 `""`、奄美・十勝の親区分解決)/ コーデのビジネスルール(items 上限)/ 気温スナップショットの決定(予報範囲外は null)
  - `application`: ユースケース。infrastructure の `Result` → 型付きアプリケーションエラーへの変換 / **気温スナップショットが指定 `areaCode`(表示中の地域)の予報から解決されること**
  - `infrastructure`: 地域コード単位のキャッシュ動作 / 一括 upsert のトランザクション(部分失敗時に全件ロールバック)
  - `presentation`: 認証ミドルウェアの 401 応答 / エラー → HTTP ステータス(400 / 502 等)のマッピング
- `apps/web`: `@testing-library/react` + `@testing-library/jest-dom` によるコンポーネントテスト。`components/` は props のみの純粋コンポーネントとして、`hooks/` は `features/*/api/` をモックしてテストする(決定事項 #28)。必須ケース: フォームバリデーション表示 / 保護ルートの未認証リダイレクト / 予報取得失敗時のエラー表示+再試行 / **予報が取れなくてもコーデを保存できること** / 出典表記の常時表示

方針:

- **コンポーネントテストはスコープ内。E2E(Playwright 等)は今回スコープ外**。E2E の追加を提案しない
- lint / format / typecheck / test は手動実行(`pnpm lint` / `pnpm format` / `pnpm typecheck` / `pnpm test`)。Husky 等の Git フックを追加しない
- シードは Better Auth の `auth.api.signUpEmail` 経由で作成する(ハッシュ形式を揃えるため DB へ直接 INSERT しない)。テストユーザー: `admin@example.com` / `password123` / 地域 `130000`
