#!/usr/bin/env bash
#
# Notification / Stop — macOS の通知センターに知らせる。
#
# turbo run test を含む検証で待ち時間が出るため、離席していても
# 「承認待ちで止まっている」「一区切りついた」が分かるようにする。
#
# macOS 以外では何もしない。通知の可否は作業の成否に影響しないため、
# 常に exit 0 で抜ける。
#
set -o pipefail

[ "$(uname -s)" = 'Darwin' ] || exit 0
command -v osascript > /dev/null 2>&1 || exit 0

payload="$(cat)"

event='Stop'
message=''
if command -v jq > /dev/null 2>&1; then
  event="$(printf '%s' "$payload" | jq -r '.hook_event_name // "Stop"' 2>/dev/null)"
  message="$(printf '%s' "$payload" | jq -r '.message // empty' 2>/dev/null)"
fi

case "$event" in
  Notification)
    title='Haregi — 確認待ち'
    body="${message:-入力を待っています}"
    ;;
  *)
    title='Haregi — 一区切り'
    body='応答が完了しました'
    ;;
esac

# osascript に渡す文字列を壊さないよう、引用符と改行を落とす
sanitize() {
  printf '%s' "$1" | tr '\n\r' '  ' | tr -d '"\\' | cut -c1-180
}

osascript -e "display notification \"$(sanitize "$body")\" with title \"$(sanitize "$title")\"" > /dev/null 2>&1

exit 0
