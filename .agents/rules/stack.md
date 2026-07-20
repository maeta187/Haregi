# 技術スタック・依存管理ルール

確定スタック(architecture.md §1–2)から逸脱しない。代替ライブラリを提案・導入しない。

- モノレポ: pnpm workspace + Turborepo。パッケージスコープは `@haregi/*`
- フロント: TanStack Start v1 + React 19 + TypeScript 7 / Tailwind CSS v4 + shadcn/ui
- バック: Hono 4 + @hono/node-server(Node.js 常駐プロセス前提)
- 認証: Better Auth(email/password、Drizzle アダプタ)
- DB: PostgreSQL(Docker Compose)+ Drizzle ORM + drizzle-kit
- バリデーション: Zod(`packages/schema` でフロント/バック共有)
- エラーハンドリング: neverthrow は **`apps/api` のみ**。`apps/web` には導入しない
- Lint/Format: **oxlint + oxfmt のみ。ESLint・Prettier・prettier-plugin-tailwindcss を追加しない**(oxfmt が Tailwind クラスソート内蔵)
- テスト: Vitest。E2E(Playwright 等)はスコープ外

## 配置ルール

- Zod スキーマ・地域マスタ・日付(JST)/気温整形ユーティリティ → `packages/schema`
- Drizzle スキーマ → `packages/db`(認証テーブルは Better Auth CLI 生成をベースに編集)
- 気象庁 JSON の取得・整形 → `apps/api` 内の1モジュールに隔離(非公式 API のため差し替え可能に保つ)
- 地域マスタは `master-data/areas.ts`(検証済み・全58区分)を移植する。**再生成しない**

## 依存の更新

- 立ち上げ時に動作確認済みの組み合わせを lockfile ごと commit で固定する
- パッケージ更新は **必ず1パッケージずつ**(全レイヤーが新しいため、問題の切り分けを可能に保つ)

## 非スコープ(提案・導入しない)

BaaS(Supabase 等)/ Storybook / Husky・lint-staged / GitHub Actions CI / メール送信機能 / ソーシャルログイン / E2E テスト
