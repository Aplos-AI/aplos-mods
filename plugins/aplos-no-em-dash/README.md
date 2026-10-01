# Aplos No Em Dash

A Claude Code mod that keeps em dashes (U+2014) out of everything Claude writes. Em dashes are one of the most recognizable tells of AI-written text, and a CLAUDE.md rule alone does not stop them: in one month of real sessions, Claude produced over 55,000 em dashes despite an explicit instruction not to.

## What it does

- **File writes.** A Write, Edit or NotebookEdit call that adds an em dash is refused with a short reason, so Claude rewrites the clause properly. Edits that keep or remove existing em dashes pass, so legacy files can still be edited.
- **Shell writes.** A Bash command that writes text (git commit, gh pr/issue/release, heredocs, redirects, tee) and contains an em dash is refused. Read-only commands such as grep are untouched.
- **Outbound messages.** An MCP tool call whose name says it sends or stores text (send, draft, post, reply, comment, create, update, publish) is refused when its input contains an em dash.
- **Replies.** Claude's streamed answer is rewritten as it arrives, both on screen and in the transcript. A clause dash becomes a sentence break, a dash opening a line becomes a hyphen, and an empty table cell becomes a hyphen.
- `/em-dash` prints how many writes were refused and how many dashes were rewritten since the mod loaded.

## What it reads and sends

It reads the file being overwritten, to compare em dash counts. It makes no network requests, runs no processes, and stores nothing.

## Limits

The reply rewrite is mechanical, so a rewritten sentence can read slightly abrupt. File writes are refused instead of rewritten, so Claude produces natural copy there. Tested with Claude Code 2.1.284 and 2.1.287.

## Install

```bash
claude plugin marketplace add Aplos-AI/aplos-mods
claude plugin install aplos-no-em-dash@aplos-mods
```

MIT licensed. Built by [Aplos AI](https://aplosai.com).
