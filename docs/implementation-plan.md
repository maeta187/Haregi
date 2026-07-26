# Haregi 実装プラン

[architecture.md](./architecture.md) §10 の立ち上げ手順に基づく実装計画。**フェーズ1「環境構築」は機能実装と必ず分離**し、単独で完結・コミットしてから次のフェーズに進む。フェーズ4以降は**機能単位の垂直分割**とし、各フェーズ内で `apps/api` 実装 →`apps/web` 実装の順に進める(機能ごとに動く単位で完結させる)。`apps/api` は機能優先ディレクトリの**軽量オニオンアーキテクチャ**(domain → infrastructure → application → presentation。詳細は architecture.md の「apps/api のレイヤー構成」参照)を採用し、各機能フェーズの api サブフェーズはこの順で実装する。`apps/web` も同じ機能単位でスライスする**機能優先スライス**(routes / features/{components,hooks,api,model}。決定事項 #28。詳細は architecture.md の「apps/web のレイヤー構成」参照)を採用し、骨格はフェーズ4b で作る。**フロントエンド・バックエンドともに TDD(テスト駆動開発)で実装する**(決定事項 #27)。以下の各フェーズはテストと実装の成果物を並べて記載しているが、実装順序は必ず「テストを書く(Red)→実装して通す(Green)→リファクタ(Refactor)」に従う。

- 作成日: 2026-07-20
- スコープ: Must 機能(初回リリース)まで。Should 機能(履歴・設定・削除・天気アイコン・写真アップロード)は本プランの対象外(後続で順次追加)
- 要件は [specification.md](./specification.md)、技術設計は [architecture.md](./architecture.md) を参照

---

## フェーズ1: 環境構築(独立・単独コミット)

機能コードを一切含めない。ワークスペースの骨組みとツールチェーンのみ。

**作成するもの**

- ルート `package.json`: scripts(`docker` / `dev` / `db:generate` / `db:migrate` / `db:seed` / `lint` / `format` / `typecheck` / `test`)、devDeps(turbo / typescript(7系)/ oxlint / oxfmt / vitest)
- `pnpm-workspace.yaml`(`apps/*`, `packages/*`)
- `turbo.json`(dev / build / typecheck / test タスク定義)
- `tsconfig.base.json`(strict、TS7 前提)
- `.oxlintrc.json` / `.oxfmtrc.json`(ESLint・Prettier は導入しない)
- `docker-compose.yml`(PostgreSQL のみ。MinIO は Should フェーズまで追加しない)
- `.env.example`(`DATABASE_URL` / `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` / `WEB_ORIGIN` / `API_PORT` / `API_ORIGIN` / `LOG_LEVEL`)
- `.gitignore` 更新(`!.env.example` の追加等)
- 4ワークスペースの最小スタブ(`apps/web` `apps/api` `packages/db` `packages/schema` の `package.json` + `tsconfig.json` のみ。スコープは `@haregi/*`)

**検証**

- `pnpm install` が通る
- `pnpm docker` で PostgreSQL が起動する(healthcheck が healthy)
- `pnpm lint` / `pnpm format` / `pnpm typecheck` / `pnpm test` が(対象が空でも)エラーなく走る
- フロント/バックの疎通確認はしない

**コミット**: lockfile(`pnpm-lock.yaml`)ごと固定してこのフェーズ単独でコミット(決定事項 #22)。以降のフェーズはこのコミットに積み、フェーズごとにコミットを分ける。

---

## フェーズ2: packages/schema(共通基盤)

全機能から参照される共有パッケージのため、垂直分割より先に確定させる。

- 地域マスタ: `master-data/areas.ts` を `packages/schema/src/areas.ts` へ**移植(再生成しない)**。`Area` 型・`findArea(code)`・`forecastCode` 解決ヘルパーを追加
- Zod スキーマ: signup(ユーザー名8文字以上・英数字のみ / メール形式 / パスワード8〜20文字・小文字英字+数字 / areaCode マスタ実在)、login、coordinates upsert(**`areaCode`(マスタ実在)** + `items` **最大7件**、date は `YYYY-MM-DD`、各項目最大50文字)。エラーメッセージは日本語
- 日付ユーティリティ(JST 固定): `todayJst()` / `YYYY-MM-DD` 検証 / `YYYY年M月D日` 整形。`new Date()` からのローカル日付切り出しを書かない
- 気温整形(`℃` 表示)
- Vitest: スキーマ境界値・マスタのコード一意性/形式・日付ユーティリティ(TZ=UTC でも JST 判定が正しいこと)

## フェーズ3: packages/db(共通基盤)

DB スキーマも全機能の土台となるため先に確定させる。

- `drizzle.config.ts` + pg クライアント
- Better Auth CLI(`npx @better-auth/cli generate`)で認証テーブル(user / session / account / verification)を生成(additionalFields `areaCode` を含む最小 auth 設定を CLI 用に用意)
- `user.areaCode` と `coordinate` テーブル(architecture.md §4 の定義どおり。`unique(userId, date)`、気温スナップショット `real` null 可)を追記
- 初回マイグレーション生成・適用(`pnpm db:generate` / `db:migrate`)

---

## フェーズ4: 認証機能(垂直スライス)

### 4a. apps/api

**共通基盤(`src/shared/`。全 feature から参照)**

- `logger.ts`: pino インスタンスを作成し、method / path / status / duration / requestId を構造化ログ出力するミドルウェアを実装。ログレベルは `LOG_LEVEL` 環境変数で制御
- `openapi.ts`: `@hono/zod-openapi` の `OpenAPIHono` 構築 + `@hono/swagger-ui` を `GET /api/doc` にマウント(`GET /api/openapi.json` に OpenAPI 定義を公開)
- `http-errors.ts`: 各 feature の `application` 層が throw する型付きエラーを HTTP ステータスへ変換する共通マッピング関数

**`features/auth/`(domain → infrastructure → application → presentation)**

- `domain/`: signup 入力の検証ロジック(`packages/schema` の Zod を用いた純関数。パスワード文字種・areaCode 実在・ユーザー名形式)、`AuthUser` 型
- `infrastructure/`: Better Auth インスタンス(emailAndPassword 8〜20 / additionalFields areaCode / rateLimit / **`hooks.before` で domain の検証関数を呼ぶ**)
- `application/`: セッション取得ユースケース(`getCurrentUser`)。Better Auth 自体は neverthrow を使わないため、この feature では infrastructure 層でも Result は基本的に発生しない(例外系は Better Auth の挙動に従う)
- `presentation/`: `/api/auth/*` マウント、セッションミドルウェア(`auth.api.getSession` → `c.get('user')`、未認証 401)

**合成**

- `src/app.ts`: `shared/openapi.ts` でアプリを構築し pino ロギングミドルウェアを適用 → `features/auth/presentation` のルータをマウント。この時点でメソッドチェーンで `AppType` の骨格をエクスポート
- `src/index.ts`: @hono/node-server(:3001)
- `scripts/seed.ts`(`auth.api.signUpEmail` 経由で `admin@example.com` / `password123` / `130000`)
- Vitest: `domain` の検証ロジック単体テスト、認証ミドルウェアの 401 応答

### 4b. apps/web

- TanStack Start v1 + React 19 + `@tailwindcss/vite`(Tailwind v4)+ shadcn/ui 導入。Vite dev proxy で `/api/*` → :3001
- **ディレクトリ骨格を先に作る**(決定事項 #28 の機能優先スライス): `src/routes/` / `src/features/{auth,forecast,coordinate}/{components,hooks,api}` / `src/components/ui/`(shadcn 取り込み先)/ `src/lib/`。依存方向は `routes → features → (components/ui, lib, @haregi/schema)` の一方向、`hc<AppType>` / `authClient` の呼び出しは `features/*/api/` のみ(詳細は architecture.md「apps/web のレイヤー構成」)
- `@testing-library/react` + `@testing-library/jest-dom` を導入し、Vitest の jsdom 環境を設定(コンポーネントテストの基盤。以降の web サブフェーズすべてで使う)
- `src/lib/`: auth-client(`createAuthClient` + `inferAdditionalFields` で areaCode 型付け)/ api-client(`hc<AppType>` + TanStack Query)。fetch 直書き禁止
- 画面のレイアウト・フォームは shadcn/ui の Form パターンで先に組んでよい(API 未完成でも RHF + Zod resolver 部分は着手可能)。ただし**signup → login → session 取得がプロキシ越しに通ること(Set-Cookie 転送・trustedOrigins)を確認してから**次フェーズへ進む
- ルート: `/`(ランディング・仮テキスト禁止)、`/signup` / `/login`
- ナビのログイン状態出し分け・トースト(sonner)・保護ルートの `beforeLoad` ガード(以降のフェーズで使う下地をここで作る)
- Vitest(Testing Library): signup/login フォームのバリデーションエラー表示、保護ルートが未認証時に `/login` へリダイレクトすること

---

## フェーズ5: 天気予報機能(垂直スライス)

### 5a. apps/api

**`features/forecast/`(domain → infrastructure → application → presentation)**

- `domain/`: `Forecast` 型と、`[短期, 週間]` の2要素配列を `weatherArea` / `weeklyArea` / `tempStation` / `forecastCode` で解決して正規化する**純粋関数**(外部依存なし)。週間は翌日始まりのため当日気温を短期から補完、`""` 欠損は null 化するロジックもここに置く
- `infrastructure/`: 気象庁 JSON 取得(`AbortSignal.timeout` + 軽量リトライ)と地域コード単位のインメモリキャッシュ(30〜60分)を実装するアダプタ。domain の正規化関数を呼び出し、**neverthrow(`ResultAsync<Forecast, FetchError | ParseError | UnknownAreaError>`)はこの層のみで使用**
- `application/`: `getForecast(areaCode)` ユースケース。infrastructure の呼び出し結果を `.match()` で処理し、失敗時は型付きアプリケーションエラー(例: `ForecastUnavailableError`)を throw する(neverthrow をこの層の外へ持ち出さない)
- `presentation/`: `GET /api/forecast?area={code}`(`area` 省略時は登録地域、指定時はマスタ照合の上その地域)を `@hono/zod-openapi` の `createRoute` で定義し `/api/doc` に自動反映。throw されたエラーを `shared/http-errors.ts` 経由で 400/502 へ変換
- `scripts/validate-areas.ts`(`master-data/validate-areas.mjs` を移植。気象庁側の変更検知に継続利用)
- Vitest: `domain` の正規化ロジック(fixture: 通常・欠損 `""`・奄美/十勝の親区分解決)・`infrastructure` のキャッシュ動作・`application` のエラー変換

### 5b. apps/web

- `/forecast` 画面の予報表示部: 週間気温予報(最高/最低)・地域切替セレクタ・**「出典: 気象庁ホームページ」常時表示**・取得失敗時のエラー表示 + 再試行ボタン(TanStack Query の stale データがあれば表示)
- レイアウトは先行してダミーデータで組んでもよいが、`GET /api/forecast` 完成後は実データに結線し、502 時の表示を実際に確認する
- Vitest(Testing Library): 出典表記が常時表示されること、地域切替セレクタでの表示切り替え、取得失敗時のエラー表示 + 再試行ボタンの挙動

---

## フェーズ6: コーディネート機能(垂直スライス)

### 6a. apps/api

**`features/coordinate/`(domain → infrastructure → application → presentation)**

- `domain/`: `Coordinate` 型、`(userId, date)` 一意・**items 最大7件**などのビジネスルールを表現するバリデーション、気温スナップショットの決定ロジック(`Forecast` と対象日から max/min を引く純粋関数。予報範囲外の日付は null)
- `infrastructure/`: Drizzle 経由の CRUD アダプタ。`PUT /api/coordinates` の一括 upsert は単一トランザクションで実装し、途中の DB エラーは全件ロールバックする。**neverthrow(`ResultAsync<T, DbError>`)はこの層のみで使用**
- `application/`: `listCoordinates` / `upsertCoordinates` / `deleteCoordinate` ユースケース。`upsertCoordinates` は `features/forecast` の `application`(`getForecast`)を呼び出して**リクエストの `areaCode`(表示中の地域。決定事項 #29)**・対象日の気温スナップショットを解決してから infrastructure へ渡す(予報取得失敗時も null で保存を継続する)。infrastructure から返る Result はここで処理し、失敗時は型付きアプリケーションエラー(例: `CoordinateSaveError`)を throw する
- `presentation/`: `GET /api/coordinates?from&to` / `PUT /api/coordinates` / `DELETE /api/coordinates/:date` を `createRoute` で定義し `/api/doc` に自動反映。**気温スナップショットはクライアントから受け取らない**。throw されたエラーを 400/401/500 へ変換
- Vitest: `domain` のバリデーション(一意制約表現・items 上限)・`infrastructure` のトランザクション動作(部分失敗時の全件ロールバック)・`application` の気温スナップショット解決ロジック

### 6b. apps/web

- `/forecast` 画面のコーデ入力部(アウター/トップス/ボトムス)を予報表示部と統合し、保存済みデータの表示・編集に対応
- 保存時に**表示中の地域コードを `areaCode` として送る**(地域切替セレクタの値と一致させる。決定事項 #29)。`coordinate → forecast` の参照は許可された唯一の feature 間依存
- 予報が取得できない場合でも入力・保存を継続できることを実際に確認する(スナップショット null)
- Vitest(Testing Library): 各項目の文字数バリデーション表示、予報取得失敗時でも保存操作が可能なこと、保存済みデータの編集反映

---

## フェーズ7: 結合確認

- docker の PostgreSQL に対し signup → login → forecast 取得 → コーデ upsert の一連を通す
- `pnpm lint` / `pnpm format` / `pnpm typecheck` / `pnpm test` を全て通す

---

## 進め方の約束

- **TDD**: フロントエンド(`apps/web`)・バックエンド(`apps/api`)・共有パッケージ(`packages/schema`)のすべてで、実装前に失敗するテストを書く(Red)→ 実装して通す(Green)→ 必要ならリファクタリング(Refactor)の順で進める。テストの後追い実装はしない
- フェーズ1は機能コードと混ぜず単独コミット。フェーズ4以降は機能単位でコミットを分ける(a: api → b: web の順、機能が完結してからコミットしてもよい)
- 依存追加はフェーズ単位でまとめて行うが、既存パッケージの**バージョン更新は1つずつ**(決定事項 #22)
- スタック逸脱禁止(`.agents/rules/stack.md`): 代替ライブラリの提案・導入をしない。ESLint / Prettier / Husky / CI / E2E を追加しない。コンポーネントテスト(`@testing-library/react`)は決定事項 #27 によりスコープ内
