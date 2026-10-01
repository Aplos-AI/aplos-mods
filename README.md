# aplos-mods

Claude Code mods built from a month of real session data, not guesses.

| Mod | Why it exists | What it does |
|---|---|---|
| `aplos-no-em-dash` | 55,765 em dashes in Claude's replies in 30 days, despite a CLAUDE.md rule against them | Refuses Write/Edit/commit/PR/outbound-message calls that add an em dash, so Claude rewrites the copy. Rewrites em dashes out of Claude's replies as they stream. `/em-dash` shows counts. |
| `aplos-build-guard` | 622 `rm -rf` runs in 30 days, and a lost project whose `build/` folder was the last copy | Asks one item at a time before deleting `dist`, `build`, `out`, `artifacts`, app binaries, git repos, project folders or the working directory. Caches (`.next`, `node_modules`, `~/Library/Caches`, `/tmp`) pass. Refuses when nobody can answer (`claude -p`). Replayed against 1,224 real delete commands: 3% prompt. |
| `secret-redactor` | 45 secret-shaped tokens in tool output in 30 days | Redacts API keys, tokens, JWTs and connection strings from tool results before Claude reads them. Upstream from [claude-code-templates](https://github.com/davila7/claude-code-templates) (MIT), plus Resend, Twilio API key and Supabase secret formats. |

## Install

```bash
claude plugin marketplace add Aplos-AI/aplos-mods
claude plugin install aplos-no-em-dash@aplos-mods
claude plugin install aplos-build-guard@aplos-mods
claude plugin install secret-redactor@aplos-mods
```

Mods are on by default from Claude Code 2.1.287. On 2.1.259 to 2.1.286, set `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`.

Try one without installing:

```bash
claude --plugin-dir ./plugins/aplos-no-em-dash
```

## Test

```bash
claude plugin test plugins/aplos-no-em-dash
claude plugin test plugins/aplos-build-guard
claude plugin test plugins/secret-redactor
```

Tested on Claude Code 2.1.284. The mods API is new and may change between releases.

## Limits

- `aplos-no-em-dash` rewrites reply text mechanically: `x \u2014 y` becomes `x. Y`. Writes are refused instead, so Claude rewrites file copy properly.
- `aplos-build-guard` reads shell syntax with a small lexer. It follows `cd`, `VAR=` assignments, `mktemp`, quotes and heredocs, but not every shell construct. It sits in front of Claude Code's own permission checks and does not replace them.
- `secret-redactor` misses truncated JWTs (no signature segment) and any format it has no pattern for. Add your own with the `patterns` option.

MIT. Built by [Aplos AI](https://aplosai.com).
