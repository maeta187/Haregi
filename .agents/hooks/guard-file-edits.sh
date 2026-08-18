#!/usr/bin/env bash
#
# PreToolUse (Write / Edit) — 編集してはいけないパスへの書き込みを拒否する。
#
# 1. `.claude/rules/haregi/` と `.claude/skills/` は sync-agent-config.sh が
#    生成するコピー。直接編集しても次回の同期で失われるため、`.agents/` 側の
#    対応パスへ誘導する。
# 2. `.github/workflows/` は非スコープ(GitHub Actions CI は導入しない。
#    .agents/rules/stack.md)。
#
# 拒否は exit 2 + stderr で行う(stderr の内容がエージェントに渡り、
# ツール呼び出し自体は実行されない)。
#
# 対象パスの取り出し方はツールによって異なる:
#   - Claude Code (Write / Edit): tool_input.file_path
#   - Codex (apply_patch): patch 文字列の "*** Update File: <path>" 行
#     (Codex は matcher に Write / Edit のエイリアスを受け付けるが、stdin へは
#      常に apply_patch 形式で渡す)
#
# jq が無い環境では判定できないため素通しする(ブロックが効かないだけで、
# 作業を止めることはしない)。
#
set -o pipefail

command -v jq > /dev/null 2>&1 || exit 0

repo_root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

payload="$(cat)"

targets="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"
if [ -z "$targets" ]; then
  # apply_patch: tool_input 内の文字列を集め、パッチのファイル指定行だけを拾う
  targets="$(
    printf '%s' "$payload" \
      | jq -r '[.tool_input | .. | strings] | join("\n")' 2>/dev/null \
      | sed -E -n 's/^\*\*\* (Add File|Update File|Delete File|Move to): //p'
  )"
fi
[ -n "$targets" ] || exit 0

while IFS= read -r file_path; do
  [ -n "$file_path" ] || continue

  # 絶対パスをリポジトリ相対に正規化する
  rel="${file_path#"$repo_root"/}"
  rel="${rel#./}"

  case "$rel" in
    .claude/rules/haregi/*)
      target=".agents/rules/${rel#.claude/rules/haregi/}"
      cat >&2 <<EOF
$rel は生成物です(sync-agent-config.sh がコピーします)。直接編集すると次回の同期で失われます。

代わりに $target を編集してください(同期は検証 hook が自動で行います)。
EOF
      exit 2
      ;;
    .claude/skills/*)
      target=".agents/skills/${rel#.claude/skills/}"
      cat >&2 <<EOF
$rel は生成物です(sync-agent-config.sh がコピーします)。直接編集すると次回の同期で失われます。

代わりに $target を編集してください(同期は検証 hook が自動で行います)。
なお外部スキル(kaizen / shadcn / tdd / webapp-testing / modern-web-guidance)は
skills-lock.json から復元されるため、そもそも手で編集しません。
EOF
      exit 2
      ;;
    .github/workflows/*)
      cat >&2 <<EOF
$rel の作成は非スコープです。GitHub Actions CI は導入しない方針です
(.agents/rules/stack.md「非スコープ」/ docs/architecture.md 決定事項 #14)。

品質ゲートは docs/release-checklist.md の手動チェックが担います。
CI が必要だと判断した場合は、実装ではなくユーザーへの提案として伝えてください。
EOF
      exit 2
      ;;
  esac
done <<< "$targets"

exit 0
