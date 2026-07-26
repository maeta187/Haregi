# API 設計ルール(apps/api)

- ルートは各 feature の `presentation` 層でメソッドチェーンで定義し、`app.ts` で合成して `export type AppType` を公開する。web からは `hc<AppType>`(Hono RPC)+ TanStack Query で呼ぶ。fetch を直接書かない
- セッション判定は `presentation` 層のミドルウェアで `auth.api.getSession({ headers })` を実行し `c.get('user')` に格納。未認証は 401
- Better Auth は `/api/auth/*` にマウント。会員登録はフロントの `authClient.signUp.email({ email, password, name, areaCode })` の1回で完結させる(自前の signup API を作らない)
- 保護ルート(`/forecast` 等)は TanStack Router の `beforeLoad` でセッション確認し、未認証は `/login` へリダイレクト

## レイヤー構成(軽量オニオン・機能優先。決定事項 #26)

`src/features/{auth,forecast,coordinate}/{domain,application,infrastructure,presentation}` + `src/shared/`。依存方向は `presentation → application → domain` で、`infrastructure` は domain のインターフェースを実装する(依存はドメインへ向く)。

- **domain**: 型・純粋関数のみ。Hono / Drizzle / fetch / neverthrow に依存しない。Repository のインターフェースもここ
- **application**: ユースケース。**neverthrow を公開シグネチャに出さない**。infrastructure の `ResultAsync` は `.match()` 等で内部処理し、失敗時は型付きアプリケーションエラー(`ForecastUnavailableError` 等)を throw する
- **infrastructure**: 外部 I/O のアダプタ(気象庁・Drizzle・Better Auth・S3)。**neverthrow はこの層のみ**
- **presentation**: Hono ルート + `@hono/zod-openapi` の `createRoute`。throw されたエラーを `shared/http-errors.ts` で HTTP ステータスへ変換する
- **shared/**: `logger.ts`(pino)/ `openapi.ts`(OpenAPIHono + Swagger UI)/ `http-errors.ts`。全 feature から参照してよい
- DDD 戦術パターン(Entity / Value Object / 集約 / ドメインイベント)は導入しない

## エラーハンドリング(neverthrow)

- 外部 I/O(気象庁 JSON 取得・Drizzle・S3)は `infrastructure` 層で `ResultAsync` でラップし、型付きエラー(`FetchError | ParseError | UnknownAreaError | DbError` 等)で返す
- `presentation` 層で HTTP ステータス(400 / 401 / 502 等)へ**網羅的に**マッピングし、例外を Hono フレームワーク層に漏らさない
- 気象庁取得には `AbortSignal.timeout` によるタイムアウトと軽量リトライを併用する(infrastructure 層)

## ロギング・API ドキュメント

- ロギングは **pino のみ**(`shared/logger.ts`。Hono 標準の `logger` ミドルウェアは使わない)。method / path / status / duration / requestId を構造化(JSON)出力し、レベルは `LOG_LEVEL` で制御。neverthrow のエラー分岐でも型付きエラーの内容をログする。**`apps/web` には導入しない**
- ルートは `@hono/zod-openapi` の `createRoute` で定義し、`packages/schema` の Zod スキーマを転用する(OpenAPI 定義を二重管理しない)。`GET /api/openapi.json` + `GET /api/doc`(`@hono/swagger-ui`)を公開し、**手動の API 仕様書を作らない**

## エンドポイント仕様(architecture.md §5 に従う)

- `GET /api/forecast?area={code}`: `area` 省略時は登録地域、指定時はマスタ照合の上その地域
- `GET /api/coordinates?from&to`: 自分のコーデのみ。写真があれば短命の署名付き GET URL を同梱
- `PUT /api/coordinates`: 一括 upsert(`(userId, date)` 一意)。items 最大7件。ボディの `areaCode`(表示中の地域)をマスタ照合し、その地域の予報から気温スナップショットを書き込む(決定事項 #29)
- `DELETE /api/coordinates/:date`: 写真があればストレージのオブジェクトも削除
- `POST /api/uploads`: presign → ブラウザ直接 PUT → `PUT /api/coordinates` の `imageKey` で確定の3ステップ。画像を API サーバーに通さない(サムネイル生成もしない)。孤児オブジェクトは許容
- `GET /api/doc` / `GET /api/openapi.json`: Swagger UI と OpenAPI 定義(認証不要)

## 通信経路

- ブラウザ → web(:3000)→ `/api/*` を api(:3001)へプロキシ(開発は Vite dev proxy、本番は Nitro サーバールート)。同一オリジンを保ち CORS/Cookie 問題を作らない
