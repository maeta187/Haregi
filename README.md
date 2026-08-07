# Haregi（ハレギ）

Haregi は、週間の天気予報（最高・最低気温）を見ながら、日ごとの服装コーディネートを記録・管理する Web アプリです。名前は「晴れ（天気）」と「着（服）」を組み合わせたもので、過去の服装を記録時点の気温と結び付けて振り返れることを特徴とします。

主な対象は、週の初めに 1 週間分の服を計画したい通勤者です。登録地域や選択中の地域の気象庁週間予報を確認しながら、アウター・トップス・ボトムスを日付ごとに保存する構成を予定しています。

> [!IMPORTANT]
> 現在は設計確定後の初期実装段階です。モノレポ、PostgreSQL、Web/API の最小スタブはありますが、認証、予報取得、コーディネート保存、DB スキーマ・マイグレーション・シードなどの機能は未実装です。実装は [実装計画](./docs/implementation-plan.md) のフェーズ順に、フロントエンド・バックエンドとも TDD で進めます。

## モノレポ構成

pnpm workspace と Turborepo を使用しています。

| パス | 役割 | 現在の状態 |
| --- | --- | --- |
| `apps/web` | TanStack Start + React 19 のフロントエンド。将来は機能優先スライスで構成 | トップページの最小スタブを実装済み |
| `apps/api` | Hono + Node.js の API。将来は機能優先の軽量オニオン構成 | `GET /api/health` の最小スタブを実装済み |
| `packages/schema` | Zod スキーマ、地域マスタ、JST 日付・気温ユーティリティの共有パッケージ | パッケージの骨組みのみ |
| `packages/db` | Drizzle のスキーマ、DB クライアント、マイグレーションを管理 | パッケージの骨組みのみ |
| `master-data` | 検証済みの気象庁地域マスタと検証資料 | 生成・検証済み。今後各パッケージへ移植予定 |
| `docs` | 要件、技術設計、実装計画などの規範ドキュメント | 設計確定済み |
| `.agents/rules` | 実装時に守るプロジェクト固有ルール | 運用中 |

## 開発環境のセットアップ

### 前提

- Node.js 22.22.2 以上・23 未満（`.node-version` は `22.22.2`）
- pnpm 11.1.1（ルート `package.json` の `packageManager` で指定）
- Docker と Docker Compose

ルートと `apps/api` の `package.json` に `engines.node: ">=22.22.2 <23"` を指定し、`.npmrc` の `engine-strict=true` で `pnpm install` 時に強制しています。バージョン管理ツール（Volta / nodenv / fnm / mise 等）を使う場合は `.node-version` が参照されます。

この範囲は次の 2 つの制約の積で決まっています。

- **下限**: `apps/api` の `pnpm dev` は `node src/index.ts` として TypeScript を直接実行するため、型ストリッピングが既定で有効な Node.js が必要（22.18.0 未満では `ERR_UNKNOWN_FILE_EXTENSION` で起動に失敗）。加えて `pnpm-lock.yaml` の jsdom が 22 系では `>=22.22.2` を要求するため、下限は 22.22.2 になります
- **上限**: ロック済みの依存には `^20.19.0 || ^22.13.0 || >=24` のように **Node 23 を除外する**ものが含まれます。`engine-strict=true` の下では 23 系で `pnpm install` が失敗するため、動作確認済みの 22 系に範囲を限定しています

24 系以降へ広げる場合は、その版で `pnpm install --frozen-lockfile` と品質ゲート（lint / typecheck / test / build）を通してから `engines` を更新してください。

### 1. 依存パッケージをインストールする

リポジトリのルートで実行します。

```bash
pnpm install
```

### 2. 環境変数を設定する

サンプルをルートの `.env` にコピーします。

```bash
cp .env.example .env
```

`.env` には次の項目があります。

| 変数 | 用途 |
| --- | --- |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `docker-compose.yml` が読む PostgreSQL の初期化情報（未設定時はいずれも `haregi`）。変更したら `DATABASE_URL` も揃える |
| `DATABASE_URL` | ローカル PostgreSQL の接続 URL |
| `BETTER_AUTH_SECRET` | Better Auth の署名用シークレット。32 文字以上のランダムな値へ変更する |
| `BETTER_AUTH_URL` | Better Auth のベース URL |
| `WEB_ORIGIN` | Web アプリのオリジン |
| `API_PORT` | API の待受ポート（既定値 `4000`）。**Vite の `/api/*` プロキシ先も同じ値から組み立てられる**ため、変更しても web / api がずれない |
| `API_ORIGIN` | Vite プロキシの転送先を明示指定する場合に使う（`API_PORT` より優先。localhost 以外を指したいとき用） |
| `LOG_LEVEL` | API のログレベル |

現在の API スタブは `.env` を自動で読み込む処理をまだ持っていません（フェーズ4以降で導入）。そのため `API_PORT` / `API_ORIGIN` を既定値から変える場合は、当面シェルの環境変数として渡します（例: `API_PORT=4100 pnpm dev`）。この場合 api の待受ポートと Vite プロキシの転送先が揃って追従します。それ以外の変数を利用する機能は今後のフェーズで実装予定です。

### 3. PostgreSQL を起動する

```bash
pnpm docker
```

`docker-compose.yml` の PostgreSQL 17 が `127.0.0.1:5432` で起動し、ヘルスチェックが完了するまで待機します。**ポートはループバックのみに公開**しており（`"5432:5432"` と書くとホストの全インターフェースへ公開され、既定の認証情報のまま同一ネットワークの第三者から接続できてしまう）、同一ホスト以外からは接続できません。

DB 名、ユーザー名、パスワードは `.env` の `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` から注入され、未設定時はいずれも `haregi` になります。変更する場合は `DATABASE_URL` も合わせて更新してください。データは Docker ボリューム `postgres-data` に保持されます。

### 4. DB マイグレーションとシードを実行する

最終的には次の順で実行する設計です。

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

ただし、現時点ではルートに転送用スクリプトがある一方、転送先の `packages/db/package.json` に対応するスクリプトが未定義です。そのため、これら 3 コマンドはまだ実行できません。`packages/db` の Drizzle 構成、マイグレーション、シード実装後に利用可能になります。

### 5. 開発サーバーを起動する

```bash
pnpm dev
```

Turborepo が次の 2 プロセスを並行起動します。

- Web: <http://localhost:3000>
- API: <http://localhost:4000>（ヘルスチェック: <http://localhost:4000/api/health>）

Web の Vite 開発サーバーは `/api/*` を API の `http://localhost:4000` へプロキシするため、<http://localhost:3000/api/health> からも疎通を確認できます。

## ルートの pnpm scripts

以下はルートの `package.json` に現在定義されているスクリプトの全一覧です。

| コマンド | 実行内容・用途 | 現在の利用可否 |
| --- | --- | --- |
| `pnpm docker` | `docker compose up -d --wait postgres` を実行し、PostgreSQL をバックグラウンドで起動して healthy になるまで待つ | 利用可能 |
| `pnpm dev` | `turbo run dev` により `apps/web` と `apps/api` の開発サーバーを並行起動する | 利用可能 |
| `pnpm db:generate` | `@haregi/db` の同名スクリプトへ処理を委譲し、Drizzle マイグレーションを生成する予定 | 転送先スクリプトが未実装 |
| `pnpm db:migrate` | `@haregi/db` の同名スクリプトへ処理を委譲し、マイグレーションを適用する予定 | 転送先スクリプトが未実装 |
| `pnpm db:seed` | `@haregi/db` の同名スクリプトへ処理を委譲し、開発用データを投入する予定 | 転送先スクリプトが未実装 |
| `pnpm lint` | oxlint で `apps` と `packages` を静的解析する | 利用可能 |
| `pnpm format` | oxfmt でルート設定ファイルと `apps`、`packages` を上書き整形する | 利用可能。ファイルを変更するコマンドなので実行後に差分を確認する |
| `pnpm typecheck` | `turbo run typecheck` により全ワークスペースで TypeScript の型検査を行う | 利用可能 |
| `pnpm test` | `turbo run test` により全ワークスペースで Vitest を実行する | 利用可能。現在は `apps/api`（health 応答・`API_PORT` 解決）と `apps/web`（ランディング表示・Vite プロキシ設定）の骨格スタブに対するテストが動く |

各ワークスペースに直接定義されているスクリプトは次のとおりです。

| ワークスペース | スクリプト |
| --- | --- |
| `@haregi/web` | `build`（Vite ビルド）、`dev`（3000 番ポートで Vite 起動）、`test`（Vitest）、`typecheck`（tsc） |
| `@haregi/api` | `build`（tsc で出力）、`dev`（Node.js で起動）、`test`（Vitest）、`typecheck`（tsc） |
| `@haregi/schema` | `test`（Vitest）、`typecheck`（tsc） |
| `@haregi/db` | `test`（Vitest）、`typecheck`（tsc） |

個別に実行する場合は、例えば `pnpm --filter @haregi/web build` や `pnpm --filter @haregi/api test` のようにワークスペースを指定します。

## ドキュメント

- [仕様書](./docs/specification.md) — 機能要件、画面、バリデーション、初回リリースのスコープ
- [アーキテクチャ](./docs/architecture.md) — 技術スタック、データモデル、API、認証、モノレポ設計
- [実装計画](./docs/implementation-plan.md) — 環境構築から公開前ゲートまでのフェーズと TDD の進め方
- [ペルソナ](./docs/persona.md) — ターゲットユーザーと設計判断の基準
- [リリースチェックリスト](./docs/release-checklist.md) — 限定公開・一般公開前の成立条件
- [プロジェクトルール](./.agents/rules/) — API、日付、気象庁データ、技術スタック、テスト、UI、バリデーションの規約

`docs/rebuildspec.md` は検討経緯を残す非規範文書です。実装・仕様確認では上記の仕様書、アーキテクチャ、実装計画、ペルソナ、リリースチェックリストを正とします。
