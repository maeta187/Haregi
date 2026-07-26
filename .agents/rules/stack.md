# 技術スタック・依存管理ルール

確定スタック(architecture.md §1–2)から逸脱しない。代替ライブラリを提案・導入しない。

- モノレポ: pnpm workspace + Turborepo。パッケージスコープは `@haregi/*`
- フロント: TanStack Start v1 + React 19 + TypeScript 7 / Tailwind CSS v4 + shadcn/ui
- バック: Hono 4 + @hono/node-server(Node.js 常駐プロセス前提)
- 認証: Better Auth(email/password、Drizzle アダプタ)
- DB: PostgreSQL(Docker Compose)+ Drizzle ORM + drizzle-kit
- バリデーション: Zod(`packages/schema` でフロント/バック共有)
- API 型共有: Hono RPC(`hc<AppType>`)+ データ取得は TanStack Query。フォームは React Hook Form + `@hookform/resolvers`
- エラーハンドリング: neverthrow は **`apps/api` の `infrastructure` 層のみ**。`apps/web` には導入しない
- ロギング: pino(**`apps/api` のみ**。構造化ログ)
- API ドキュメント: `@hono/zod-openapi` + `@hono/swagger-ui`(`/api/doc`)。手動の仕様書を作らない
- Lint/Format: **oxlint + oxfmt のみ。ESLint・Prettier・prettier-plugin-tailwindcss を追加しない**(oxfmt が Tailwind クラスソート内蔵)
- テスト: Vitest。フロントエンド・バックエンドともに **TDD** で実装する(先にテスト→実装→リファクタ)
- コンポーネントテスト: `@testing-library/react` + `@testing-library/jest-dom`(`apps/web`)。E2E(Playwright 等)はスコープ外

## 配置ルール

- Zod スキーマ・地域マスタ・日付(JST)/気温整形ユーティリティ → `packages/schema`
- Drizzle スキーマ → `packages/db`(認証テーブルは Better Auth CLI 生成をベースに編集)
- `apps/api` → **軽量オニオン・機能優先**(`features/{auth,forecast,coordinate}/{domain,application,infrastructure,presentation}` + `shared/`。決定事項 #26。詳細は `api-design.md`)
- `apps/web` → **機能優先スライス**(`routes/` / `features/*/{components,hooks,api,model}` / `components/ui/` / `lib/`。決定事項 #28。詳細は `ui-web.md`)
- 気象庁 JSON の取得・整形 → `apps/api` の `features/forecast/` 内に隔離(正規化は `domain`、取得・キャッシュは `infrastructure`。非公式 API のため差し替え可能に保つ)
- 地域マスタは `master-data/areas.ts`(検証済み・全58区分)を移植する。**再生成しない**

## 依存の更新

- 立ち上げ時に動作確認済みの組み合わせを lockfile ごと commit で固定する
- パッケージ更新は **必ず1パッケージずつ**(全レイヤーが新しいため、問題の切り分けを可能に保つ)

## 未定事項(勝手に決めない)

- **デプロイ先**(決定事項 #23): 明示的保留。インメモリキャッシュと web→api の2プロセス+プロキシは Node 常駐プロセス前提であり、サーバーレスを選ぶ場合は再設計が必要
- **画像ストレージの契約先**(決定事項 #17): S3 互換 API 前提でコードを書く。ローカルは MinIO(Docker)。契約先(R2 / S3 等)は Should 着手時に決定し、その際 **presigned POST 対応(サイズ上限・Content-Type 制限の強制可否)**を確認する

## 非スコープ(提案・導入しない)

BaaS(Supabase 等)/ Storybook / Husky・lint-staged / GitHub Actions CI / メール送信を伴う機能(パスワードリセット・メール検証)/ パスワード忘失時の救済手段 / ソーシャルログイン / E2E テスト
