# Haregi 実装プラン

[architecture.md](./architecture.md) §10 の立ち上げ手順に基づく実装計画。**フェーズ1「環境構築」は機能実装と必ず分離**し、単独で完結・コミットしてから次のフェーズに進む。フェーズ4以降は**機能単位の垂直分割**とし、各フェーズ内で `apps/api` 実装 →`apps/web` 実装の順に進める(機能ごとに動く単位で完結させる)。`apps/api` は機能優先ディレクトリの**軽量オニオンアーキテクチャ**(domain → infrastructure → application → presentation。詳細は architecture.md の「apps/api のレイヤー構成」参照)を採用し、各機能フェーズの api サブフェーズはこの順で実装する。`apps/web` も同じ機能単位でスライスする**機能優先スライス**(routes / features/{components,hooks,api,model}。決定事項 #28。詳細は architecture.md の「apps/web のレイヤー構成」参照)を採用し、骨格はフェーズ4b で作る。**フロントエンド・バックエンドともに TDD(テスト駆動開発)で実装する**(決定事項 #27)。以下の各フェーズはテストと実装の成果物を並べて記載しているが、実装順序は必ず「テストを書く(Red)→実装して通す(Green)→リファクタ(Refactor)」に従う。

- 作成日: 2026-07-20
- 更新: 2026-08-03(設計レビュー反映: 最小履歴フェーズ(6c)と公開前ゲート(フェーズ8)を追加。気温スナップショットのテスト要件を明記)
- 更新: 2026-08-18(予報世代を PostgreSQL に永続化し(決定事項 #34)、解決できない `snapshotId` を 409 とする(決定事項 #35)。フェーズ3に `forecast_snapshot` を追加)
- 更新: 2026-08-18(フェーズ6a のテスト要件に所有権(認可)のケースを追加(決定事項 #33)。併せて楽観ロックを fail-closed 化し、トークンを単調増加する `version` 整数へ変更。条件付き書き込み・省略/並行更新のテストを追加(決定事項 #32))
- 更新: 2026-08-07(フェーズ1のスコープを改定: ツールチェーンが実際に機能することを確認するため、疎通の骨格スタブとそのテストを含める。従来の「機能コードを一切含めない」から変更)
- スコープ: Must 機能(初回リリース)まで。**最小履歴(`/history` 直近30件)は Must へ昇格したため本プランに含む**(フェーズ6c)。その他の Should 機能(履歴の拡張・設定・削除・天気アイコン・写真アップロード)は本プランの対象外(後続で順次追加)
- 要件は [specification.md](./specification.md)、技術設計は [architecture.md](./architecture.md) を参照

---

## フェーズ1: 環境構築(独立・単独コミット)

ワークスペースの骨組みとツールチェーン、および**疎通の骨格スタブ**まで。要件由来の機能(認証・予報取得・コーデ保存)は一切含めない。

> **スコープ改定(2026-08-07)**: 当初は「機能コードを一切含めない・`package.json` + `tsconfig.json` のみ」と定義していたが、それだけでは Vitest / TanStack Start / Hono が**実際に動くかを確認できないまま**次フェーズへ進むことになり、決定事項 #22(問題発生時にレイヤーを切り分けられる状態を保つ)の目的を果たせない。そこで**最小の骨格スタブとそのテスト**をフェーズ1に含める。スタブも例外なく TDD(Red → Green → Refactor)で書き、`--passWithNoTests` に頼らない。

**骨格スタブに含めてよいもの(この範囲を超えない)**

- `apps/api`: `GET /api/health` を返す Hono アプリと `@hono/node-server` のエントリ、`API_PORT` の解決
- `apps/web`: TanStack Start の最小構成(`router.tsx` / `routes/__root.tsx` / `routes/index.tsx`)、ランディングの最小コンポーネント、Vite dev proxy(`/api/*` → :4000)、Vitest(jsdom)+ Testing Library のセットアップ
- `packages/schema` / `packages/db`: 空のエントリ(実体はフェーズ2・3)

**含めないもの**: 認証・予報取得・コーデ保存に関わるコード、Better Auth / Drizzle / Zod / Tailwind / shadcn の導入、`features/` 配下のディレクトリ骨格(フェーズ4b)。

**作成するもの**

- ルート `package.json`: scripts(`docker` / `dev` / `db:generate` / `db:migrate` / `db:seed` / `lint` / `format` / `typecheck` / `test`)、devDeps(turbo / typescript(7系)/ oxlint / oxfmt / vitest)
- `pnpm-workspace.yaml`(`apps/*`, `packages/*`)
- `turbo.json`(dev / build / typecheck / test タスク定義)
- `tsconfig.base.json`(strict、TS7 前提)
- `.oxlintrc.json` / `.oxfmtrc.json`(ESLint・Prettier は導入しない)
- `docker-compose.yml`(PostgreSQL のみ。MinIO は Should フェーズまで追加しない)
- `.env.example`(`DATABASE_URL` / `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` / `WEB_ORIGIN` / `API_PORT` / `API_ORIGIN` / `LOG_LEVEL`)
- `.gitignore` 更新(`!.env.example` の追加等)
- 4ワークスペース(`apps/web` `apps/api` `packages/db` `packages/schema`)の `package.json` + `tsconfig.json`。スコープは `@haregi/*`
- 上記の骨格スタブと、それを固定する Vitest(**先に書く**):
  - `apps/api`: `GET /api/health` が 200 + `{ status: 'ok' }` を返すこと / `API_PORT` 未設定時に 4000 を使い、不正値を拒否すること
  - `apps/web`: ランディングがアプリ名を `<h1>` で表示すること / Vite が `/api` をプロキシし、3000 番ポートに固定すること / **プロキシ先が api と同じ `API_PORT`(または `API_ORIGIN`)から解決され、非既定ポートでも両者がずれないこと**

**検証**

- `pnpm install` が通る(`engines` を満たす Node.js であること)
- `pnpm docker` で PostgreSQL が起動する(healthcheck が healthy)
- `pnpm lint` / `pnpm format` / `pnpm typecheck` / `pnpm test` / `pnpm --filter @haregi/web build` が通る
- `pnpm dev` で web(:3000)と api(:4000)が起動し、`/api/health` が web のプロキシ越しにも応答する

**コミット**: lockfile(`pnpm-lock.yaml`)ごと固定してこのフェーズ単独でコミット(決定事項 #22)。以降のフェーズはこのコミットに積み、フェーズごとにコミットを分ける。

---

## フェーズ2: packages/schema(共通基盤)

全機能から参照される共有パッケージのため、垂直分割より先に確定させる。

- 地域マスタ: `master-data/areas.ts` を `packages/schema/src/areas.ts` へ**移植(再生成しない)**。`Area` 型・`findArea(code)`・`forecastCode` 解決ヘルパーを追加
- Zod スキーマ: signup(ユーザー名 trim 後1〜20文字・文字種制限なし / メール形式 / パスワード8〜20文字・小文字英字+数字 / areaCode マスタ実在)、login、coordinates upsert(**`snapshotId`(任意)** + `items` **最大7件**、date は `YYYY-MM-DD` かつ**実在する暦日・今日から前後1年以内**、**リクエスト内の日付重複は不正**、各項目は trim 後最大50文字、`version`(**既存レコードでは必須・新規作成時のみ省略可**。楽観ロックのトークン。決定事項 #32))。エラーメッセージは日本語
- 日付ユーティリティ(JST 固定): `todayJst()` / `YYYY-MM-DD` 検証(**実在する暦日であることを含む**)/ `YYYY年M月D日` 整形。`new Date()` からのローカル日付切り出しを書かない
- 気温整形(`℃` 表示)
- Vitest: スキーマ境界値・マスタのコード一意性/形式・日付ユーティリティ(TZ=UTC でも JST 判定が正しいこと)

## フェーズ3: packages/db(共通基盤)

DB スキーマも全機能の土台となるため先に確定させる。

- `drizzle.config.ts` + pg クライアント
- Better Auth CLI(`npx @better-auth/cli generate`)で認証テーブル(user / session / account / verification)を生成(additionalFields `areaCode` を含む最小 auth 設定を CLI 用に用意)
- `user.areaCode` と `coordinate` テーブル(architecture.md §4 の定義どおり。`unique(userId, date)`、**楽観ロック用の `version`(integer・default 1。決定事項 #32)**、気温スナップショット `real` null 可、**由来カラム `areaCode` / `tempStation` / `forecastIssuedAt` / `snapshotStatus`**(決定事項 #30))を追記
- **`forecast_snapshot` テーブル**(決定事項 #34。`snapshot_id` PK / `area_code` / `forecast_issued_at` / `fetched_at` / `status` / `payload`(jsonb・正規化済み `Forecast`)/ `created_at`)を追加。予報世代を永続化し、プロセス再起動・複数インスタンスでも `snapshotId` を引き当てられるようにする
- 初回マイグレーション生成・適用(`pnpm db:generate` / `db:migrate`)
- **絶対時刻は `timestamptz`**(自前定義テーブルのみ。認証テーブルは CLI 生成のまま。architecture.md §4)
- **`assertUtcTimezone`**(`src/timezone.ts`)を用意し、**`createDb()` の内側**(接続プール生成前)と `drizzle.config.ts` の両方から呼ぶ。`db:generate` / `db:migrate` は `TZ=UTC` で起動する。api 側のスクリプトへの `TZ=UTC` 注入はフェーズ4a
- テストは **Drizzle のスキーマ定義(`getTableConfig`)を検査する軽量なものに留める**。カラム型・複合一意制約・`version` の既定値・`date` が文字列モードであること・時刻がタイムゾーン付きであることを固定する。**実 DB へマイグレーションを適用して制約の効き目を確かめるのはフェーズ4a**(シードと認証の期限テストで実 DB が必要になる最初のフェーズ。そこで回収する)

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
- `src/index.ts`: @hono/node-server(:4000)
- `scripts/seed.ts`(`auth.api.signUpEmail` 経由で `admin@example.com` / `password123` / `130000`)
- Vitest: `domain` の検証ロジック単体テスト、認証ミドルウェアの 401 応答
- Vitest(**フェーズ3からの繰り越し**): **初回マイグレーションを空の PostgreSQL に適用し、DB が不正な状態を実際に拒否すること**。`(userId, date)` の重複 INSERT が一意制約違反になること / ユーザー削除でコーデが cascade 削除されること / **スキーマ定義とマイグレーション SQL がドリフトしていないこと**(`drizzle-kit generate` で差分が出ない)。フェーズ3のテストは Drizzle のメタデータを見るだけで SQL の適用可否も制約の効き目も保証しない。**実 DB はこのフェーズで既に必要**(`scripts/seed.ts` が `auth.api.signUpEmail` 経由でユーザーを作り、下記の認証 TZ テストも DB を使う)ため、ここで回収する
- **`TZ=UTC` の強制**(architecture.md §9): 認証テーブルの期限カラム(`session.expiresAt` / `verification.expiresAt`)は Better Auth CLI 生成物のためタイムゾーンなしで持つ(architecture.md §4)。`timestamp without time zone` は **Node 側のローカル TZ で解釈される**ため、書いたプロセスと読んだプロセスで `TZ` が違うとその差がそのまま期限のズレになる。**この列を tz 付きに直さない代わりに、UTC 以外のプロセスを起動させない**:
  - **検査自体はフェーズ3で `createDb()` の内側に入っている**ため、api・シードが `createDb()` を使う限り迂回できない(**DB セッションのタイムゾーンも接続時に UTC へ固定される**)。このフェーズでやるのは**各スクリプトへの `TZ=UTC` の注入**(`dev` / `start` / `scripts/seed.ts` / DB に触れるテスト)で、注入を忘れたら fail-fast で落ちる
  - Vitest: **タイムゾーンを `Asia/Tokyo` に設定した PostgreSQL に対しても、接続後の `SHOW TimeZone` が `UTC` を返すこと**。DB 側の既定値が何であっても接続の設定が勝つことを、実 DB で固定する
  - **日付ユーティリティのテスト(`packages/schema`)は対象外**。あちらは意図的に別の TZ で回して JST 判定の正しさを確認するものであり、UTC を強制しない
- Vitest: **`TZ` が `UTC` でないプロセスが起動を拒否されること**。tz なし列を据え置く判断は「全プロセスが UTC である」前提に乗っており、**その前提を守る門番が効いていることがテストの対象**になる(交差 TZ での一致テストは書かない — tz なし列では原理的に9時間ずれるため、通らないテストになる)

### 4b. apps/web

- TanStack Start v1 + React 19 + `@tailwindcss/vite`(Tailwind v4)+ shadcn/ui 導入。Vite dev proxy で `/api/*` → :4000
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
- `infrastructure/`: 気象庁 JSON 取得(`AbortSignal.timeout` + **指数バックオフ + ジッターのリトライ**)と地域コード単位のインメモリキャッシュ(30〜60分)を実装するアダプタ。domain の正規化関数を呼び出し、**`ResultAsync<Forecast, FetchError | ParseError | UnknownAreaError>` を生成するのはこの層のみ**(消費は application)。キャッシュは以下を満たす(決定事項 #30、architecture.md「キャッシュ・障害時挙動」):
  - 取得ごとに**世代 ID(`snapshotId`)**を発行し、**`forecast_snapshot` テーブル(PostgreSQL)へ永続化**する(決定事項 #34)。`snapshotId` からの引き当ては**DB を参照**し、インメモリキャッシュには世代を置かない(プロセス再起動・別インスタンスでも解決できるようにするため)。保持は24時間。**失効の判定は引き当てクエリの条件(`created_at > now() - interval '24 hours'`)で行い**、期限切れの行が残っていても引き当てを失敗させる(掃除の実行有無に失効判定を依存させない)。行の掃除は取得時に走らせるが容量管理の位置づけ
  - インメモリキャッシュ(TTL 30〜60分)の役割は**気象庁への発信抑制のみ**とする
  - 再取得に失敗しても**最後に成功した予報を破棄せず** `status: 'stale'` として返す(last-known-good)。**このとき新しい `forecast_snapshot` 行を発行し、有効な `snapshotId` を返す** — `GET` が 200 を返す限り引き当て可能であるという不変条件を保つ(決定事項 #34)。破ると障害24時間超で 409 ループに陥り、Must『予報が取れなくてもコーデ入力・保存は継続できる』を満たせない
  - 同一地域への**並行取得を1本の fetch に束ねる**(in-flight 共有)
- `application/`: `getForecast(areaCode)` ユースケース。infrastructure の呼び出し結果を `.match()` で処理し、失敗時は型付きアプリケーションエラー(例: `ForecastUnavailableError`)を throw する(neverthrow をこの層の外へ持ち出さない)。`snapshotId` から予報を引く `getForecastBySnapshotId(snapshotId)` も提供する(コーデ保存が使う)。**引き当ては有効期限つきで行い**(`created_at > now() - interval '24 hours'`)、**失敗した場合は型付きエラー(例: `SnapshotUnavailableError`)を返して 409 へマッピングする**(決定事項 #35)
- `presentation/`: `GET /api/forecast?area={code}`(`area` 省略時は登録地域、指定時はマスタ照合の上その地域)を `@hono/zod-openapi` の `createRoute` で定義し `/api/doc` に自動反映。レスポンスに `snapshotId` / `areaCode` / `tempStation` / `fetchedAt` / `forecastIssuedAt` / `status` を含める。throw されたエラーを `shared/http-errors.ts` 経由で 400/502 へ変換
- `scripts/validate-areas.ts`(`master-data/validate-areas.mjs` を移植。気象庁側の変更検知に継続利用。**リリース前と月次で手動実行する**運用とする)
- Vitest: `domain` の正規化ロジック(fixture: 通常・欠損 `""`・奄美/十勝の親区分解決)・`infrastructure` のキャッシュ動作(**TTL 切れ後の last-known-good・同時リクエストの束ね**)・**世代の永続化**(`forecast_snapshot` への書き込み / **インメモリキャッシュを空にしても引き当てられること** / **期限切れの行が残ったままでも引き当てが失敗すること**(掃除ではなくクエリ条件で失効を判定しているか) / **stale 応答でも新しい世代が発行され、その `snapshotId` が引き当て可能であること**)・`application` のエラー変換

### 5b. apps/web

- `/forecast` 画面の予報表示部: 週間気温予報(最高/最低)・地域切替セレクタ・**「出典: 気象庁ホームページ」常時表示**・取得失敗時のエラー表示 + 再試行ボタン(TanStack Query の stale データがあれば表示)
- レイアウトは先行してダミーデータで組んでもよいが、`GET /api/forecast` 完成後は実データに結線し、502 時の表示を実際に確認する
- Vitest(Testing Library): 出典表記が常時表示されること、地域切替セレクタでの表示切り替え、取得失敗時のエラー表示 + 再試行ボタンの挙動

---

## フェーズ6: コーディネート機能(垂直スライス)

### 6a. apps/api

**`features/coordinate/`(domain → infrastructure → application → presentation)**

- `domain/`: `Coordinate` 型、`(userId, date)` 一意・**items 最大7件**・**リクエスト内の日付重複禁止**・**実在する暦日**・**保存可能範囲(今日から前後1年)**などのビジネスルールを表現するバリデーション、気温スナップショットの決定ロジック(`Forecast` と対象日から max/min と由来(`areaCode` / `tempStation` / `forecastIssuedAt` / `snapshotStatus`)を引く純粋関数。予報範囲外の日付は null + `'unavailable'`)、**3項目が trim 後すべて空なら「削除」と判定する**ロジック(**対象レコードが存在しない場合は no-op**。決定事項 #32)
- `infrastructure/`: Drizzle 経由の CRUD アダプタ。`PUT /api/coordinates` の一括 upsert は単一トランザクションで実装し、途中の DB エラーは全件ロールバックする。**`version` の照合(楽観ロック)もこのトランザクション内で行う**(決定事項 #32)。照合は「SELECT で比較 → UPDATE / DELETE」の二段構えにせず、**`WHERE user_id = ? AND date = ? AND version = ?` の条件付き書き込みを1文で実行し、更新件数0を競合(409)として扱う**(並行リクエストが両方とも事前照合を通過する TOCTOU を避けるため)。新規作成は `(userId, date)` 一意制約の衝突を 409 に変換する。**空入力による削除分岐も同じ条件付き書き込みで行う**。**成功した更新では同じ文の中で `version = version + 1` し、新しい値を返す**(前進させないと旧トークンが有効なまま残る。トークンを DB 内でインクリメントすることで、時計の同値・逆行に依存せず旧トークンが必ず拒否される)。新規作成は `version = 1` で INSERT する。削除対象が存在しない空入力 item は、同一トランザクション内の存在確認(`FOR UPDATE`)で 409 と no-op を区別する(存在確認は判定にのみ用い、破壊的書き込みの根拠にしない)。**`ResultAsync<T, DbError>` を生成するのはこの層のみ**(消費は application)
- `application/`: `listCoordinates` / `upsertCoordinates` ユースケース(**`deleteCoordinate` は作らない**。削除は Should であり本プランの対象外。日付を指定した削除は `PUT` の空入力 item で行える)。`upsertCoordinates` は `features/forecast` の `application`(`getForecastBySnapshotId`)を呼び出して**リクエストの `snapshotId`(表示に使われた予報世代。決定事項 #30)**から対象日の気温スナップショットを解決してから infrastructure へ渡す。**`snapshotId` が無い場合は既存レコードの気温・由来をそのまま維持する**(決定事項 #31。過去日の文言修正で気温を失わない)。**送られたのに解決できない場合は 409** とし、黙って null / 既存維持で保存しない(決定事項 #35)。予報取得失敗時も null で保存を継続する。infrastructure から返る Result はここで処理し、失敗時は型付きアプリケーションエラー(例: `CoordinateSaveError`)を throw する
- `presentation/`: `GET /api/coordinates?from&to`(`from <= to` / 最大366日 / 両方省略で直近30件)/ `PUT /api/coordinates` を `createRoute` で定義し `/api/doc` に自動反映(**`DELETE /api/coordinates/:date` は実装しない**。Should 着手時に、所有者条件と `version` による条件付き削除・その所有権テストをまとめて実装する。仕様は `.agents/rules/api-design.md` に定義済み)。**気温スナップショットはクライアントから受け取らない**。**`PUT` は保存後の items(+1 済みの `version` を含む)をレスポンスで返す**。`GET` の各行にも `version` を含める。throw されたエラーを 400/401/**409**/500 へ変換
- Vitest: `domain` のバリデーション(一意制約表現・items 上限・日付重複・暦日・範囲・全空判定)・`infrastructure` のトランザクション動作(部分失敗時の全件ロールバック)・`application` の気温スナップショット解決ロジック。**以下は仕様を固定するテストとして必ず書く**(決定事項 #31 / #32):
  - `snapshotId` なしで既存レコードを更新したとき、保存済みの気温・`areaCode`・`forecastIssuedAt` が維持されること
  - 予報範囲外の日付を新規作成したとき、気温が null かつ `snapshotStatus: 'unavailable'` になること
  - **解決できない `snapshotId` を送った保存が 409 になること**(決定事項 #35)。`snapshotId` を**省略**した保存が 409 にならず既存維持で成功することと対で固定する
  - **気象庁の障害が24時間を超えた状況でも、stale の `GET` から得た `snapshotId` で保存が成功し `snapshotStatus: 'stale'` が記録されること**(409 ループにならないこと。決定事項 #34 の不変条件)
  - `version` が DB と不一致の item を含む保存が 409 になり、**同一リクエスト内の他の item も適用されない**こと
  - **既存レコードに対して `version` を省略した保存が 409 になること**(fail-closed。任意扱いのままだと値を送らないだけでロックを迂回でき、無言の上書きと空入力時のレコード削除が通る)
  - **同一レコードへの並行保存で、後着の1本が 409 になること**(条件付き書き込みの更新件数0を競合として扱えているか。事前照合と書き込みを分けた実装では両方通過する)
  - **空入力による削除分岐でも `version` が照合され、不一致・省略なら削除されずに 409 になること**
  - **保存に成功した行の `version` が +1 され、返却された新しい値では更新でき、保存前の古い値は 409 になること**。**同じ行を連続2回保存しても1回目のトークンが通らないこと**も固定する(DB 内インクリメントであるため、この拒否は実行時刻の変化に依存しない)
  - **空入力かつ対象レコードが存在しない item が no-op(200)になること**(他ユーザーだけが同日行を持つ場合を含む)。**未入力の日を含む一括送信が全件成功すること**
  - **`PUT /api/coordinates` の空入力による削除分岐が、他ユーザーのレコードを消さないこと**(他ユーザーだけが対象日付のレコードを持つ状態で全項目が空の item を送っても、そのレコードが残る)。削除分岐を `WHERE date = ?` だけで引く実装を検出する。**削除エンドポイント(Should)とは別に、PUT 内の削除分岐は Must の対象**であるため本フェーズで固定する
  - **他ユーザーのレコードを取得・更新できないこと**(RLS を持たないため、この保証はテストが担う。決定事項 #33)。`GET /api/coordinates` に他ユーザーのレコードが混ざらないこと / `PUT /api/coordinates` で他人の同一日付レコードを書き換えられないこと、をそれぞれ固定する。**`DELETE /api/coordinates/:date` の所有権テストは、削除機能(Should)に着手する時点で同様に追加する**(削除は本プランの対象外)

### 6b. apps/web

- `/forecast` 画面のコーデ入力部(アウター/トップス/ボトムス)を予報表示部と統合し、保存済みデータの表示・編集に対応
- 保存時に**表示中の予報の `snapshotId` を送る**(地域切替セレクタで選んだ地域の予報から得たもの。決定事項 #30)。`coordinate → forecast` の参照は許可された唯一の feature 間依存
- 各行に読み込み時の `version` を保持して**必ず送る**(既存レコードで省略するとサーバー側で 409 になる)。**保存レスポンスで返る新しい `version` を保持し直す**(再取得せずに続けて編集・保存できるようにする)。**409 を受けたら再読み込みを促すトーストを出す**(決定事項 #32)
- **未保存の変更がある状態での画面離脱に警告を出す**(1画面で1週間分を扱う構造上、離脱で入力が失われるため)
- 予報が取得できない場合でも入力・保存を継続できることを実際に確認する(スナップショット null)
- **`snapshotId` の失効による 409 を受けたら、予報を再取得して新しい `snapshotId` で再送する**(入力中のコーデは保持する。決定事項 #35)。`version` の 409(再読み込みを促す)とは案内を分ける
- Vitest(Testing Library): 各項目の文字数バリデーション表示、予報取得失敗時でも保存操作が可能なこと、保存済みデータの編集反映、409 時の再読み込み案内

### 6c. 最小履歴(`/history`)

Must へ昇格した最小履歴([specification.md §2.3](./specification.md))。これがないと保存した記録を後から見る手段がなく、本アプリの差別化(気温と紐付けた振り返り)が初回リリースで成立しない。

- api 側は `GET /api/coordinates`(引数省略で直近30件)をそのまま使う。**新規エンドポイントは作らない**
- web 側は `features/coordinate/` に一覧コンポーネントを追加し、`routes/history.tsx` で合成する。**日付・3項目・保存気温・地域名**を日付降順で表示するだけに留める(写真・集計・フィルタ・ページネーションは Should)
- 気温の隣に**記録時の地域名**を出す(地域切替を使うペルソナ前提では、地域が分からないと気温の意味が変わるため)
- Vitest(Testing Library): 記録が0件のときの空状態表示、気温が null の記録(予報取得失敗時に保存されたもの)が壊れずに表示されること

---

## フェーズ7: 結合確認

- docker の PostgreSQL に対し signup → login → forecast 取得 → コーデ upsert → **`/history` で確認**の一連を通す
- 地域を切り替えて保存したコーデに、切替後の地域の気温が記録されていることを確認する
- 過去日のコーデを文言だけ編集し、保存済みの気温が消えないことを確認する
- `pnpm lint` / `pnpm format` / `pnpm typecheck` / `pnpm test` を全て通す

---

## フェーズ8: 公開前ゲート

デプロイ先を決めた後、[release-checklist.md](./release-checklist.md) の項目を順に潰す。CI も E2E も持たないため、**このチェックリストがリリースの成立条件そのもの**になる。

- 限定公開(クローズドα版)の前: チェックリスト §1(インフラ・DB・運用・手動動作確認・品質ゲート)
- 一般公開の前: チェックリスト §2(パスワードリセット・アカウント削除を含む)。**これらが揃うまで不特定多数に公開しない**([specification.md §6](./specification.md))

---

## 進め方の約束

- **TDD**: フロントエンド(`apps/web`)・バックエンド(`apps/api`)・共有パッケージ(`packages/schema`)のすべてで、実装前に失敗するテストを書く(Red)→ 実装して通す(Green)→ 必要ならリファクタリング(Refactor)の順で進める。テストの後追い実装はしない
- フェーズ1は機能コードと混ぜず単独コミット。フェーズ4以降は機能単位でコミットを分ける(a: api → b: web の順、機能が完結してからコミットしてもよい)
- 依存追加はフェーズ単位でまとめて行うが、既存パッケージの**バージョン更新は1つずつ**(決定事項 #22)
- スタック逸脱禁止(`.agents/rules/stack.md`): 代替ライブラリの提案・導入をしない。ESLint / Prettier / Husky / CI / E2E を追加しない。コンポーネントテスト(`@testing-library/react`)は決定事項 #27 によりスコープ内
