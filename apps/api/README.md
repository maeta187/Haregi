# API の開発

Node.js 22.22.2 系と PostgreSQL を使用する。リポジトリ直下の `.env` に
`.env.example` の認証・DB 設定を用意し、ルートから実行する。

```sh
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`pnpm --filter @haregi/api start` でも API 単体を起動できる。
dev / start は既存と同じ Node の TypeScript 型ストリッピング方式。
起動・seed・API テストは `.env` を読み込み、`TZ=UTC` を明示的に注入する。
環境に設定済みの値が `.env` より優先される。

`/api/auth/*` は Better Auth のハンドラに委譲する。会員登録・ユーザー更新・
パスワード変更のサーバー側検証は `hooks.before` に集約する。
後続の保護ルートでは `sessionMiddleware(auth.api)` を適用し、
`c.get('user')` を利用する。未認証は 401。
`/api/doc` は Swagger UI、`/api/openapi.json` は Hono 側の OpenAPI 定義。
Better Auth が所有する認証 API の仕様を手書きで二重管理しない。

## 実 DB テスト

`pnpm test` または `pnpm --filter @haregi/api test` で実行する。
`DATABASE_URL` のロールには一時 DB を作成できる権限が必要
(付属 Docker Compose のロールで実行可能)。
テストごとに `haregi_test_` 接頭辞の空の DB を作り、終了時に削除する。
開発 DB の既存テーブル・データや DB のタイムゾーン設定は変更しない。
DB の状態に依存するため API テストは Turbo キャッシュを使用しない。

## フェーズ3からの認証スキーマ補正

既存の Better Auth **1.7.1** は `account.issuer` と
`(issuer, accountId)` の一意インデックスを要求するが、フェーズ3の
CLI 生成物にはなかった。登録テストで不整合を検出したため、
同版の `auth@1.7.1` CLI の生成内容と照合して補完した。
初回 SQL を書き換えず、`0001_auth_issuer.sql` として追加している。
既存行があっても適用できるよう、nullable で追加 → `provider_id = 'credential'`
へ 1.7.1 の `local:credential` をバックフィル → `NOT NULL` と一意インデックス、
の順で行う。credential 以外の provider が残っている場合は issuer を推測せず
例外で中断する(ソーシャルログインは非スコープで、誤った値を埋めると
アカウント紐付けが壊れるため)。
認証テーブルの時刻カラムはタイムゾーンなしのまま維持する。

CLI に渡す認証設定の正は `src/features/auth/infrastructure/auth.ts`。
旧 `packages/db/better-auth.ts` は削除し、設定の二重管理を解消した。
再生成時にもランタイムと同じ **1.7.1** の CLI と環境変数を使用する。
`neverthrow` は後続の外部 I/O 用に導入済みだが、設計どおり認証機能では
Better Auth の例外を扱い、不要な Result ラッパーは作らない。
