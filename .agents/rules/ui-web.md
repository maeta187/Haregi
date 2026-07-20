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
- 地域切替セレクタは閲覧のみ(登録地域はデフォルト表示地域)

## 実装パターン

- UI コンポーネントは shadcn/ui を第一候補とする(取り込み先: `src/components`)
- フォームは React Hook Form + `@hookform/resolvers`(Zod)+ shadcn/ui の Form パターンで統一
- 通知はトースト(sonner)。ナビはログイン状態で出し分ける。モバイルはドロワーナビ
- 認証は `better-auth/react` の `createAuthClient` + `inferAdditionalFields`(`areaCode` を型付け)を使う
- 優先度は Must → Should → Could の順に実装する。Could(AI 提案・ダークモード等)を先回りで実装しない

## 表示仕様

- 日付は `YYYY年M月D日`、気温は `℃` 表示。エラーメッセージは日本語
- 「出典: 気象庁ホームページ」を常時表示する
