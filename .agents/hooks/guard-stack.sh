#!/usr/bin/env bash
#
# PreToolUse (Bash) — 確定スタックから逸脱する依存の導入を拒否する。
# 根拠は .agents/rules/stack.md(「非スコープ(提案・導入しない)」と
# 「Lint/Format: oxlint + oxfmt のみ」)。
#
# 検査するのはインストール系コマンド(pnpm/npm/yarn/bun の add|install|i、
# npx / pnpm dlx / bunx)だけで、それ以外の Bash は素通しする。
#
# jq が無い環境では判定できないため素通しする。
#
set -o pipefail

command -v jq > /dev/null 2>&1 || exit 0

payload="$(cat)"
cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null)"
[ -n "$cmd" ] || exit 0

# インストール系コマンドかどうか
is_install=0
if printf '%s' "$cmd" | grep -Eq '(^|[;&|(]|[[:space:]])(pnpm|npm|yarn|bun)[[:space:]][^;&|]*[[:space:]](add|install|i)([[:space:]]|$)'; then
  is_install=1
elif printf '%s' "$cmd" | grep -Eq '(^|[;&|(]|[[:space:]])(pnpm|npm|yarn|bun)[[:space:]](add|install|i)([[:space:]]|$)'; then
  is_install=1
elif printf '%s' "$cmd" | grep -Eq '(^|[;&|(]|[[:space:]])(npx|bunx|pnpm[[:space:]]+dlx)[[:space:]]'; then
  is_install=1
fi
[ "$is_install" -eq 1 ] || exit 0

# 既に採用済み/スコープ内のパッケージを誤検出しないよう、先に取り除く
scan="$cmd"
scan="${scan//eslint-plugin-react-hooks/}"     # oxlint が参照する。導入済み
scan="${scan//@testing-library\/jest-dom/}"    # 決定事項 #27 でスコープ内
scan="${scan//@playwright\/mcp/}"              # MCP は開発時のデバッグ用途で導入済み

deny() {
  cat >&2 <<EOF
このインストールは確定スタックから逸脱するため実行しません。

  コマンド: $cmd
  該当: $1
  理由: $2

根拠: .agents/rules/stack.md / docs/architecture.md
代替ライブラリが必要だと判断した場合は、導入せずユーザーへの提案として伝えてください。
EOF
  exit 2
}

# --- 非スコープのパッケージ ------------------------------------------------
printf '%s' "$scan" | grep -Eqi '(^|[[:space:]/@-])eslint' \
  && deny 'ESLint' 'Lint は oxlint のみ(決定事項 #16)'
printf '%s' "$scan" | grep -Eqi 'prettier' \
  && deny 'Prettier / prettier-plugin-tailwindcss' 'Format は oxfmt のみ。Tailwind クラスソートは oxfmt に内蔵(決定事項 #16)'
printf '%s' "$scan" | grep -Eqi '(husky|lint-staged)' \
  && deny 'Husky / lint-staged' 'Git hooks は非スコープ(決定事項 #13)。検証は .agents/hooks/verify-changes.sh が担う'
printf '%s' "$scan" | grep -Eqi 'storybook' \
  && deny 'Storybook' '規模に対して維持コストが高いため非スコープ(決定事項 #12)'
printf '%s' "$scan" | grep -Eqi 'supabase' \
  && deny 'Supabase(BaaS)' '自前構成で制御性を優先するため不採用(決定事項 #4)'
printf '%s' "$scan" | grep -Eqi '(@playwright/test|cypress|puppeteer|testcafe)' \
  && deny 'E2E テストフレームワーク' 'E2E は非スコープ(specification.md §6)。コンポーネントテストは @testing-library/react で行う'
printf '%s' "$scan" | grep -Eqi '(^|[[:space:]/@-])jest' \
  && deny 'Jest' 'テストランナーは Vitest(決定事項 #11)'
printf '%s' "$scan" | grep -Eqi '(@reduxjs/toolkit|(^|[[:space:]])redux|zustand|jotai|recoil|valtio)' \
  && deny 'グローバル状態管理ライブラリ' 'サーバー状態は TanStack Query・セッションは Better Auth client・フォームは RHF が持つため不採用(決定事項 #28)'
printf '%s' "$scan" | grep -Eqi '(^|[[:space:]])effect([[:space:]]|@|$)' \
  && deny 'Effect' 'エラーハンドリングは neverthrow(決定事項 #19)'

# --- 導入先が誤っているケース ----------------------------------------------
if printf '%s' "$scan" | grep -Eq '@haregi/web'; then
  printf '%s' "$scan" | grep -Eqi '(^|[[:space:]])neverthrow' \
    && deny 'apps/web への neverthrow' 'neverthrow は apps/api の infrastructure 層のみ(決定事項 #19 / #26)'
  printf '%s' "$scan" | grep -Eqi '(^|[[:space:]])pino' \
    && deny 'apps/web への pino' 'pino は apps/api のみ(決定事項 #24)'
fi

exit 0
