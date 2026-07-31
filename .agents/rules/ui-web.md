# UI・画面ルール(apps/web)

## 画面構成(specification.md §3)

| パス | 画面 | 認証 |
| --- | --- | --- |
| `/` | ランディング(仮テキスト禁止) | 不要 |
| `/signup` / `/login` | 会員登録 / ログイン | 不要 |
| `/forecast` | 週間予報+コーデ入力のメイン画面(地域切替セレクタ付き) | 必要 |
| `/history` | 過去コーデ履歴(Should) | 必要 |
| `/settings` | アカウント設定(Should) | 必要 |

- 予報閲覧とコーデ入力は `/forecast` の1画面に統合する(`/coordination/create` のような分離画面を作らない)
- 地域切替セレクタは**登録地域を書き換えない**(登録地域はデフォルト表示地域。変更は `/settings` から)。ただし**コーデ保存時は表示中の地域コードを `areaCode` として送る**(気温スナップショットの基準。決定事項 #29)

## ディレクトリ構成・依存方向(決定事項 #28)

機能優先スライス(軽量 FSD 風)。`src/routes/` / `src/features/{auth,forecast,coordinate}/{components,hooks,api,model}` / `src/components/ui/`(shadcn 取り込み先)/ `src/lib/`。層は api の軽量オニオンと対応する(routes ≒ presentation / hooks ≒ application / api ≒ infrastructure / model ≒ domain)。

1. **依存方向は `routes → features → (components/ui, lib, @haregi/schema)` の一方向**。`features → routes`・`components/ui → features` を禁止
2. **`hc<AppType>` / `authClient` の呼び出しは `features/*/api/` にのみ書く**。`components/` から直接呼ばない
3. **features 間の横断参照は原則禁止**。例外は `coordinate → forecast`(気温スナップショット表示)のみで逆方向は禁止。それ以上は `routes` で合成するか `lib` に降ろす
4. **ビジネスルール(Zod・日付/気温ロジック)は `packages/schema` に一本化**し `features/*/model/` に再定義しない。`model/` は表示用の純粋変換限定
5. `routes/` はルート定義・`beforeLoad` の認証ガード・features の合成のみ。`components/` は props in / callback out で副作用を持たない(非同期は `hooks/` に寄せる)

**採用しない**: FSD フル6層(app/pages/widgets/features/entities/shared)/ Atomic Design / グローバル状態管理ライブラリ(Redux・Zustand 等)。サーバー状態は TanStack Query、セッションは Better Auth client、フォームは RHF が持つ。

## 実装パターン

- UI コンポーネントは shadcn/ui を第一候補とする(取り込み先: `src/components/ui`)
- フォームは React Hook Form + `@hookform/resolvers`(Zod)+ shadcn/ui の Form パターンで統一
- 通知はトースト(sonner)。`routes/__root.tsx` に1箇所だけマウントし、`hooks/` の mutation 成否から呼ぶ
- ナビはログイン状態で出し分ける(`features/auth/hooks/` のセッションフックを root レイアウトが参照し、ナビ自体は props でログイン状態を受ける純粋コンポーネント)。モバイルはドロワーナビ(shadcn/ui の Sheet)
- コーデ写真(Should)の**サムネイルは生成しない**。原寸の署名付き URL を CSS で縮小表示する(architecture.md §8)
- 認証は `better-auth/react` の `createAuthClient` + `inferAdditionalFields`(`areaCode` を型付け)を使う
- 優先度は Must → Should → Could の順に実装する。Could(AI 提案・ダークモード等)を先回りで実装しない

## モダン Web ガイダンス(`modern-web-guidance` スキル)

HTML / CSS / クライアントサイド JS の実装前に [modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance)(Google Chrome / Microsoft Edge チーム提供)のスキルで該当ガイドを検索し、レガシーパターンではなくモダンな Web プラットフォーム標準を用いる。

- 対象: モーダル/ポップオーバー、アニメーション・View Transitions、コンテナクエリ、フォーム(`:user-invalid` 等)、アクセシビリティ、Core Web Vitals
- 対象外: `apps/api`(Hono・Drizzle・Better Auth)/ Docker / CI / Git など非フロントエンドの作業
- ブラウザ対応方針は**未定義 = スキル既定の Baseline Widely available 準拠**とし、それ未満の機能はガイドのフォールバック指示に従う
- **スタックの決定(stack.md)が優先**する。ガイドがネイティブ実装を勧めても、shadcn/ui・Tailwind v4・React Hook Form 等の確定スタックを勝手に置き換えない。ガイドは確定スタックの**内側**で活かす(例: shadcn/ui の Dialog を使いつつ、ネイティブ `<dialog>` / `@starting-style` の作法に沿わせる)

## 表示仕様

- 日付は `YYYY年M月D日`、気温は `℃` 表示。エラーメッセージは日本語
- 「出典: 気象庁ホームページ」を常時表示する
