# Haregi(ハレギ)アーキテクチャドキュメント

Haregi の技術設計。**どう作るか**(スタック・構成・データモデル・API・認証・非機能要件)を定義する。要件(何を作るか)は [specification.md](./specification.md) を参照。

- 作成日: 2026-07-19([rebuildspec.md](./rebuildspec.md) からの分割。検討経緯・盲点レビューの記録はそちらを参照)
- ステータス: 確定(実装は新リポジトリで行う)

---

## 1. 技術スタック

| 分類 | 技術 |
| --- | --- |
| モノレポ | pnpm workspace + Turborepo |
| フロントエンド | TanStack Start v1(TanStack Router + Vite + Nitro)/ React 19 / TypeScript 7 |
| スタイリング | Tailwind CSS v4 + shadcn/ui |
| バックエンド | Hono 4 + @hono/node-server(Node.js) |
| 認証 | Better Auth(email/password、Drizzle アダプタ) |
| DB / ORM | PostgreSQL + Drizzle ORM + drizzle-kit |
| API 型共有 | Hono RPC(`hc<AppType>`) |
| データ取得・キャッシュ | TanStack Query(Hono RPC と併用) |
| バリデーション | Zod(共有パッケージ) |
| エラーハンドリング | neverthrow(`apps/api` のみ) |
| フォーム | React Hook Form + @hookform/resolvers |
| 外部 API | 気象庁 天気予報 JSON(API キー不要・出典明記で利用) |
| テスト | Vitest |
| Lint / Format | oxlint + oxfmt(Oxc ツールチェーン) |

---

## 2. 決定事項(Decision Log)

| # | 項目 | 決定 | 理由 |
| --- | --- | --- | --- |
| 1 | 全体構成 | **pnpm workspace + Turborepo のモノレポ** | フロント/バック分離と型共有の両立 |
| 2 | フロントエンド | **TanStack Start(v1)+ React 19** | Vite ベースで Vitest / oxlint / oxfmt とツールチェーンが統一。型安全ルーティングが Hono RPC・TS7 の方針と整合。shadcn/ui・Better Auth とも公式対応(Next.js 15 案から変更。RSC 非対応だが本アプリでは不要) |
| 3 | バックエンド | **Hono**(Node.js ランタイム前提) | 軽量・Web 標準・Hono RPC による end-to-end 型安全 |
| 4 | BaaS(Supabase 等) | **不採用** | 自前構成で学習・制御性を優先 |
| 5 | 認証 | **Better Auth** | email/password が第一級サポート。Hono 統合が公式。自前実装(ハッシュ化・セッション管理)を排除できる |
| 6 | ORM | **Drizzle**(Prisma から乗り換え) | 軽量・SQL 寄り・エッジ対応。Better Auth 公式サポートあり |
| 7 | DB | **PostgreSQL**(Docker Compose でローカル起動) | 現行踏襲 |
| 8 | CSS | **Tailwind CSS v4** | 現行 v3 から刷新 |
| 9 | UI ライブラリ | **shadcn/ui**(調査の上選定。付録 A 参照) | フォーム/トースト/ダイアログの完成度と拡張性 |
| 10 | バリデーション | **Zod**(フロント/バックで共有) | 現行踏襲。Hono の zValidator・RHF resolver 両対応 |
| 11 | テスト | **Vitest を導入** | 現行テストゼロからの改善 |
| 12 | Storybook | **見送り** | 規模に対して維持コストが高い |
| 13 | Husky + lint-staged | **見送り** | lint / format は手動実行 |
| 14 | CI(GitHub Actions) | **今回は見送り** | 後から追加可能 |
| 15 | 天気予報 API | **気象庁 JSON(bosai)** | 国内特化。府県予報区コードで取得でき地域選択の設計と直結。無料・出典明記で商用利用可(§6 参照) |
| 16 | Lint / Format | **oxlint + oxfmt(VoidZero / Oxc)** | Rust 製で高速。oxlint は 1.0 安定版、oxfmt は Prettier 互換(JS/TS 適合テスト100%)で Tailwind クラスソート内蔵 |
| 17 | 画像ストレージ | **S3 互換 API 前提(サービスは未定)** | コーデ写真(Should)の保存先。コードは S3 互換 SDK で書き、契約先(R2 / S3 等)は実装時に決定。ローカル開発は MinIO(Docker) |
| 18 | TypeScript | **7 系に統一** | 2026-07 GA の Go ネイティブコンパイラ。型検査が約10倍高速。`typescript@latest` がそのまま 7 系のため移行コストはほぼゼロ(安定版プログラマティック API は 7.1 待ちだが本スタックでは影響なし) |
| 19 | エラーハンドリング | **neverthrow を api 層に導入** | 外部 I/O(気象庁・DB・S3)の失敗を `Result` / `ResultAsync` の型付きエラーで表現。軽量で段階導入可能。web には導入しない(Effect は多機能だが本規模には過剰と判断) |
| 20 | プロジェクト名 | **Haregi(ハレギ)** | 旧称 FabuForecast から刷新。「晴れ(天気)+着(服)」のダブルミーニング |
| 21 | 日付の基準 | **JST 固定の `YYYY-MM-DD` 文字列** | 「今日」の判定・upsert キー・気象庁 JSON(JST)を跨ぐ日付ズレを排除。`Date` オブジェクトを境界越しに渡さない(§9 参照) |
| 22 | バージョン管理方針 | **初回 commit で lockfile ごと固定・更新は1パッケージずつ** | TanStack Start v1 / TS7 / oxfmt ベータ等、全レイヤーが新しいため問題発生時の切り分けコストを抑える(§9 参照) |
| 23 | デプロイ先 | **未定(明示的保留)** | 現段階では決めない。ただしサーバー側キャッシュ(インメモリ前提)と web→api の2プロセス+プロキシ構成は **Node 常駐プロセスを暗黙の前提**としており、サーバーレス系を選ぶ場合はキャッシュ置き場とプロキシ構成の再設計が必要になる点をデプロイ先決定時に再確認する |

---

## 3. モノレポ構成 / 通信経路

```
haregi/
├── apps/
│   ├── web/                  # TanStack Start(フロントエンド)
│   │   ├── src/routes/       # TanStack Router ファイルルーティング(/, /signup, /login, /forecast, ...)
│   │   ├── src/components/   # shadcn/ui 取り込み先 + 独自コンポーネント
│   │   └── src/lib/          # auth-client, api-client(Hono RPC + TanStack Query)
│   └── api/                  # Hono(バックエンド)
│       ├── src/auth.ts       # Better Auth インスタンス
│       ├── src/app.ts        # ルート定義(AppType をエクスポート)
│       ├── src/index.ts      # @hono/node-server エントリ
│       └── scripts/          # seed.ts / validate-areas.ts(全58区分の実レスポンス検証)
├── packages/
│   ├── db/                   # Drizzle スキーマ + クライアント + drizzle-kit 設定
│   └── schema/               # Zod スキーマ / 地域マスタ(生成済み areas.ts を移植) / 日付(JST)・気温整形ユーティリティ
├── docker-compose.yml        # PostgreSQL
├── turbo.json
├── pnpm-workspace.yaml
└── .env.example
```

### 通信経路

- ブラウザ → `apps/web`(:3000)→ `/api/*` を `apps/api`(:3001)へプロキシ
  - 開発時は **Vite の dev proxy**、本番は **Nitro のサーバールート**(または前段のリバースプロキシ)で転送
  - 同一オリジンになるため CORS/Cookie の問題を回避
- `apps/web` は `hc<AppType>`(Hono RPC)+ **TanStack Query** で API を型安全に取得・キャッシュする
- Better Auth のエンドポイントは `/api/auth/*` にマウント(フロントは `better-auth/react` の `createAuthClient`)
- 保護ルート(`/forecast` 等)は TanStack Router の `beforeLoad` でセッションを確認し、未認証は `/login` へリダイレクト

---

## 4. データモデル(Drizzle / PostgreSQL)

認証系テーブル(user / session / account / verification)は **Better Auth CLI(`npx @better-auth/cli generate`)で生成**したものをベースにする。ポイントのみ記載:

```ts
// packages/db/src/schema.ts(概略)
export const user = pgTable('user', {
  id: text('id').primaryKey(),              // Better Auth が生成
  name: text('name').notNull(),             // ユーザー名(表示名・非一意)
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  areaCode: text('area_code').notNull(),    // ★ additionalField: 気象庁 府県予報区コード(例 '130000' = 東京都)
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
})

// session / account / verification は Better Auth CLI 生成のまま

export const coordinate = pgTable(
  'coordinate',
  {
    id: serial('id').primaryKey(),
    date: date('date').notNull(),           // ★ 現行モデルに無かった日付カラムを追加
    outerwear: text('outerwear').notNull().default(''),
    tops: text('tops').notNull().default(''),
    bottoms: text('bottoms').notNull().default(''),
    imageKey: text('image_key'),            // コーデ写真のオブジェクトキー(Should 機能。写真なしは null)
    maxTemperature: real('max_temperature'), // 記録時点の予報最高気温スナップショット(null 可)
    minTemperature: real('min_temperature'), // 記録時点の予報最低気温スナップショット(null 可)
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  },
  (t) => [unique().on(t.userId, t.date)]    // ユーザー×日付で一意
)
```

現行スキーマからの変更点:

- **Prefecture テーブルを廃止**。地域マスタはコード(`packages/schema`)に持ち、user には府県予報区コード(`areaCode`)のみ保存する(正規化とシンプル化)。緯度経度は不要になる
- **Coordinate に `date` カラムを追加**し、`(userId, date)` を一意制約に(upsert 前提)
- **Coordinate に気温スナップショット(`maxTemperature` / `minTemperature`)を追加**。保存時にサーバー側が登録地域の予報キャッシュから該当日付の気温を引いて書き込み(予報範囲外の日付は null)、「似た気温の過去コーデ参照」「AI コーディネート提案」の材料を初回リリース時点から蓄積する(後から past データを復元するのは困難なため、これだけは Must フェーズで実装する)
- パスワードは Better Auth 管理(account テーブルの `password` に scrypt ハッシュ)。現行の bcrypt ハッシュは移行しない(本番ユーザー不在のため)

マイグレーションは drizzle-kit(`drizzle-kit generate` / `migrate`)で管理する。

---

## 5. API 設計(Hono)

| メソッド / パス | 認証 | 内容 |
| --- | --- | --- |
| `ALL /api/auth/*` | - | Better Auth ハンドラ(signup / login / logout / session / updateUser 等) |
| `GET /api/forecast?area={code}` | 必要 | 気象庁 JSON から週間予報を取得し整形して返す。`area` 省略時はユーザーの登録地域、指定時はマスタ照合の上その地域(地域切替用)。短期の天気・降水確率は一次細分区域、週間の天気は週間予報区域、気温は代表アメダス地点のデータを地域マスタで解決する |
| `GET /api/coordinates?from&to` | 必要 | 自分のコーデ一覧(期間指定可)。写真がある場合は短命の署名付き GET URL をレスポンスに同梱(Should) |
| `PUT /api/coordinates` | 必要 | `{ items: [{ date, outerwear, tops, bottoms, imageKey? }] }` を一括 upsert(**items は最大7件**)。気温スナップショットはサーバー側が登録地域の予報キャッシュから該当日付の値を引いて書き込む(予報範囲外の日付は null。クライアントからは受け取らない) |
| `DELETE /api/coordinates/:date` | 必要 | 指定日のコーデ削除。写真があればストレージのオブジェクトも削除(Should) |
| `POST /api/uploads` | 必要 | コーデ写真用の署名付きURL(presigned URL)を発行(Should)。ブラウザからストレージへ直接 PUT し、API サーバーに画像は通さない。**imageKey は `PUT /api/coordinates` で確定させる3ステップフロー**(presign → 直接 PUT → 確定)。確定されなかったキーは孤児オブジェクトとして許容し、定期掃除は Could |

### 設計原則

- セッション判定はミドルウェアで `auth.api.getSession({ headers })` を実行し、`c.get('user')` に格納。未認証は 401
- **エラーハンドリング(neverthrow)**: 外部 I/O(気象庁 JSON 取得・Drizzle・S3)は `ResultAsync` でラップし、型付きエラー(例: `FetchError | ParseError | UnknownAreaError | DbError`)として返す。ルートハンドラで HTTP ステータス(400 / 401 / 502 等)へ網羅的にマッピングし、例外はアプリ層に漏らさない。気象庁取得にはタイムアウト(`AbortSignal.timeout`)と軽量なリトライを併用する
- リクエストボディは `@hono/zod-validator` + `packages/schema` の Zod スキーマで検証(フロントと同一スキーマ)。`items` の件数上限(最大7件)もここで強制する
- 日付はすべて **JST 基準の `YYYY-MM-DD` 文字列**として API 境界・DB(`date` カラム)・URL パラメータで統一する(§9 参照)
- ルートはメソッドチェーンで定義し `export type AppType` を公開 → web 側 `hc<AppType>` で型安全に呼ぶ

### AI コーディネート提案(Could)への前方互換

- 気温スナップショットの蓄積(§4)により「似た気温の過去コーデ抽出」の材料が Must フェーズから貯まる
- コーデ写真は S3 互換ストレージにキーで保存されるため、署名付き URL で LLM に渡せる(追加の基盤変更は不要)
- 天気取得・提案生成(将来 `POST /api/suggestions`)は `apps/api` 内の独立モジュールとして分離しておく

---

## 6. 気象庁 API 統合

エンドポイント: `https://www.jma.go.jp/bosai/forecast/data/forecast/{取得コード}.json`

### 検証済みの構造仕様(2026-07-19 に全58区分の実レスポンスで検証)

- レスポンスは `[短期予報, 週間予報]` の**2要素配列**で、**天気・降水確率は一次細分区域単位、気温はアメダス地点単位**とキーが異なる
- **週間予報は翌日始まり**のため、当日の気温は短期パートから補完する。当日分などに空文字 `""` が入るため欠損値処理を必須とする
- **奄美(460040)・十勝(014030)は自分の予報 JSON を持たない(404)**。親区分(鹿児島 460100 / 釧路・根室 014100)のレスポンスに同居する(マスタの `forecastCode` で取得先を分離)
- **週間予報の天気・降水確率は大半の区分で広域(府県予報区単位)に統合**される(マスタの `weeklyArea` で解決。福島のみ「中通り・浜通り(070100)」という中間区域)
- 非公式 API のため、取得・整形は `apps/api` 内の1モジュールに隔離し、仕様変更時に差し替え可能な構造にする。構造差を吸収して共通の `Forecast` 型へ正規化する

### 地域マスタ(`packages/schema`)

`master-data/areas.ts` として**生成・検証済み**(全58区分。生成スクリプト `master-data/validate-areas.mjs` は `apps/api/scripts/validate-areas.ts` へ移植し、気象庁側の変更検知に継続利用する):

```ts
{
  code: '130000',        // 府県予報区コード(user.areaCode・地域セレクタの値)
  name: '東京都',
  weatherArea: '130010', // 一次細分区域コード(短期の天気・降水確率の解決用)
  weeklyArea: '130010',  // 週間予報の天気区域コード(週間は広域統合されるため別コード)
  tempStation: '44132'   // 代表アメダス地点コード(気温。短期・週間の両方に存在することを検証済み)
  // forecastCode: 予報 JSON の取得コード。奄美(460040→460100)・十勝(014030→014100)のみ code と異なる
}
```

### キャッシュ・障害時挙動

- **地域コード単位でサーバー側キャッシュ(30〜60分)**を行い、気象庁サーバーへの負荷をユーザー数に比例させない(インメモリ前提。デプロイ先決定時に §2 決定事項 #23 の注記を再確認)
- **気象庁取得失敗時(502)**: フロントは予報部にエラーメッセージと再試行ボタンを表示し、TanStack Query の stale データがあればそれを表示する。コーデ入力・保存は予報なしでも継続できる(スナップショットは null)

### 利用条件(法的整理)

- 政府標準利用規約(CC BY 4.0 互換)に基づき**出典明記で商用利用可**。「出典: 気象庁ホームページ」を常時表示する
- 予報は改変せず「そのまま表示」し、独自予報の生成はしない(気象業務法上の予報業務許可を不要に保つ)

---

## 7. 認証設計(Better Auth)

```ts
// apps/api/src/auth.ts(概略)
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  baseURL: process.env.BETTER_AUTH_URL,        // 例: http://localhost:3000
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.WEB_ORIGIN],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 20
  },
  user: {
    additionalFields: {
      areaCode: { type: 'string', required: true, input: true }
    }
  },
  rateLimit: {
    enabled: true          // ログイン総当たり対策(組み込み・メモリベース)
  },
  hooks: {
    before: signupValidationHook  // ★ サーバー側入力検証(下記参照)
  }
})
```

- 会員登録はフロントから `authClient.signUp.email({ email, password, name, areaCode })` の1回で完了(現行の自前 `/api/signin` は不要になる)
- フロントは `createAuthClient` + `inferAdditionalFields` プラグインで `areaCode` を型付け
- **`/api/auth/*` は zValidator を通らない**ため、サーバー側の入力検証は Better Auth の **`hooks.before`(signup / updateUser 対象)**で行う。`packages/schema` の Zod スキーマを再利用し、以下をすべてサーバー側で強制する(フロントの Zod 検証は UX 用であり、防御は hooks が担う):
  - パスワードの文字種ルール(小文字英字+数字を含む)
  - `areaCode` が地域マスタに実在すること
  - ユーザー名の形式(8文字以上・英数字のみ)

---

## 8. 画像ストレージ(Should)

- S3 互換 API 前提でコードを書き、契約先(R2 / S3 等)は実装時に決定。ローカル開発は MinIO(Docker)
- アップロードは **presign → ブラウザから直接 PUT → `PUT /api/coordinates` の `imageKey` で確定**の3ステップ(§5 参照)
- **サイズ上限(5MB)をサーバー側で強制するには presigned POST(`content-length-range`)対応が必要**。R2 は presigned POST 非対応のため、契約先選定時に対応可否を確認する
- 閲覧は短命の署名付き GET URL を API レスポンスに同梱。確定されなかったキー(孤児オブジェクト)は許容し、定期掃除は Could
- user 削除時、DB は cascade で消えるがストレージのオブジェクトは残る(孤児として同様に扱う)

---

## 9. 非機能要件・開発環境

### 環境変数(`.env.example`)

| 変数 | 用途 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 接続文字列 |
| `BETTER_AUTH_SECRET` | セッション署名シークレット |
| `BETTER_AUTH_URL` | 公開オリジン(例: `http://localhost:3000`) |
| `WEB_ORIGIN` | trustedOrigins 用 |
| `API_PORT` / `API_ORIGIN` | API サーバのポート / rewrites 先 |
| `STORAGE_ENDPOINT` / `STORAGE_BUCKET` / `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` | S3 互換ストレージ接続情報(Should: 写真アップロード導入時に追加。ローカルは MinIO を docker-compose に追加) |

### 日付・タイムゾーン方針

- 日付はすべて **JST 基準の `YYYY-MM-DD` 文字列**として扱い、`Date` オブジェクトをモジュール境界(API・DB・コンポーネント間)越しに渡さない
- 「今日」の判定・upsert キー・気象庁 JSON の `timeDefines`(+09:00)をすべて JST に統一し、サーバーの実行タイムゾーン(UTC 等)に依存した深夜0時前後の日付ズレを排除する
- 日付ユーティリティは `packages/schema` に置き、Vitest の対象とする

### バージョン管理方針

- 立ち上げ時に動作確認済みの組み合わせを **lockfile ごと最初の commit で固定**する
- アップグレードは**1パッケージずつ**行う(TanStack Start v1 / TS7 / oxfmt ベータ / Tailwind v4 / React 19 と全レイヤーが新しいため、問題発生時にどのレイヤーの問題かを切り分けられる状態を保つ)

### 開発コマンド(ルート)

| コマンド | 内容 |
| --- | --- |
| `pnpm docker` | PostgreSQL 起動(docker compose) |
| `pnpm dev` | web + api を並行起動(turbo) |
| `pnpm db:generate` / `pnpm db:migrate` | drizzle-kit マイグレーション |
| `pnpm db:seed` | シード(Better Auth `auth.api.signUpEmail` 経由でテストユーザー作成) |
| `pnpm lint` / `pnpm format` | oxlint / oxfmt(手動実行) |
| `pnpm typecheck` / `pnpm test` | tsc / Vitest(手動実行) |

### Lint / Format(VoidZero / Oxc)

- **oxlint**(1.x 安定版): ESLint 代替。設定は `.oxlintrc.json`(または `oxlint.config.ts`)。unused-imports 相当など主要ルールを有効化
- **oxfmt**(ベータ): Prettier 代替。JS/TS の Prettier 適合テスト100%通過・**Tailwind クラスソート内蔵**(prettier-plugin-tailwindcss が不要になる)。1.0 までは挙動変更の可能性がある点のみ留意
- Turborepo に公式の Oxc(oxlint / oxfmt)導入ガイドがあり、モノレポ構成と干渉しない

### テスト方針(Vitest)

- `packages/schema`: バリデーションスキーマ、地域マスタ(コードの一意性・形式)、日付/気温整形ユーティリティ
- `apps/api`: 気象庁 JSON → `Forecast` 型への正規化、キャッシュ動作、認証ミドルウェアの 401 応答
- UI テスト・E2E は今回スコープ外(将来 Playwright を検討)

### シードデータ

- テストユーザー: `admin@example.com` / `password123` / 地域 `130000`(東京都)
- サンプルコーデ2件(パスワードは Better Auth の API 経由で作成し、ハッシュ形式を揃える)

---

## 10. 新リポジトリ立ち上げ手順(推奨順)

1. **ワークスペース骨組み**: pnpm-workspace.yaml / turbo.json / tsconfig.base.json / oxlint・oxfmt 設定 / .env.example / docker-compose.yml
2. **packages/schema**: Zod スキーマ(signup / login / coordinates)、地域マスタ(**生成・検証済みの `master-data/areas.ts` を移植**)、日付(JST)/気温整形ユーティリティ + Vitest。検証スクリプト(`master-data/validate-areas.mjs`)も `apps/api/scripts/validate-areas.ts` として移植し、気象庁側の変更検知に使う
3. **packages/db**: Drizzle 設定 → Better Auth CLI でスキーマ生成 → user への `areaCode` 追加フィールドと `coordinate` テーブルを追記 → 初回マイグレーション
4. **apps/api**: Better Auth インスタンス(**hooks 検証・rateLimit 含む**)→ Hono ルート(auth マウント → セッションミドルウェア → forecast / coordinates)→ neverthrow による外部 I/O のエラー型整備 → シード → テスト
5. **apps/web**: TanStack Start + Tailwind v4(`@tailwindcss/vite`)+ shadcn/ui 導入 → auth-client / RPC client / TanStack Query → **まず signup → login → session 取得が Vite プロキシ越しに通ること(Set-Cookie の転送・trustedOrigins・Cookie 属性)を確認**してから、ルート実装(landing → signup → login → forecast、`beforeLoad` の認証ガード含む)に進む
6. **結合確認**: docker の PostgreSQL に対し signup → login → forecast 取得 → コーデ upsert の一連を通す
7. Should 機能(履歴・設定・削除・天気アイコン・写真アップロード)を順次追加。写真はストレージ契約(S3 互換)を決めてから着手

---

## 付録 A: UI ライブラリ選定(調査結果)

Tailwind v4 前提で shadcn/ui・daisyUI v5・HeroUI を比較調査した。

| 観点 | shadcn/ui | daisyUI v5 | HeroUI |
| --- | --- | --- | --- |
| 方式 | コンポーネントのソースをプロジェクトに取り込む(コード所有) | CSS クラスのみ(JS ゼロ) | 完成品 React コンポーネント |
| コンポーネント数 | 約44 | 約65 | 多い |
| カスタマイズ性 | ◎(コードを直接編集) | ○(クラス上書き) | △ |
| フォーム統合(RHF + Zod) | ◎(Form コンポーネントが公式パターン) | なし(自前) | ○ |
| アクセシビリティ | ◎(Radix ベース) | △(自前実装依存) | ◎ |
| 依存の重さ | 中(Radix 依存) | ゼロ | 重い |
| フレームワーク | React 専用 | 非依存 | React 専用 |

**結論: shadcn/ui を採用。**

- 本アプリの中心は「フォーム(会員登録・ログイン・コーデ入力)」と「トースト・ダイアログ」であり、RHF + Zod と統合された Form パターン、Radix ベースのアクセシブルな Select/Dialog/Toast(sonner)をそのまま使える shadcn/ui が最も要件に合う
- コード所有方式のためライブラリのバージョンアップに縛られず、モノレポでも `apps/web` 内で完結する
- daisyUI は JS ゼロで軽量だが、フォーム・トーストのロジックが結局自前になる。HeroUI は依存が重くカスタマイズの自由度が低い

参考: [daisyUI vs shadcn/ui](https://daisyui.com/compare/daisyui-vs-shadcn/) / [Best Tailwind CSS UI Libraries in 2026](https://stacknotice.com/blog/best-tailwind-ui-libraries-2026) / [DaisyUI vs Shadcn UI](https://windframe.dev/blog/daisyui-vs-shadcn-ui) / [10 Best Tailwind Component Libraries](https://spell.sh/blog/best-tailwind-component-libraries)
