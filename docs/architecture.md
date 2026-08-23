# Haregi(ハレギ)アーキテクチャドキュメント

Haregi の技術設計。**どう作るか**(スタック・構成・データモデル・API・認証・非機能要件)を定義する。要件(何を作るか)は [specification.md](./specification.md) を参照。

- 作成日: 2026-07-19([rebuildspec.md](./rebuildspec.md) からの分割。検討経緯・盲点レビューの記録はそちらを参照)
- 更新: 2026-07-25(決定事項 #26〜#29 を追加。バックエンド/フロントエンドのレイヤー構成・TDD 方針・気温スナップショットの基準地域を明確化)
- 更新: 2026-08-03(設計レビュー反映: 決定事項 #30〜#32 を追加。気温スナップショットの同一性保証(`snapshotId`)・編集時の維持ポリシー・一括 upsert の楽観ロック。併せてキャッシュの last-known-good / 束ね / バックオフ、Coordinate への由来カラム、写真の所有権・EXIF・孤児掃除を明文化)
- 更新: 2026-08-18(決定事項 #32 を fail-closed 化(`updatedAt` の省略も 409・条件付き書き込みで TOCTOU 回避・成功時のトークン前進・空入力 item の no-op)。楽観ロックのトークンを `updatedAt` から単調増加する `version` 整数へ変更(時計の同値・逆行に依存しない保証)。決定事項 #33 を追加。認可(所有権)を RLS ではなくサーバー側ロジックで担保する方針を明文化。併せて neverthrow の層境界を明確化: 生成は infrastructure・消費は application、domain は Repository ポートの型注釈のみ、presentation は使用しない)
- 更新: 2026-08-18(`snapshotId` の耐障害性: 予報世代を **PostgreSQL に永続化**(決定事項 #34。プロセス再起動・複数インスタンスでも引き当てられる)。`snapshotId` が**送られたのに解決できない場合は 409** とし、再取得を要求する(決定事項 #35)。決定事項 #31 の「既存維持」は `snapshotId` の**省略時のみ**に限定した。併せて、stale 応答でも新しい世代を発行する不変条件と、失効を掃除ではなく引き当てクエリの条件で判定することを明記)
- 更新: 2026-08-22(実装レビュー反映: 自前定義テーブルの絶対時刻を `timestamptz` に統一(失効判定を DB セッションの TZ から独立させる)。`date` は `mode: 'string'` を明示。DB の CHECK 制約・enum を導入しない判断と、その代替である `$type<>()` を §4 に明記。認証テーブルの tz なし列を許容する条件として **全 Node プロセスの `TZ=UTC` 固定**と、フェーズ4a での交差 TZ テストを §9 に追加。§9 で「暦日」と「絶対時刻」を区別)
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
| ロギング | pino(`apps/api` のみ。構造化ログ) |
| API ドキュメント | `@hono/zod-openapi` + `@hono/swagger-ui`(`/api/doc` で Swagger UI 公開) |
| テスト | Vitest(全層で TDD) |
| コンポーネントテスト | `@testing-library/react` + `@testing-library/jest-dom`(`apps/web`) |
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
| 23 | デプロイ先 | **未定(明示的保留)** | 現段階では決めない。ただしサーバー側キャッシュ(インメモリ前提)と web→api の2プロセス+プロキシ構成は **Node 常駐プロセスを暗黙の前提**としており、サーバーレス系を選ぶ場合はキャッシュ置き場とプロキシ構成の再設計が必要になる点をデプロイ先決定時に再確認する。なお**予報世代(`snapshotId`)の保持は決定事項 #34 で PostgreSQL へ移した**ため、再設計の対象として残るのは「気象庁への取得を抑制するインメモリキャッシュ(TTL 30〜60分)」とプロキシ構成であり、保存時の気温解決はプロセス構成に依存しない |
| 24 | ロギング | **pino を `apps/api` に導入** | Hono の標準 `logger` ミドルウェアより構造化(JSON)出力・ログレベル制御に優れ、本番運用時の解析がしやすい。web には導入しない(SSR/ブラウザ両対応のログ基盤は本規模には過剰) |
| 25 | API ドキュメント | **`@hono/zod-openapi` + `@hono/swagger-ui`** | 既存の Zod スキーマ(`packages/schema`)をそのまま OpenAPI 定義に転用でき、二重管理を避けられる。`/api/doc` で Swagger UI を公開し、手動での API 仕様書メンテナンスを不要にする |
| 26 | バックエンドアーキテクチャ | **軽量オニオンアーキテクチャ(機能優先ディレクトリ)** | `apps/api` に domain/application/infrastructure/presentation の4層分離を導入し、外部 I/O(気象庁・DB・Better Auth)への依存をドメインロジックから切り離す。全3機能(認証・天気予報・コーディネート)の規模では DDD 戦術パターン(集約・値オブジェクト等)は過剰と判断し見送り。ディレクトリは既存の機能単位垂直スライス(実装プランのフェーズ4〜6)と一致させるため層優先ではなく機能優先(`features/{auth,forecast,coordinate}/{domain,application,infrastructure,presentation}`)を採用。neverthrow は従来どおり `apps/api` のみだが、**生成を infrastructure 層・消費を application 層に限定**し(domain は Repository ポートの戻り値型として型のみ参照してよく、presentation は触れない)、application 層より外は型付きエラーの throw/catch に統一する(決定事項 #19 を具体化) |
| 27 | 開発プロセス | **フロントエンド・バックエンド共に TDD(テスト駆動開発)で実装** | 各層・各コンポーネントとも「失敗するテストを書く(Red)→ 実装して通す(Green)→ リファクタリング(Refactor)」の順で進める。バックエンドは `domain` の純粋ロジックと `application` のユースケースを中心に単体テストを先行させる。フロントエンドは `packages/schema` 側のバリデーション/日付ユーティリティに加え、`apps/web` の React コンポーネントも `@testing-library/react` でテストを先行させる(決定事項 #11 の「UI テスト・E2E はスコープ外」を修正し、**コンポーネントテストはスコープ内・E2E は引き続きスコープ外**とする) |
| 28 | フロントエンドアーキテクチャ | **機能優先スライス + 副作用の層分離(軽量 FSD 風)** | `apps/web` に Feature-Sliced Design の思想のうち「機能スライス」と「依存方向の一方向ルール」のみを採用し、`features/{auth,forecast,coordinate}/{components,hooks,api,model}` の構成をとる。api 側の軽量オニオン(決定事項 #26)と層が対応(routes ≒ presentation / hooks ≒ application / api ≒ infrastructure / model ≒ domain)するため、実装プランの垂直スライスを web にもそのまま適用でき、両側を同じ語彙で語れる。FSD 本来の6層(app/pages/widgets/features/entities/shared)は全3機能の規模では entities / widgets が空洞化するため採らない。Atomic Design は shadcn/ui と粒度定義が競合するため不採用。グローバル状態管理ライブラリ(Redux / Zustand 等)も不採用(サーバー状態は TanStack Query、セッションは Better Auth client、フォームは RHF が保持するため残余状態がほぼない) |
| 29 | 気温スナップショットの基準地域 | **保存時に「表示中の地域」の予報から引く** | 表示地域の切替(spec §2.2 Must)があるため、登録地域固定にすると画面に表示されていた気温と DB の記録が食い違い、後から復元できない。サーバーが表示中地域の予報から解決する(**気温値そのものはクライアントから受け取らない**原則は維持。決定事項 #21 と併せて §5 参照)。地域をまたいだ記録が同一履歴に混在する点は許容し、「似た気温の日に何を着たか」(Could)の実装時に地域の扱いを再検討する。**地域の指定方法は決定事項 #30 で `areaCode` から `snapshotId` に変更した** |
| 30 | 表示気温と保存値の同一性 | **`snapshotId` を往復させ、表示に使ったのと同一世代から気温を引く** | 決定事項 #29 の当初案(`areaCode` を送りサーバーが保存時に予報を引き直す)では、spec §2.3 の「画面に出ていた気温と記録が一致する」保証を満たせない。表示から保存までの間にキャッシュが更新される・画面が TanStack Query の stale データを表示している・保存時だけ気象庁取得に失敗する、のいずれでも画面と DB が食い違うため。`GET /api/forecast` が予報世代ごとに `snapshotId` を発行し、`PUT /api/coordinates` はそれを送り返す。**気温値をクライアントから受け取らない原則は維持**され(改ざんできるのは「どの世代か」だけで値ではない)、かつサーバーは引き直さない。予報世代は**インメモリキャッシュではなく PostgreSQL に永続化**して引き当てる(決定事項 #34)。`snapshotId` が**送られたのに解決できない**場合は 409 を返して再取得を求める(決定事項 #35)。**送られなかった**場合のみ決定事項 #31 に従い既存値を維持する。併せて由来(`areaCode` / `tempStation` / `forecastIssuedAt` / `snapshotStatus`)を Coordinate に保存し、後から「どの地域・どの地点・いつ発表の予報・stale だったか」を説明できるようにする(§4 参照) |
| 31 | 編集時のスナップショット | **`snapshotId` が送られない場合は既存の気温・由来を維持する** | 「保存のたびに予報を引き直す」設計だと、過去日のコーデを文言だけ編集した際に予報範囲外となり、蓄積済みの気温が null で上書きされて失われる。気温スナップショットは本アプリの差別化(「気温と紐付けて振り返る」「似た気温の日」「AI 提案」)の土台であり、後から復元できないため、**編集操作で失われないことを最優先**する。実装上は「`snapshotId` があればその世代から引いて上書き、**なければ**既存値を維持」とし、新規作成・当該週の再計画では前者、過去記録の文言修正では後者が自然に選ばれる。**この「維持」は `snapshotId` が省略された場合に限る**(決定事項 #35)。送られたのに解決できない `snapshotId` を「省略」と同じ扱いにすると、ユーザーは画面の気温が記録されたと信じたまま実際には別世代の古い値(または null)が残り、決定事項 #30 の同一性保証が黙って破れるため、その場合は 409 とする。**この挙動は実装前にテストケースとして固定する**(過去日の編集で気温が保持されること・予報範囲外の新規作成で null になること) |
| 32 | 一括 upsert の競合制御 | **各 item の `version`(単調増加する整数)で楽観ロックし、不一致・省略とも 409(fail-closed・条件付き書き込み)** | `PUT /api/coordinates` は最大7件を一括で置き換えるため、2つの画面(別タブ・スマホと PC)で同じ週を開くと、古い画面からの保存が新しい変更を黙って上書きする。ペルソナが「週の初めにまとめて計画する」使い方をする以上、同じ週を複数デバイスで触る状況は例外ではない。読み込み時の `version` を各 item に含め、サーバー側で DB の値と照合し、不一致なら 409 を返してフロントに再読み込みを促す。新規作成(既存レコードなし)の場合のみ `version` を送らない。**照合は fail-closed とし、既存レコードに対する `version` の省略も 409 とする**(任意扱いのままでは、値を送らないだけでロックを迂回して他の編集を無言で上書きでき、全項目が空の item ではレコード削除にまで至るため、楽観ロックが実質無効になる)。**実装は「SELECT で照合 → UPDATE / DELETE」の二段構えにしない**。並行リクエストが両方とも照合を通過する TOCTOU が残るため、`WHERE user_id = ? AND date = ? AND version = ?` の条件付き書き込みを1文で実行し、**更新件数0を競合として 409** に変換する。新規作成は `(userId, date)` 一意制約の衝突を 409 に変換する。空入力による削除分岐も同じ条件付き書き込みで行い、1件でも競合したらトランザクション全体をロールバックする。**成功した更新では同じ文の中で `version = version + 1` し、新しい値をレスポンスで返す**。前進させないと更新後も旧トークンが有効なままとなり、同じ値を持つ後続リクエストが何度でも条件を満たして並行保存が両方成功する。**トークンに `updatedAt`(wall-clock)を使わない**理由は、カラム精度内で同値になる場合や NTP による時計の逆行で「更新後も旧トークンが一致する」状態が生じ、等値照合のトークンに必要な『版ごとに必ず値が変わる』性質を保証できないため。`version` は DB 内のインクリメントで生成されるため、時計にもアプリの状態にも依存しない(`updatedAt` は監査用に残す)。**空入力の item は削除対象が存在しない場合のみ no-op(200)**とし、存在するのに `updatedAt` が不一致・省略なら 409 とする(未入力の日を含む一括送信がペルソナの常態であり、そこで 409 を返すとバッチ全体が失敗して通常操作が成り立たないため。存在確認は 409 か no-op かの判定にのみ用い、破壊的書き込みの根拠にはしない) |
| 33 | 認可(所有権)の実施方法 | **DB の RLS は導入せず、サーバー側ロジックで担保する** | BaaS を採用せず(決定事項 #4)、DB への接続経路は `apps/api` の単一プロセス・単一ロールのみで、クライアントが DB に直結しない。この構成では RLS を入れても利用者の受け渡し(`SET LOCAL` 相当)をアプリ側で書く必要があり、防御の実質が変わらないまま二重管理になる。代わりに (a) `userId` はセッションからのみ取得し、リクエストの `userId` を信用しない (b) 所有者条件を `infrastructure` 層の Repository の内側に閉じ込め、`userId` を省略できるメソッドを定義しない (c) 更新・削除は必ず `AND user_id = ?` を併記する (d) 他人のリソースと不存在を区別せず 404 に統一する、をルール化する(`.agents/rules/api-design.md`)。**DB 側の網がない以上この保証を担うのはテストであり**、他ユーザーのレコードを取得・更新・削除できないことを必須テストケースとして固定する(`.agents/rules/testing.md`)。将来 DB に直接触れる経路が増える場合(管理用サービス・分析ツール・接続元が分散するデプロイ構成)は前提が変わるため再検討する |
| 34 | 予報世代(`snapshotId`)の保持先 | **PostgreSQL に永続化する(インメモリキャッシュには置かない)** | 決定事項 #30 の同一性保証は「`GET` で表示した世代を `PUT` で引き当てられる」ことに依存する。プロセスローカルなインメモリキャッシュだけに置くと、`GET` 後の再起動(デプロイ・クラッシュ・ローリング更新)や、`PUT` が別インスタンスへ振り分けられた場合に、保持期間内でも世代を解決できない。**「Node 常駐プロセス」(決定事項 #23)は再起動や水平スケールを防ぐ保証ではない**。`forecast_snapshot` テーブル(§4)に世代ごと1行を書き、`snapshotId` で引く。**役割を分ける**: 気象庁への発信抑制は従来どおりインメモリキャッシュ(TTL 30〜60分)が担い、世代の引き当てはテーブルが担う。保持は24時間とし、取得時に期限切れの行を掃除する。書き込みは地域ごと30〜60分に1回程度で、追加の依存パッケージも要らない(既存の PostgreSQL + Drizzle で完結する)。**`GET /api/forecast` が 200 を返すときは必ず引き当て可能な `snapshotId` を返す**(last-known-good を stale として返す場合も新しい行を発行する)。**失効の判定は引き当てクエリの条件(`created_at > now() - interval '24 hours'`)で行い**、行の掃除は容量管理として別に走らせる(掃除の実行有無に失効判定を依存させない) |
| 35 | `snapshotId` が解決できない場合 | **黙って保存せず 409 を返し、予報の再取得を求める** | 「送られていない」(決定事項 #31 の既存維持)と「送られたが解決できない」を区別しない実装では、保持期間を超えた世代・掃除済みの世代を指す保存が、新規行では null、既存行では古い値のまま**成功**してしまい、ユーザーは画面に出ていた気温が記録されたと信じたまま食い違いに気づけない。気温スナップショットは後から復元できないため、**曖昧なまま保存するより失敗させる**。フロントは 409 を受けたら予報を再取得し、新しい `snapshotId` で再送する(入力中のコーデは保持する)。**`version` 競合の 409(決定事項 #32)とはエラーコードで区別する** — 前者は「再読み込みして編集し直す」、後者は「予報を取り直して同じ入力のまま再送する」であり、ユーザーに促す操作が異なるため。**気象庁の障害が長期化しても 409 のループにはならない** — 決定事項 #34 の不変条件により、stale 表示のときも `GET` が有効な `snapshotId` を返すため、再取得 → 再送で保存できる(記録は `snapshotStatus: 'stale'`)。**予報が取れないこと自体は保存を妨げない** — `snapshotId` を送らなければ従来どおり保存でき、気温は null(新規)または既存維持(更新)になる(決定事項 #31)。この区別は spec §2.2 の「予報が取れなくてもコーデ入力・保存は継続できる」と両立する |

---

## 3. モノレポ構成 / 通信経路

```
haregi/
├── apps/
│   ├── web/                  # TanStack Start(フロントエンド。機能優先スライス・軽量 FSD 風)
│   │   └── src/
│   │       ├── routes/               # TanStack Router ファイルルーティング(/, /signup, /login, /forecast, ...)
│   │       │                         # ルート定義・beforeLoad の認証ガード・features の合成のみ(ロジックを書かない)
│   │       ├── features/
│   │       │   ├── auth/
│   │       │   │   ├── components/   # 表示のみ(props in / callback out。副作用を持たない)
│   │       │   │   ├── hooks/        # ユースケース相当(useSignup / useSession。TanStack Query を包む)
│   │       │   │   ├── api/          # 外部 I/O 相当(hc<AppType> / authClient 呼び出しをここに閉じる)
│   │       │   │   └── model/        # 表示用の純粋変換のみ(任意。ビジネスルールは packages/schema)
│   │       │   ├── forecast/         # 天気予報機能(同構成)
│   │       │   └── coordinate/       # コーディネート機能(同構成)
│   │       ├── components/ui/        # shadcn/ui 取り込み先(原則手を入れない)
│   │       └── lib/                  # auth-client, api-client(Hono RPC + TanStack Query), query-client, cn
│   └── api/                  # Hono(バックエンド。軽量オニオンアーキテクチャ・機能優先ディレクトリ)
│       ├── src/
│       │   ├── features/
│       │   │   ├── auth/                # 認証機能
│       │   │   │   ├── domain/          # ドメインロジック(外部依存なし。純粋関数・型)
│       │   │   │   ├── application/     # ユースケース(Repository インターフェース経由でドメインを orchestrate)
│       │   │   │   ├── infrastructure/  # Better Auth・Drizzle アダプタ(ResultAsync を生成するのはこの層のみ)
│       │   │   │   └── presentation/    # Hono ルート + OpenAPI 定義。ユースケースの例外を HTTP ステータスへ変換
│       │   │   ├── forecast/            # 天気予報機能(同様の4層構成)
│       │   │   └── coordinate/          # コーディネート機能(同様の4層構成)
│       │   ├── shared/
│       │   │   ├── logger.ts            # pino インスタンス + リクエストロギングミドルウェア
│       │   │   ├── openapi.ts           # OpenAPIHono 構築 + Swagger UI(`/api/doc`)セットアップ
│       │   │   └── http-errors.ts       # アプリケーションエラー → HTTP ステータスの共通マッピング
│       │   ├── app.ts                   # 各 feature の presentation ルータを合成し `AppType` をエクスポート
│       │   └── index.ts                 # @hono/node-server エントリ
│       └── scripts/          # seed.ts / validate-areas.ts(全58区分の実レスポンス検証)
├── packages/
│   ├── db/                   # Drizzle スキーマ + クライアント + drizzle-kit 設定
│   └── schema/               # Zod スキーマ / 地域マスタ(生成済み areas.ts を移植) / 日付(JST)・気温整形ユーティリティ
├── docker-compose.yml        # PostgreSQL
├── turbo.json
├── pnpm-workspace.yaml
└── .env.example
```

### apps/api のレイヤー構成(軽量オニオンアーキテクチャ)

`apps/api` は機能(auth / forecast / coordinate)優先のディレクトリ配下に、各機能とも同じ4層を持つ**軽量オニオンアーキテクチャ**を採用する。DDD の戦術パターン(Entity / Value Object / Aggregate / ドメインイベント)は導入せず、層分離とその依存方向のみを目的とする。

```
presentation → application → domain
infrastructure ┘         (domain のインターフェースを実装。依存はドメインへ向く)
```

- **domain**: 型・純粋なドメインロジックのみ。他層(Hono・Drizzle・fetch)への依存を持たない。Repository の**インターフェース**もここに定義する(依存性逆転)。**neverthrow の値には触れない**(生成も消費もしない)が、Repository ポートの戻り値型を表現するための型のみの依存(`import type { ResultAsync }`)は許容する — infrastructure が `ResultAsync` を返す以上ポートの型もそれを指す必要があり、ここを禁じると実装者がポートの配置か戻り値の型を独自判断で変えることになるため(決定事項 #26 の具体化)
- **application**: ユースケース(例: `signup`, `getForecast`, `upsertCoordinates`)。domain のインターフェース経由で infrastructure を呼び出す。**`ResultAsync` を消費する層**(消費はここまで)であり、`ResultAsync` を自ら生成せず、**この層の公開シグネチャにも出さない**。infrastructure から返る `ResultAsync` は `.match()` などでこの層の内部で処理し、失敗時は型付きのアプリケーションエラー(例: `ForecastUnavailableError`)を throw する
- **infrastructure**: 外部 I/O(気象庁 JSON 取得・Drizzle・Better Auth・S3)を実装するアダプタ。domain で定義した Repository インターフェースを実装する。**`ResultAsync` を生成する唯一の層**(`ok()` / `err()` / `fromPromise` を書くのはここだけ)であり、`ResultAsync<T, FetchError | ParseError | UnknownAreaError | DbError>` を返す
- **presentation**: Hono ルート + `@hono/zod-openapi` の `createRoute` 定義。application のユースケースを呼び出し、throw されたアプリケーションエラーを `shared/http-errors.ts` の共通マッピングで HTTP ステータス(400 / 401 / 502 等)へ変換する。例外をここより上位(Hono フレームワーク層)に漏らさない

`shared/` は機能をまたぐ横断的関心事(pino ロガー・OpenAPI/Swagger UI セットアップ・エラーマッピング)を置き、いずれの feature からも参照してよい。

### apps/web のレイヤー構成(機能優先スライス)

`apps/web` は api と同じ機能単位(auth / forecast / coordinate)でスライスし、各スライス内で**副作用の所在によって層を分ける**。層は api 側と次のように対応する:

| apps/web | apps/api | 責務 |
| --- | --- | --- |
| `routes/` | presentation | ルート定義・`beforeLoad` の認証ガード・features の合成。ロジックを持たない |
| `features/*/hooks/` | application | ユースケース。TanStack Query の `useQuery` / `useMutation` を包み、非同期と状態遷移を集約する |
| `features/*/api/` | infrastructure | 外部 I/O。`hc<AppType>`(Hono RPC)と `authClient` の呼び出しをここに閉じる |
| `features/*/model/` | domain | 表示用の純粋変換のみ(任意)。ビジネスルールは `packages/schema` に置く |
| `features/*/components/` | - | 表示。props in / callback out で副作用を持たない |

守る規約は4つ:

1. **依存方向は `routes → features → (components/ui, lib, @haregi/schema)` の一方向**。`features → routes` と `components/ui → features` を禁止する
2. **`hc<AppType>` / `authClient` の呼び出しは `features/*/api/` にのみ書く**。`components/` から直接呼ばない(fetch 直書き禁止の延長)
3. **features 間の横断参照は原則禁止**。例外は api 側と同じ1つのみ — `coordinate → forecast`(気温スナップショットの表示)は許可し、逆方向は禁止。これ以上増える場合は `routes` で合成するか `lib` に降ろす
4. **ビジネスルール(Zod・日付/気温ロジック)は `packages/schema` に一本化**し、`features/*/model/` に再定義しない

この分離により、`components/` は props のみの純粋コンポーネントとして `@testing-library/react` でテストでき、非同期・エラー分岐は `hooks/`(`api/` をモック)でテストできる。「予報取得失敗(502)でもコーデ入力・保存が継続できる」「未認証で `/login` へリダイレクトされる」といった要件テストの置き場所が一意に決まることを狙う(決定事項 #27・#28)。

`/forecast` は予報表示部とコーデ入力部を統合した画面のため、両 feature を `routes/forecast.tsx` で合成する形をとり、ルートファイルの肥大化を防ぐ。

共通 UI(spec §2.4 の Must)の実現方法:

- **ナビのログイン状態出し分け**: `features/auth/hooks/` のセッション取得フックを `routes/__root.tsx` のレイアウトが参照して切り替える(ナビ自体は `components/` の純粋コンポーネントとし、props でログイン状態を受ける)
- **レスポンシブ・モバイルのドロワーナビ**: Tailwind のブレークポイントで切り替え、ドロワーは shadcn/ui の Sheet を用いる
- **トースト通知**: shadcn/ui の sonner を `routes/__root.tsx` に1箇所マウントし、`hooks/` の mutation 成否から呼ぶ

### 通信経路

- ブラウザ → `apps/web`(:3000)→ `/api/*` を `apps/api`(:4000)へプロキシ
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

// ★ DB の CHECK 制約は導入せず、状態値はこの型で担保する(下記「現行スキーマからの変更点」参照)
export type SnapshotStatus = 'fresh' | 'stale' | 'unavailable'
export type ForecastSnapshotStatus = Extract<SnapshotStatus, 'fresh' | 'stale'>

export const user = pgTable('user', {
  id: text('id').primaryKey(),              // Better Auth が生成
  name: text('name').notNull(),             // ユーザー名(表示名・非一意)
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  areaCode: text('area_code').notNull(),    // ★ additionalField: 気象庁 府県予報区コード(例 '130000' = 東京都)
  // 認証テーブルの時刻は Better Auth CLI 生成のまま(タイムゾーンなし)。再生成で戻るため揃えない
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
})

// session / account / verification は Better Auth CLI 生成のまま

export const coordinate = pgTable(
  'coordinate',
  {
    id: serial('id').primaryKey(),
    date: date('date', { mode: 'string' }).notNull(), // ★ 日付カラムを追加。JST の `YYYY-MM-DD` 文字列で扱う(決定事項 #21)
    outerwear: text('outerwear').notNull().default(''),
    tops: text('tops').notNull().default(''),
    bottoms: text('bottoms').notNull().default(''),
    imageKey: text('image_key'),            // コーデ写真のオブジェクトキー(Should 機能。写真なしは null)
    maxTemperature: real('max_temperature'), // 記録時点の予報最高気温スナップショット(表示中の地域基準。null 可)
    minTemperature: real('min_temperature'), // 記録時点の予報最低気温スナップショット(同上)
    // ★ 気温スナップショットの由来(決定事項 #30)。気温値だけでは後から出どころを説明できないため併せて保存する
    areaCode: text('area_code'),                          // 記録時に画面で表示していた府県予報区コード(気温なしは null)
    tempStation: text('temp_station'),                    // 気温を引いた代表アメダス地点コード(マスタ改訂の影響を切り分ける)
    forecastIssuedAt: timestamp('forecast_issued_at', { withTimezone: true }), // 気象庁の予報発表時刻
    snapshotStatus: text('snapshot_status').$type<SnapshotStatus>(), // 取得失敗・予報範囲外は 'unavailable'
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // ★ 楽観ロックのトークン(決定事項 #32)。条件付き更新の中で `version = version + 1` する。
    //    wall-clock 値(updatedAt)は精度内の同値・NTP の逆行でトークンとして成立しないため使わない
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow() // 監査用。ロックには使わない
  },
  (t) => [unique().on(t.userId, t.date)]    // ユーザー×日付で一意
)

export const forecastSnapshot = pgTable('forecast_snapshot', {
  // ★ 予報世代の永続化(決定事項 #34)。`GET /api/forecast` が発行し、`PUT /api/coordinates` が引き当てる
  snapshotId: text('snapshot_id').primaryKey(),
  areaCode: text('area_code').notNull(),                     // 府県予報区コード
  forecastIssuedAt: timestamp('forecast_issued_at', { withTimezone: true }).notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
  status: text('status').$type<ForecastSnapshotStatus>().notNull(), // 'unavailable' は世代として発行しない
  payload: jsonb('payload').notNull(),                       // 正規化済み Forecast(気象庁の生 JSON ではない)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})
```

現行スキーマからの変更点:

- **Prefecture テーブルを廃止**。地域マスタはコード(`packages/schema`)に持ち、user には府県予報区コード(`areaCode`)のみ保存する(正規化とシンプル化)。緯度経度は不要になる
- **Coordinate に `date` カラムを追加**し、`(userId, date)` を一意制約に(upsert 前提)
- **Coordinate に気温スナップショット(`maxTemperature` / `minTemperature`)を追加**。保存時にサーバー側が `snapshotId`(表示中の地域の予報世代。決定事項 #29 / #30)から該当日付の気温を引いて書き込み(予報範囲外の日付は null)、「似た気温の過去コーデ参照」「AI コーディネート提案」の材料を初回リリース時点から蓄積する(後から past データを復元するのは困難なため、これだけは Must フェーズで実装する)
- **Coordinate に気温スナップショットの由来(`areaCode` / `tempStation` / `forecastIssuedAt` / `snapshotStatus`)を追加**(決定事項 #30)。地域切替を許容する以上、気温値だけでは「東京と大阪のどちらを見て記録したか」「代表アメダス地点はどこか」「stale な予報だったか」を後から判別できず、蓄積データの解釈と将来の分析(「似た気温の日」参照・AI 提案)が成立しない
- パスワードは Better Auth 管理(account テーブルの `password` に scrypt ハッシュ)。現行の bcrypt ハッシュは移行しない(本番ユーザー不在のため)
- **`forecast_snapshot` テーブルを追加**(決定事項 #34)。予報世代を PostgreSQL に持ち、`GET /api/forecast` が発行した `snapshotId` を `PUT /api/coordinates` から24時間以内に引き当てられるようにする。インメモリキャッシュだけに置くと、プロセス再起動や複数インスタンスで世代を解決できず、画面に出ていた気温と保存値が黙って食い違う。`payload` は**正規化済みの `Forecast`** を入れる(気象庁の生 JSON を DB に残さない。`.agents/rules/jma-forecast.md`)
- **`version` は同時編集の競合検出に使う**(決定事項 #32)。`PUT /api/coordinates` の各 item に読み込み時の `version` を含め、**不一致または省略**なら 409 を返す。照合は `WHERE ... AND version = ?` の条件付き書き込みで行う(TOCTOU 回避)。**成功した更新では同じ文の中で `version = version + 1` し**、新しい値をレスポンスで返す(前進させないと旧トークンが有効なまま残り、楽観ロックが成立しない)。**`updatedAt` はロックに使わない** — wall-clock 値はカラム精度内で同値になる場合や NTP による逆行で「更新後も旧トークンが一致する」状態を作りうるため。`version` は DB 内のインクリメントで生成され、時計に依存しない

- **自前で定義するテーブルの絶対時刻は `timestamptz`(タイムゾーン付き)で持つ**。`coordinate` の `forecastIssuedAt` / `createdAt` / `updatedAt` と `forecast_snapshot` の3カラムが対象。予報世代の失効判定(`created_at > now() - interval '24 hours'`。決定事項 #34 / #35)を **DB セッションのタイムゾーン設定から独立させる**ため。`timestamp without time zone` のままだと、接続先の `TimeZone` 設定次第で24時間の境界がずれ、「保持は24時間」という保証が環境依存になる。**認証テーブル(user / session / account / verification)はタイムゾーンなしのまま**とし、揃えない — Better Auth CLI の生成物であり、手で書き換えても再生成で戻るため。認証側の期限(`session.expiresAt` / `verification.expiresAt`)は **Better Auth 自身が書き・読む閉じた系統**であり、我々が書く予報世代の失効判定とは独立している。ただしタイムゾーンなしの列である以上 DB セッションの TZ 設定の影響は受けうるため、**異なる TZ でも認証の期限判定が正しいことをフェーズ4a のテストで確認する**(混在を許容する条件)
- **DB の CHECK 制約・enum は導入しない**。`snapshotStatus`(`'fresh' | 'stale' | 'unavailable'`)・`status`(`'fresh' | 'stale'`)・`version >= 1` はいずれも DB 制約で固定できるが、初回リリースでは**型(Drizzle の `$type<>()` / Zod / TypeScript)とサーバー側ロジックで担保する**。理由は (a) これらの値を書くのは `apps/api` の単一経路のみで、クライアントから直接 DB に届かない (b) 状態値の追加(例: `'partial'`)のたびにマイグレーションが必要になる、の2点。**代わりにテストで固定する**(`.agents/rules/testing.md`)。将来 DB へ直接触れる経路が増える場合(決定事項 #33 の再検討条件と同じ)は、併せて CHECK 制約の追加を検討する

マイグレーションは drizzle-kit(`drizzle-kit generate` / `migrate`)で管理する。

---

## 5. API 設計(Hono)

| メソッド / パス | 認証 | 内容 |
| --- | --- | --- |
| `ALL /api/auth/*` | - | Better Auth ハンドラ(signup / login / logout / session / updateUser 等) |
| `GET /api/forecast?area={code}` | 必要 | 気象庁 JSON から週間予報を取得し整形して返す。`area` 省略時はユーザーの登録地域、指定時はマスタ照合の上その地域(地域切替用)。短期の天気・降水確率は一次細分区域、週間の天気は週間予報区域、気温は代表アメダス地点のデータを地域マスタで解決する。レスポンスに **`snapshotId` / `areaCode` / `tempStation` / `fetchedAt` / `forecastIssuedAt` / `status`(`fresh` \| `stale`)** を含める(決定事項 #30) |
| `GET /api/coordinates?from&to` | 必要 | 自分のコーデ一覧(各行に楽観ロック用の `version` を含める)。**`from` <= `to` かつ期間は最大366日**。両方省略時は**直近30件**(日付降順)を返す(履歴の最小版がこれを使う)。写真がある場合は短命の署名付き GET URL をレスポンスに同梱(Should) |
| `PUT /api/coordinates` | 必要 | `{ snapshotId?, items: [{ date, outerwear, tops, bottoms, imageKey?, version? }] }`(`version` は**既存レコードでは必須**。新規作成時のみ省略可) を一括 upsert(**items は最大7件**、日付重複は 400)。気温スナップショットはサーバー側が `snapshotId` の指す**表示に使われたのと同一世代**(`forecast_snapshot`。決定事項 #34)から該当日付の値を引いて書き込む(**気温値はクライアントから受け取らない**。決定事項 #29 / #30)。`snapshotId` が**送られない**場合は既存の気温を維持する(決定事項 #31)。**送られたのに解決できない場合は 409** を返し、予報を再取得して再送させる(決定事項 #35)。**`version` が DB と不一致、または既存レコードに対して省略された場合は 409**(決定事項 #32)。照合は条件付き書き込み(`WHERE user_id = ? AND date = ? AND version = ?`)で行い、更新件数0を競合とする(ただし**空入力かつ対象レコードが存在しない item は no-op**)。**成功時は `version = version + 1` し、保存後の items(新しい `version` を含む)をレスポンスで返す** |
| `DELETE /api/coordinates/:date` | 必要 | 指定日のコーデ削除(**Should**)。**読み込み時の `version` を必須入力とし**、`WHERE user_id = ? AND date = ? AND version = ?` の条件付き削除で削除件数0なら 409(決定事項 #32。`PUT` 経路にだけ楽観ロックをかけても、独立 DELETE が素通しなら同時編集によるデータ消失が残るため)。写真があればストレージのオブジェクトも削除 |
| `POST /api/uploads` | 必要 | コーデ写真用の署名付きURL(presigned URL)を発行(Should)。ブラウザからストレージへ直接 PUT し、API サーバーに画像は通さない。**imageKey は `PUT /api/coordinates` で確定させる3ステップフロー**(presign → 直接 PUT → 確定)。確定されなかったキーは孤児オブジェクトとして許容し、定期掃除は Could |
| `GET /api/doc` | 不要 | Swagger UI(`@hono/swagger-ui`)。`/api/openapi.json` の OpenAPI スキーマを表示する開発用ドキュメント |

### 設計原則

- セッション判定は `presentation` 層のミドルウェアで `auth.api.getSession({ headers })` を実行し、`c.get('user')` に格納。未認証は 401
- **認可(所有権)は RLS ではなくサーバー側ロジックで担保する**(決定事項 #33)。`userId` はセッションからのみ得て、所有者条件を `infrastructure` 層の Repository の内側に閉じ込める。他人のリソースと不存在は区別せず 404 に統一する
- **レイヤーと エラーハンドリング(neverthrow)**: 外部 I/O(気象庁 JSON 取得・Drizzle・S3)は `infrastructure` 層で `ResultAsync` にラップし、型付きエラー(例: `FetchError | ParseError | UnknownAreaError | DbError`)として返す。`application` 層のユースケースがこれを `.match()` 等で処理し、失敗時は型付きアプリケーションエラーを throw する(neverthrow を層の外へ持ち出さない)。`presentation` 層(ルートハンドラ)は throw されたエラーを `shared/http-errors.ts` の共通マッピングで HTTP ステータス(400 / 401 / 502 等)へ網羅的に変換し、例外を Hono フレームワーク層に漏らさない。気象庁取得にはタイムアウト(`AbortSignal.timeout`)と軽量なリトライを infrastructure 層で併用する
- リクエストボディは `@hono/zod-validator` + `packages/schema` の Zod スキーマで検証(フロントと同一スキーマ)。`items` の件数上限(最大7件)・**リクエスト内の日付重複(400)・実在する暦日であること・保存可能範囲(今日から前後1年)**もここで強制する
- **空レコードは作らない**。3項目を trim した上ですべて空の item は、upsert ではなく**その日付のレコードを削除**する(specification.md §4)
- 日付はすべて **JST 基準の `YYYY-MM-DD` 文字列**として API 境界・DB(`date` カラム)・URL パラメータで統一する(§9 参照)
- 各 feature の `presentation` 層でメソッドチェーンによりルートを定義し、`app.ts` で合成した上で `export type AppType` を公開 → web 側 `hc<AppType>` で型安全に呼ぶ
- **ロギング(pino)**: `src/shared/logger.ts` の pino インスタンスをリクエストロギングミドルウェアで全ルートに適用し、method / path / status / duration / requestId を構造化(JSON)出力する。neverthrow のエラー分岐でも型付きエラーの内容を pino でログする。ログレベルは `LOG_LEVEL` 環境変数で制御(開発は `debug`、本番は `info` を想定)
- **API ドキュメント(Swagger UI)**: `packages/schema` の Zod スキーマを `@hono/zod-openapi` の `createRoute` でラップし、`GET /api/openapi.json` として OpenAPI 定義を生成。`@hono/swagger-ui` の `swaggerUI({ url: '/api/openapi.json' })` を `GET /api/doc` にマウントする。エンドポイント追加のたびに定義を更新し、手動の API 仕様書を作らない

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
- 非公式 API のため、取得・整形は `apps/api` の `features/forecast/` 内に隔離し、仕様変更時に差し替え可能な構造にする(正規化ロジックは `domain`、取得・キャッシュは `infrastructure`。決定事項 #26)。構造差を吸収して共通の `Forecast` 型へ正規化し、他 feature にはこの型でのみ渡す

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
- **世代管理**: 取得ごとに世代 ID(`snapshotId`)を発行し、**`forecast_snapshot` テーブル(PostgreSQL)に1行として書く**(決定事項 #34)。`GET /api/forecast` はこれをレスポンスに含め、`PUT /api/coordinates` から送り返された `snapshotId` で同一世代を引き当てる(決定事項 #30)。**インメモリキャッシュに世代を保持しない** — プロセス再起動や複数インスタンスでは引き当てられず、画面表示と保存値が黙って食い違うため。**保持は24時間**とする。**有効期限は引き当てのクエリ自身が判定する** — `WHERE snapshot_id = ? AND created_at > now() - interval '24 hours'` とし、期限切れの行が DB に残っていても引き当てを失敗させる(決定事項 #35 の 409 になる)。行の掃除(`DELETE`)は予報取得時に行うが、**それは容量管理のためであって失効の判定根拠にしない** — 掃除だけに頼ると、24時間経過後に予報 `GET` を挟まず古い画面から直接 `PUT` した場合に期限切れの行が引き当てに成功してしまう
- **last-known-good の保持**: TTL 切れ後の再取得に失敗しても、**最後に成功した予報を破棄せず保持し、`status: 'stale'` として返す**(取得時刻・予報発表時刻を添える)。これにより気象庁側の障害中もユーザーは予報を見られ、そこから保存したコーデには `snapshotStatus: 'stale'` が記録される。ブラウザ側の stale データ表示だけに頼らない。**stale を返す場合も、その表示内容で新しい `forecast_snapshot` 行を発行し、有効な `snapshotId` を返す**(`status: 'stale'` / `fetchedAt` は最後に成功した取得時刻 / `forecastIssuedAt` はその予報の発表時刻 / `created_at` は発行時刻)。**`GET /api/forecast` が 200 を返す限り、その `snapshotId` は必ず引き当て可能である**という不変条件を保つ。これを満たさないと、障害が24時間を超えた時点で「表示は stale のまま・元の世代は期限切れ」となり、保存が 409 → 再取得 → 同じ stale 表示 → また 409 のループに陥って、spec §2.2 の Must「予報が取れなくてもコーデ入力・保存は継続できる」を満たせなくなる
- **同時リクエストの束ね**: 同一地域への並行した取得要求は1本の fetch にまとめる(in-flight リクエストの共有)。キャッシュ失効の瞬間に同時アクセスが集中しても、気象庁への発信は1回に保つ
- **リトライ**: 気象庁取得の再試行には**指数バックオフ + ジッター**を用いる(即時連打で相手側に負荷をかけない)。タイムアウトは `AbortSignal.timeout`
- **気象庁取得失敗時(502)**: フロントは予報部にエラーメッセージと再試行ボタンを表示し、TanStack Query の stale データがあればそれを表示する。コーデ入力・保存は予報なしでも継続できる(スナップショットは null、`snapshotStatus: 'unavailable'`)
- **マスタの継続検証**: `apps/api/scripts/validate-areas.ts` は CI を持たないため、**リリース前と月次で手動実行する**運用ルールとする(実行しなければ気象庁側の変更検知にならない)。[release-checklist.md](./release-checklist.md) に含める

### 利用条件(法的整理)

- 政府標準利用規約(CC BY 4.0 互換)に基づき**出典明記で商用利用可**。「出典: 気象庁ホームページ」を常時表示する
- 予報は改変せず「そのまま表示」し、独自予報の生成はしない(気象業務法上の予報業務許可を不要に保つ)

---

## 7. 認証設計(Better Auth)

```ts
// apps/api/src/features/auth/infrastructure/auth.ts(概略。決定事項 #26 のレイヤー構成に従う)
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
    before: authValidationHook  // ★ サーバー側入力検証(signup / updateUser / changePassword。下記参照)
  }
})
```

- 会員登録はフロントから `authClient.signUp.email({ email, password, name, areaCode })` の1回で完了(現行の自前 `/api/signin` は不要になる)
- フロントは `createAuthClient` + `inferAdditionalFields` プラグインで `areaCode` を型付け
- **`/api/auth/*` は zValidator を通らない**ため、サーバー側の入力検証は Better Auth の **`hooks.before`** で行う。対象は **signup / updateUser / changePassword** の3つ(パスワード変更・アカウント設定は spec §2.1 の Should だが、検証経路は同じ hook に集約する)。`packages/schema` の Zod スキーマを再利用し、以下をすべてサーバー側で強制する(フロントの Zod 検証は UX 用であり、防御は hooks が担う):
  - パスワードの文字種ルール(小文字英字+数字を含む)— signup / changePassword の両方
  - `areaCode` が地域マスタに実在すること — signup / updateUser の両方
  - ユーザー名の形式(trim 後1〜20文字。文字種の制限なし。spec §4 で現行アプリの「8文字以上・英数字のみ」から緩和)— signup / updateUser の両方
- パスワードの長さ(8〜20文字)は `emailAndPassword` の `minPasswordLength` / `maxPasswordLength` が全経路で強制するため hook では扱わない

---

## 8. 画像ストレージ(Should)

- S3 互換 API 前提でコードを書き、契約先(R2 / S3 等)は実装時に決定。ローカル開発は MinIO(Docker)
- アップロードは **presign → ブラウザから直接 PUT → `PUT /api/coordinates` の `imageKey` で確定**の3ステップ(§5 参照)
- **サイズ上限(5MB)と形式制限(jpeg / png / webp)をサーバー側で強制するには presigned POST 対応が必要**(それぞれ `content-length-range` / `Content-Type` の条件指定)。R2 は presigned POST 非対応のため、**契約先選定時にこの2点の対応可否を確認する**。presigned PUT で済ませる場合、両制限はフロント側の事前チェックのみとなり防御にならない点を受け入れるかの判断が必要になる
- 閲覧は短命の署名付き GET URL を API レスポンスに同梱
- **オブジェクトキーはユーザー ID をプレフィックスに持つ**(例: `coordinates/{userId}/{uuid}.jpg`)。`PUT /api/coordinates` で `imageKey` を確定する際、**キーのプレフィックスがリクエスト元ユーザーと一致することを検証**する(他人のオブジェクトを自分のコーデに紐付けられないようにする)
- **presign の発行にはユーザー単位の上限を設ける**(1日あたりの発行回数・累計容量)。無制限だとストレージを容量目的で悪用できる
- **EXIF の位置情報**: スマホ撮影の写真には GPS 座標が含まれうる。署名付き URL は短命とはいえ、**アップロード前にフロントで EXIF を除去する**方針とする(サーバーを画像が通らない設計上、除去できるのはクライアント側のみ)
- 確定されなかったキー(孤児オブジェクト)は**無期限には許容しない**。presign 発行から24時間以内に確定されなかったキーを削除する掃除を、写真機能の実装と同時に用意する(当初は「掃除は Could」としていたが、孤児を放置できる前提は上記の悪用リスクと両立しない)
- **サムネイルは生成しない**。履歴一覧(spec §2.3 Should)でも原寸オブジェクトの署名付き URL を CSS で縮小表示する。画像を API サーバーに通さない原則(presign 方式)とサーバー側リサイズは両立しないため、転送量が問題になった時点で別途検討する(Could)
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
| `LOG_LEVEL` | pino のログレベル(開発: `debug` / 本番: `info` を想定) |
| `TZ` | Node プロセスのタイムゾーン。**`UTC` 固定**(認証テーブルの期限カラムが tz なしのため。§9 参照)。各スクリプトが注入し、起動時に検証する — この表への記載や `.env.example` は実効性を持たない |
| `STORAGE_ENDPOINT` / `STORAGE_BUCKET` / `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` | S3 互換ストレージ接続情報(Should: 写真アップロード導入時に追加。ローカルは MinIO を docker-compose に追加) |

### 日付・タイムゾーン方針

- **暦日**(ユーザーが選ぶ日付)はすべて **JST 基準の `YYYY-MM-DD` 文字列**として扱い、`Date` オブジェクトをモジュール境界(API・DB・コンポーネント間)越しに渡さない
- 「今日」の判定・upsert キー・気象庁 JSON の `timeDefines`(+09:00)をすべて JST に統一し、サーバーの実行タイムゾーン(UTC 等)に依存した深夜0時前後の日付ズレを排除する
- **DB に時刻を書き読みする Node プロセスは `TZ=UTC` で動かし、違反したら起動させない**。認証テーブルの期限カラムは Better Auth CLI 生成物のため `timestamp without time zone` であり(§4)、**Node 側のローカル TZ で解釈される**。書いた時と読む時でプロセスの TZ が違うと期限が前後し、失効済みセッションを通しうる。デプロイ間・複数インスタンス間で TZ が揃う保証はない
  - **列を `timestamptz` に直す案は採らない**。CLI 生成物を手で書き換えることになり、再生成のたびにパッチを当て直す必要がある。**当て忘れると tz なしに戻り、デプロイもテストも通ったままズレが再発して誰も気づかない**。CI も E2E も持たない体制では、静かに壊れる経路を残さないことを優先し、**壊れた設定では動き出せない**方向で守る
  - 対象は `apps/api` の起動・`scripts/seed.ts`・マイグレーション・**DB に触れるテスト**。各スクリプトに `TZ=UTC` を注入した上で、**起動時に `assertUtcTimezone(process.env.TZ)`(`packages/db`)を呼んで fail-fast する**。`.env.example` はコピー元でしかなく自動では読まれないため、そこに書くだけでは実効性がない
  - **`packages/schema` の日付ユーティリティのテストは対象外**。意図的に別の TZ で回して JST 判定の正しさを確認するものであり、UTC を強制しない
  - **JST への変換は表示時にのみ行う**(`packages/schema` の日付ユーティリティが担う)
- **「暦日」と「絶対時刻」を区別する**。ユーザーが選ぶ日付(コーデの `date`、`GET /api/coordinates` の `from` / `to`)は**暦日**であり、JST の `YYYY-MM-DD` 文字列として扱う(DB は `date` 型・Drizzle は `mode: 'string'`)。一方、予報発表時刻・取得時刻・レコードの作成/更新時刻は**時点を指す絶対時刻**であり、`timestamptz` + `Date` で扱う(§4)。上記の「`Date` を境界越しに渡さない」は**暦日についての規定**であり、絶対時刻まで文字列化することを求めるものではない
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

### テスト方針(Vitest・TDD)

- **フロントエンド・バックエンドともに TDD で実装する**(決定事項 #27)。実装前に失敗するテストを書き(Red)、実装して通し(Green)、必要に応じてリファクタリングする(Refactor)のサイクルを各層・各コンポーネントで回す
- `packages/schema`: バリデーションスキーマ、地域マスタ(コードの一意性・形式)、日付/気温整形ユーティリティ
- `apps/api`: 各 feature の `domain`(純粋ロジック)・`application`(ユースケース)を中心に単体テスト。気象庁 JSON → `Forecast` 型への正規化、キャッシュ動作、認証ミドルウェアの 401 応答も対象
- `apps/web`: `@testing-library/react` + `@testing-library/jest-dom` によるコンポーネントテストを実装前に書く(フォームのバリデーション表示・保護ルートのリダイレクト・予報取得失敗時のエラー表示など)
- E2E(Playwright 等)は今回スコープ外(将来検討)

### シードデータ

- テストユーザー: `admin@example.com` / `password123` / 地域 `130000`(東京都)
- サンプルコーデ2件(パスワードは Better Auth の API 経由で作成し、ハッシュ形式を揃える)

---

## 10. 新リポジトリ立ち上げ手順(推奨順)

1. **ワークスペース骨組み**: pnpm-workspace.yaml / turbo.json / tsconfig.base.json / oxlint・oxfmt 設定 / .env.example / docker-compose.yml
2. **packages/schema**: Zod スキーマ(signup / login / coordinates)、地域マスタ(**生成・検証済みの `master-data/areas.ts` を移植**)、日付(JST)/気温整形ユーティリティ + Vitest。検証スクリプト(`master-data/validate-areas.mjs`)も `apps/api/scripts/validate-areas.ts` として移植し、気象庁側の変更検知に使う
3. **packages/db**: Drizzle 設定 → Better Auth CLI でスキーマ生成 → user への `areaCode` 追加フィールドと `coordinate` テーブルを追記 → 初回マイグレーション
4. **apps/api**: `shared/`(pino ロガー・OpenAPIHono + Swagger UI セットアップ・http-errors マッピング)→ 機能(auth → forecast → coordinate)ごとに **domain → infrastructure → application → presentation** の順で実装(neverthrow は infrastructure が生成し application が消費する)→ `app.ts` で各 feature の presentation ルータを合成 → シード → テスト
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
