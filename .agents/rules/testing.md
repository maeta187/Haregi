# テストルール(Vitest)

必須のテスト対象:

- `packages/schema`: Zod バリデーションスキーマ / 地域マスタ(コードの一意性・形式)/ 日付(JST)・気温整形ユーティリティ
- `apps/api`: 気象庁 JSON → `Forecast` 型への正規化(短期・週間の統合、欠損 `""`、奄美・十勝の親区分解決を含む)/ キャッシュ動作 / 認証ミドルウェアの 401 応答

方針:

- UI テスト・E2E は今回スコープ外。追加を提案しない
- lint / format / typecheck / test は手動実行(`pnpm lint` / `pnpm format` / `pnpm typecheck` / `pnpm test`)。Husky 等の Git フックを追加しない
- シードは Better Auth の `auth.api.signUpEmail` 経由で作成する(ハッシュ形式を揃えるため DB へ直接 INSERT しない)。テストユーザー: `admin@example.com` / `password123` / 地域 `130000`
