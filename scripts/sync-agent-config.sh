#!/usr/bin/env bash
#
# .agents/ のルール・スキルを .claude/ へコピーする。
#
# 正(ソース・オブ・トゥルース)は .agents/ 側。.claude/ 配下のコピーは
# 生成物であり git 管理しない(.gitignore 済み)。直接編集しても次回の
# 同期で失われるため、変更は必ず .agents/ 側に加えること。
#
# 使い方:
#   ./scripts/sync-agent-config.sh
#   ./scripts/sync-agent-config.sh --dry-run   # 変更内容の確認のみ
#
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

dry_run=''
case "${1:-}" in
  --dry-run) dry_run='--dry-run' ;;
  '') ;;
  *) echo "不明な引数: $1(使えるのは --dry-run のみ)" >&2; exit 2 ;;
esac

# $1: コピー元 / $2: コピー先
sync_dir() {
  local src="$1" dest="$2"

  if [ ! -d "$src" ]; then
    echo "  skip  $src (存在しません)"
    return
  fi

  # 旧構成のシンボリックリンクが残っていると実体(.agents/)へ書き込んで
  # しまうため、リンクだった場合は必ず外してからディレクトリを作る
  if [ -L "$dest" ]; then
    echo "  unlink $dest (旧シンボリックリンクを削除)"
    [ -n "$dry_run" ] || rm "$dest"
  fi

  [ -n "$dry_run" ] || mkdir -p "$dest"
  # --delete: .agents/ 側で削除されたファイルをコピー先にも反映する
  rsync -a --delete $dry_run "$src/" "$dest/"
  echo "  sync  $src/ -> $dest/"
}

echo "エージェント設定を同期します${dry_run:+ (dry-run)}"
sync_dir ".agents/rules" ".claude/rules/haregi"
sync_dir ".agents/skills" ".claude/skills"
echo "完了しました。"
