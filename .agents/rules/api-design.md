# API 設計ルール(apps/api)

- ルートはメソッドチェーンで定義し `export type AppType` を公開する。web からは `hc<AppType>`(Hono RPC)+ TanStack Query で呼ぶ。fetch を直接書かない
- セッション判定はミドルウェアで `auth.api.getSession({ headers })` を実行し `c.get('user')` に格納。未認証は 401
- Better Auth は `/api/auth/*` にマウント。会員登録はフロントの `authClient.signUp.email({ email, password, name, areaCode })` の1回で完結させる(自前の signup API を作らない)
- 保護ルート(`/forecast` 等)は TanStack Router の `beforeLoad` でセッション確認し、未認証は `/login` へリダイレクト

## エラーハンドリング(neverthrow)

- 外部 I/O(気象庁 JSON 取得・Drizzle・S3)は `ResultAsync` でラップし、型付きエラー(`FetchError | ParseError | UnknownAreaError | DbError` 等)で返す
- ルートハンドラで HTTP ステータス(400 / 401 / 502 等)へ**網羅的に**マッピングし、例外をアプリ層に漏らさない
- 気象庁取得には `AbortSignal.timeout` によるタイムアウトと軽量リトライを併用する

## エンドポイント仕様(architecture.md §5 に従う)

- `GET /api/forecast?area={code}`: `area` 省略時は登録地域、指定時はマスタ照合の上その地域
- `GET /api/coordinates?from&to`: 自分のコーデのみ。写真があれば短命の署名付き GET URL を同梱
- `PUT /api/coordinates`: 一括 upsert(`(userId, date)` 一意)。items 最大7件
- `DELETE /api/coordinates/:date`: 写真があればストレージのオブジェクトも削除
- `POST /api/uploads`: presign → ブラウザ直接 PUT → `PUT /api/coordinates` の `imageKey` で確定の3ステップ。画像を API サーバーに通さない。孤児オブジェクトは許容

## 通信経路

- ブラウザ → web(:3000)→ `/api/*` を api(:3001)へプロキシ(開発は Vite dev proxy、本番は Nitro サーバールート)。同一オリジンを保ち CORS/Cookie 問題を作らない
