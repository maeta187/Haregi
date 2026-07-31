# Haregi(ハレギ)

天気予報(気温)を見ながら日ごとの服装コーデを記録する Web アプリ。pnpm workspace + Turborepo のモノレポで、TanStack Start(web)+ Hono(api)+ Drizzle/PostgreSQL 構成。

- 要件(何を作るか): @docs/specification.md
- 技術設計(スタック・データモデル・API・認証): @docs/architecture.md
- 実装計画(フェーズ分割・進め方): @docs/implementation-plan.md

## 現在の状態

設計確定済み・実装はこれから。`docs/` と検証済みの地域マスタ(`master-data/`)のみ存在する。実装は implementation-plan.md のフェーズ順(環境構築 → packages/schema → packages/db → 機能ごとの垂直スライス)に従って進める。**フロント/バックともに TDD**(先にテスト → 実装 → リファクタ)。

## リポジトリ構成(計画)

- `apps/web`: TanStack Start + React 19 + Tailwind v4 + shadcn/ui。API 呼び出しは Hono RPC(`hc<AppType>`)+ TanStack Query。**機能優先スライス**(`routes/` / `features/*/{components,hooks,api,model}`。決定事項 #28)
- `apps/api`: Hono + Better Auth + neverthrow。**軽量オニオン・機能優先**(`features/*/{domain,application,infrastructure,presentation}` + `shared/`。決定事項 #26)。neverthrow は api の infrastructure 層のみ(web には導入しない)
- `packages/db`: Drizzle スキーマ(認証テーブルは Better Auth CLI 生成がベース)
- `packages/schema`: Zod スキーマ・地域マスタ・日付/気温ユーティリティ(フロント/バックで共有)
- `master-data/`: 生成・検証済みの気象庁地域マスタ。`areas.ts` は packages/schema へ、`validate-areas.mjs` は `apps/api/scripts/validate-areas.ts` へ移植する(再生成せずこれを使う)

## コマンド(ルート・計画)

- `pnpm docker`: PostgreSQL 起動
- `pnpm dev`: web(:3000)+ api(:3001)を並行起動。web が `/api/*` を api へプロキシ
- `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:seed`: drizzle-kit / シード
- `pnpm lint` / `pnpm format`: oxlint / oxfmt(ESLint・Prettier は使わない)
- `pnpm typecheck` / `pnpm test`: tsc / Vitest

## エージェント設定(ルール・スキル)

**正(ソース・オブ・トゥルース)は `.agents/` 側**。ツール非依存の共通配置であり、Codex はここを直接読む。Claude Code は `.claude/` しか探索しないため、同期スクリプトでコピーする。

```
.agents/rules/   → .claude/rules/haregi/   (git 管理: .agents 側のみ)
.agents/skills/  → .claude/skills/         (git 管理: skills-lock.json のみ)
```

- 同期: **`./scripts/sync-agent-config.sh`**(`--dry-run` で確認のみ)。`.agents/` 側を編集したら実行する
- **`.claude/` 配下のコピーは生成物**。gitignore 済みで、直接編集しても次回の同期で失われる。変更は必ず `.agents/` 側に加える
- スキル本体はコミットしない。クローン後は `skills-lock.json` を元に各自のローカルへ復元してから同期する

## 絶対に守る規約

- **全てのやりとりは日本語で行う**
- **日付は JST 固定の `YYYY-MM-DD` 文字列**。`Date` オブジェクトを API・DB・コンポーネント境界越しに渡さない
- **サーバー側バリデーション**: `/api/auth/*` は zValidator を通らないため、signup / updateUser / changePassword の入力検証は Better Auth の `hooks.before` で行う(フロントの Zod 検証は UX 用であり防御ではない)
- コーデの気温スナップショット(`maxTemperature` / `minTemperature`)はサーバー側が**リクエストの `areaCode`(画面で表示中の地域)**の予報キャッシュから書き込む。気温値をクライアントから受け取らない(決定事項 #29)
- 気象庁の予報は改変せず表示し、「出典: 気象庁ホームページ」を常時表示する(法的要件)
- 依存パッケージの更新は **1パッケージずつ**(全レイヤーが新しいため切り分け可能に保つ)

## 注意事項

- 気象庁 JSON は `[短期予報, 週間予報]` の2要素配列で、天気は区域単位・気温はアメダス地点単位とキーが異なる。週間予報は翌日始まり・空文字 `""` の欠損あり。奄美(460040)と十勝(014030)は自分の JSON を持たず親区分に同居する — 解決ロジックは地域マスタの `forecastCode` / `weatherArea` / `weeklyArea` / `tempStation` に集約済みで、取得・整形は api の `features/forecast/` 内に隔離する(正規化は `domain`、取得・キャッシュは `infrastructure`)
- 予報キャッシュはインメモリ前提(Node 常駐プロセス)。サーバーレスへのデプロイを検討する際は要再設計(architecture.md 決定事項 #23)
- 予報取得失敗(502)でもコーデ入力・保存は継続できること(スナップショットは null)
- テストユーザー: `admin@example.com` / `password123` / 地域 `130000`
