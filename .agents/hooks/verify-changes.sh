#!/usr/bin/env bash
#
# 実装が一区切りしたタイミング(Stop / SubagentStop)で、変更されたファイルだけを
# 対象に format(自動整形) -> lint -> typecheck -> test を実行する。
#
# 失敗した場合は exit 2 + stderr でエージェントに差し戻し、修正させる。
# 差し戻しは同一セッション内で MAX_RETRY 回まで(環境起因など直せないエラーで
# 無限ループに陥らないための上限)。上限に達したら人間に判断を委ねて素通しする。
#
# 正(ソース・オブ・トゥルース)は .agents/ 側。Claude Code
# (.claude/settings.json)と Codex (.codex/hooks.json)の設定からこのパスを
# 直接呼ぶため、同期スクリプトの対象外でよい
# (rules / skills と違い .claude/ 配下である必要がない)。
#
# 単体で試すには:
#   echo '{"session_id":"manual"}' | ./.agents/hooks/verify-changes.sh; echo "exit=$?"
#
set -o pipefail

MAX_RETRY=3

repo_root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$repo_root" || exit 0

# --- セッションごとの連続失敗カウンタ ------------------------------------
payload="$(cat)"
session_id='default'
if command -v jq >/dev/null 2>&1; then
  session_id="$(printf '%s' "$payload" | jq -r '.session_id // "default"' 2>/dev/null)"
fi
session_id="${session_id//[^A-Za-z0-9_-]/_}"
counter_file="${TMPDIR:-/tmp}/haregi-verify-${session_id:-default}.count"

# --- 変更ファイルの収集 ---------------------------------------------------
# ステージ済み・未ステージ・未追跡をまとめて拾う(削除は対象外)
changed="$(
  {
    git diff --name-only --diff-filter=ACMR HEAD
    git ls-files --others --exclude-standard
  } 2>/dev/null | sort -u
)"

# --- .agents/ のルール・スキルを .claude/ へ同期する ----------------------
# rules / skills は .claude/ 配下のコピーが実際に読まれるため、同期を忘れると
# 編集が反映されない。git 差分で判定すると変更を revert したときにコピー側が
# 取り残されるので、常に実行する(rsync の差分検出のみで、変更がなければ数十ms)。
# 拡張子による絞り込み(下記)より前に行う
if ! sync_out="$(./scripts/sync-agent-config.sh 2>&1)"; then
  {
    echo ".agents/ の内容を .claude/ へ同期できませんでした。"
    echo "$sync_out"
  } >&2
  exit 2
fi

fmt_files=()
lint_files=()
filters=()
seen_ws=''
root_changed=0

while IFS= read -r file; do
  [ -n "$file" ] || continue
  [ -f "$file" ] || continue

  case "$file" in
    *.ts | *.tsx | *.mts | *.cts | *.js | *.jsx | *.mjs | *.cjs)
      fmt_files+=("$file")
      lint_files+=("$file")
      ;;
    *.json)
      fmt_files+=("$file")
      ;;
    *)
      continue
      ;;
  esac

  case "$file" in
    apps/*/*| packages/*/*)
      ws="$(printf '%s' "$file" | cut -d/ -f1,2)"
      case " $seen_ws " in
        *" $ws "*) continue ;;
      esac
      seen_ws="$seen_ws $ws"
      [ -f "$ws/package.json" ] || continue
      pkg="$(sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$ws/package.json" | head -n1)"
      [ -n "$pkg" ] && filters+=("--filter=$pkg")
      ;;
    */*)
      # ワークスペース外(.claude/ / scripts/ / master-data/ 等)。
      # turbo の対象ではないので整形と lint のみ行う
      ;;
    *)
      # ルート直下の設定(turbo.json / tsconfig.base.json / oxlint.config.ts 等)は
      # 全ワークスペースに影響するため、絞り込まず全体を検査する
      root_changed=1
      ;;
  esac
done <<< "$changed"

# 検査対象がなければ何もしない(ドキュメントのみの変更など)
if [ ${#fmt_files[@]} -eq 0 ]; then
  rm -f "$counter_file"
  exit 0
fi

[ "$root_changed" -eq 1 ] && filters=()

# --- 検査の実行 -----------------------------------------------------------
report=''
failed=0

run_step() {
  local label="$1"
  shift
  local out code
  out="$("$@" 2>&1)"
  code=$?
  if [ "$code" -ne 0 ]; then
    failed=1
    report="${report}
--- ${label} 失敗 (exit ${code}) ---
$(printf '%s\n' "$out" | tail -n 80)
"
  fi
}

# format は自動整形(--write)。整形自体が失敗するのは構文エラー等のときだけ
run_step 'format (oxfmt)' pnpm exec oxfmt --write "${fmt_files[@]}"

if [ ${#lint_files[@]} -gt 0 ]; then
  run_step 'lint (oxlint)' pnpm exec oxlint "${lint_files[@]}"
fi

# typecheck / test はワークスペース単位。変更が及ぶワークスペースだけを検査する
# (ルート設定が変わった場合のみ filters を空にして全体を検査する)
if [ ${#filters[@]} -gt 0 ] || [ "$root_changed" -eq 1 ]; then
  run_step 'typecheck' pnpm exec turbo run typecheck --output-logs=errors-only "${filters[@]}"
  run_step 'test' pnpm exec turbo run test --output-logs=errors-only "${filters[@]}"
fi

# --- 結果の返却 -----------------------------------------------------------
if [ "$failed" -eq 0 ]; then
  rm -f "$counter_file"
  exit 0
fi

count="$(cat "$counter_file" 2>/dev/null)"
case "$count" in
  '' | *[!0-9]*) count=0 ;;
esac
count=$((count + 1))

if [ "$count" -ge "$MAX_RETRY" ]; then
  rm -f "$counter_file"
  printf '{"systemMessage":"検証が %d 回連続で失敗したため、自動での差し戻しを打ち切りました。`pnpm lint` / `pnpm typecheck` / `pnpm test` を手動で確認してください。"}\n' "$count"
  exit 0
fi

printf '%s' "$count" > "$counter_file"

{
  echo "変更ファイルの検証に失敗しました(${count}/${MAX_RETRY} 回目)。原因を修正してください。"
  echo "対象: ${fmt_files[*]}"
  echo "$report"
  echo "※ format(oxfmt)は自動整形済みです。整形によるファイル変更は修正対象ではありません。"
} >&2
exit 2
