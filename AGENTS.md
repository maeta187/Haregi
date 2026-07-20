# Haregi(ハレギ)

天気予報(気温)を見ながら日ごとの服装コーデを記録する Web アプリ。pnpm workspace + Turborepo のモノレポで、TanStack Start(web)+ Hono(api)+ Drizzle/PostgreSQL 構成。

- 要件(何を作るか): @docs/specification.md
- 技術設計(スタック・データモデル・API・認証): @docs/architecture.md

## 現在の状態

設計確定済み・実装はこれから。`docs/` と検証済みの地域マスタ(`master-data/`)のみ存在する。実装は architecture.md §10 の立ち上げ手順(骨組み → packages/schema → packages/db → apps/api → apps/web)に従って進める。

## リポジトリ構成(計画)

- `apps/web`: TanStack Start + React 19 + Tailwind v4 + shadcn/ui。API 呼び出しは Hono RPC(`hc<AppType>`)+ TanStack Query
- `apps/api`: Hono + Better Auth + neverthrow(neverthrow は api のみ。web には導入しない)
- `packages/db`: Drizzle スキーマ(認証テーブルは Better Auth CLI 生成がベース)
- `packages/schema`: Zod スキーマ・地域マスタ・日付/気温ユーティリティ(フロント/バックで共有)
- `master-data/`: 生成・検証済みの気象庁地域マスタ。`areas.ts` は packages/schema へ、`validate-areas.mjs` は `apps/api/scripts/validate-areas.ts` へ移植する(再生成せずこれを使う)

## コマンド(ルート・計画)

- `pnpm docker`: PostgreSQL 起動
- `pnpm dev`: web(:3000)+ api(:3001)を並行起動。web が `/api/*` を api へプロキシ
- `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:seed`: drizzle-kit / シード
- `pnpm lint` / `pnpm format`: oxlint / oxfmt(ESLint・Prettier は使わない)
- `pnpm typecheck` / `pnpm test`: tsc / Vitest

## 絶対に守る規約

- **全てのやりとりは日本語で行う**
- **日付は JST 固定の `YYYY-MM-DD` 文字列**。`Date` オブジェクトを API・DB・コンポーネント境界越しに渡さない
- **サーバー側バリデーション**: `/api/auth/*` は zValidator を通らないため、signup / updateUser の入力検証は Better Auth の `hooks.before` で行う(フロントの Zod 検証は UX 用であり防御ではない)
- コーデの気温スナップショット(`maxTemperature` / `minTemperature`)はサーバー側が予報キャッシュから書き込む。クライアントから受け取らない
- 気象庁の予報は改変せず表示し、「出典: 気象庁ホームページ」を常時表示する(法的要件)
- 依存パッケージの更新は **1パッケージずつ**(全レイヤーが新しいため切り分け可能に保つ)

## 注意事項

- 気象庁 JSON は `[短期予報, 週間予報]` の2要素配列で、天気は区域単位・気温はアメダス地点単位とキーが異なる。週間予報は翌日始まり・空文字 `""` の欠損あり。奄美(460040)と十勝(014030)は自分の JSON を持たず親区分に同居する — 解決ロジックは地域マスタの `forecastCode` / `weatherArea` / `weeklyArea` / `tempStation` に集約済みで、取得・整形は api 内の1モジュールに隔離する
- 予報キャッシュはインメモリ前提(Node 常駐プロセス)。サーバーレスへのデプロイを検討する際は要再設計(architecture.md 決定事項 #23)
- 予報取得失敗(502)でもコーデ入力・保存は継続できること(スナップショットは null)
- テストユーザー: `admin@example.com` / `password123` / 地域 `130000`
