@AGENTS.md

## rules / skills

正は `.agents/rules/` と `.agents/skills/`。Claude Code は `.claude/` しか探索しないため、
`./scripts/sync-agent-config.sh` で `.claude/rules/haregi/` と `.claude/skills/` へコピーする。

- `.claude/` 配下のコピーは生成物(gitignore 済み)。**編集は必ず `.agents/` 側に行い、同期スクリプトを実行する**
- ルール・スキルをインポート(`@`)で取り込まないこと。いずれも必要な時だけロードされる仕組みで、
  CLAUDE.md に取り込むと毎セッション全文が context に載り、その利点を失う
