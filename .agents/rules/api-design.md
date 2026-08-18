# API 設計ルール(apps/api)

- ルートは各 feature の `presentation` 層でメソッドチェーンで定義し、`app.ts` で合成して `export type AppType` を公開する。web からは `hc<AppType>`(Hono RPC)+ TanStack Query で呼ぶ。fetch を直接書かない
- セッション判定は `presentation` 層のミドルウェアで `auth.api.getSession({ headers })` を実行し `c.get('user')` に格納。未認証は 401
- Better Auth は `/api/auth/*` にマウント。会員登録はフロントの `authClient.signUp.email({ email, password, name, areaCode })` の1回で完結させる(自前の signup API を作らない)
- 保護ルート(`/forecast` 等)は TanStack Router の `beforeLoad` でセッション確認し、未認証は `/login` へリダイレクト

## レイヤー構成(軽量オニオン・機能優先。決定事項 #26)

`src/features/{auth,forecast,coordinate}/{domain,application,infrastructure,presentation}` + `src/shared/`。依存方向は `presentation → application → domain` で、`infrastructure` は domain のインターフェースを実装する(依存はドメインへ向く)。

- **domain**: 型・純粋関数のみ。Hono / Drizzle / fetch に依存しない。Repository のインターフェースもここ。**neverthrow の値には触れない**(生成も消費もしない)。Repository ポートの戻り値型としての型のみの依存(`import type { ResultAsync }`)だけを許容する
- **application**: ユースケース。infrastructure から受け取った `ResultAsync` を `.match()` 等で**消費する層**(消費はここまで)。ただし **`ResultAsync` を自ら生成せず、公開シグネチャにも出さない**。失敗時は型付きアプリケーションエラー(`ForecastUnavailableError` 等)を throw する
- **infrastructure**: 外部 I/O のアダプタ(気象庁・Drizzle・Better Auth・S3)。**`ResultAsync` を生成する唯一の層**(`ok()` / `err()` / `fromPromise` / `fromSafePromise` を書くのはここだけ)
- **presentation**: Hono ルート + `@hono/zod-openapi` の `createRoute`。**neverthrow には触れない**。throw されたエラーを `shared/http-errors.ts` で HTTP ステータスへ変換する
- **shared/**: `logger.ts`(pino)/ `openapi.ts`(OpenAPIHono + Swagger UI)/ `http-errors.ts`。全 feature から参照してよい
- DDD 戦術パターン(Entity / Value Object / 集約 / ドメインイベント)は導入しない

## 認可(所有権チェック)の実施場所

**DB に RLS は導入しない**(BaaS 不採用・DB への接続経路が `apps/api` の単一ロールのみのため、RLS を入れても結局アプリ側で利用者を渡す必要があり実質の防御が変わらない)。代わりに以下をサーバー側ロジックで必ず担保する。

- **`userId` はセッション(`c.get('user')`)からのみ得る**。リクエストボディ・クエリ・パスパラメータの `userId` は一切信用しない(そもそもスキーマに持たせない)
- **所有者条件は `infrastructure` 層の repository の内側に閉じ込める**。`domain` の Repository インターフェースは `userId` を必須引数に取る形で定義し、**それを省略できるメソッドを生やさない**(呼び出し側の付け忘れを型で潰す)

  ```ts
  // features/coordinate/domain/coordinate-repository.ts
  import type { ResultAsync } from 'neverthrow' // 型のみの依存(値は使わない)

  export interface CoordinateRepository {
    listByUser(userId: string, range?: DateRange): ResultAsync<Coordinate[], DbError>
    upsertForUser(userId: string, items: CoordinateInput[]): ResultAsync<Coordinate[], DbError>
    deleteForUser(userId: string, date: string): ResultAsync<void, DbError>
  }
  ```

- **更新・削除系は `WHERE id = ?` だけで引かず、必ず `AND user_id = ?` を併記する**(IDOR の典型的な穴)。`PUT /api/coordinates` は `(userId, date)` 一意の upsert、`DELETE /api/coordinates/:date` も `userId` を条件に含める
- **`PUT /api/coordinates` の空入力による削除分岐も同じ扱い**。3項目が trim 後すべて空の item はその日付のレコード削除に分岐する(`validation.md`)ため、**`WHERE date = ?` ではなく `WHERE user_id = ? AND date = ?` で引く**。削除分岐は upsert と**同一トランザクション**内で行い、同じリクエスト内の他 item と原子性を共有する
- **他人のリソースを指定された場合と存在しない場合を区別しない**。403 ではなく **404(または該当0件)で統一**する(403 を返すと ID の存在自体が漏れる)
- 写真(Should)は DB の外にあり同じ仕組みで守れないため、`imageKey` のプレフィックス(`coordinates/{userId}/`)がリクエスト元ユーザーと一致することを `PUT /api/coordinates` で検証する(architecture.md §8)
- **この保証を担保するのはテスト**(RLS という DB 側の網がない以上、代替はテストしかない)。必須ケースは `testing.md` を参照

## エラーハンドリング(neverthrow)

**層境界は「生成 = infrastructure / 消費 = application」の一方向で一意に定める**。

| 層 | neverthrow の扱い |
| --- | --- |
| domain | 触れない。Repository ポートの**型注釈のみ**(`import type { ResultAsync }`) |
| infrastructure | **生成する唯一の層**(`ok()` / `err()` / `fromPromise`) |
| application | **消費する層**(`.match()` 等)。生成しない・公開シグネチャに出さない |
| presentation | 触れない(application が throw した型付きエラーだけを受ける) |

- 外部 I/O(気象庁 JSON 取得・Drizzle・S3)は `infrastructure` 層で `ResultAsync` でラップし、型付きエラー(`FetchError | ParseError | UnknownAreaError | DbError` 等)で返す
- `presentation` 層で HTTP ステータス(400 / 401 / 502 等)へ**網羅的に**マッピングし、例外を Hono フレームワーク層に漏らさない
- 気象庁取得には `AbortSignal.timeout` によるタイムアウトと軽量リトライを併用する(infrastructure 層)

## ロギング・API ドキュメント

- ロギングは **pino のみ**(`shared/logger.ts`。Hono 標準の `logger` ミドルウェアは使わない)。method / path / status / duration / requestId を構造化(JSON)出力し、レベルは `LOG_LEVEL` で制御。neverthrow のエラー分岐でも型付きエラーの内容をログする。**`apps/web` には導入しない**
- ルートは `@hono/zod-openapi` の `createRoute` で定義し、`packages/schema` の Zod スキーマを転用する(OpenAPI 定義を二重管理しない)。`GET /api/openapi.json` + `GET /api/doc`(`@hono/swagger-ui`)を公開し、**手動の API 仕様書を作らない**

## エンドポイント仕様(architecture.md §5 に従う)

- `GET /api/forecast?area={code}`: `area` 省略時は登録地域、指定時はマスタ照合の上その地域
- `GET /api/coordinates?from&to`: **セッションのユーザーのコーデのみ**(`from <= to` / 最大366日 / 両方省略で直近30件)。写真があれば短命の署名付き GET URL を同梱
- `PUT /api/coordinates`: 一括 upsert(`(userId, date)` 一意)。items 最大7件。ボディの **`snapshotId`(表示していた予報の世代)**が指すキャッシュから気温スナップショットを書き込む(決定事項 #30)。`snapshotId` が無い/失効時は既存の気温・由来を維持(#31)。各 item の `updatedAt` が DB と不一致なら 409(#32)
- `DELETE /api/coordinates/:date`: **セッションのユーザーのレコードのみ**を対象にする。写真があればストレージのオブジェクトも削除
- `POST /api/uploads`: presign → ブラウザ直接 PUT → `PUT /api/coordinates` の `imageKey` で確定の3ステップ。画像を API サーバーに通さない(サムネイル生成もしない)。孤児オブジェクトは許容
- `GET /api/doc` / `GET /api/openapi.json`: Swagger UI と OpenAPI 定義(認証不要)

## 通信経路

- ブラウザ → web(:3000)→ `/api/*` を api(:3001)へプロキシ(開発は Vite dev proxy、本番は Nitro サーバールート)。同一オリジンを保ち CORS/Cookie 問題を作らない
