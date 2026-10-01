# Aplos Build Guard

A Claude Code mod that asks before Claude deletes anything that could be the only copy of your work: build output, shipped app binaries, git repositories, whole project folders, or the directory you are working in. It was written after a lost project whose `build/` folder turned out to be the last copy of its compiled code.

## What it does

Before each Bash command runs, the mod reads the command with a small shell parser. It finds every `rm`, `rmdir`, `find ... -delete` and `git clean -f`, follows `cd`, variable assignments and `mktemp`, and resolves each target path. Then it sorts each target:

- **Passes without asking:** reproducible caches such as `node_modules`, `.next`, `.turbo`, `.cache`, `DerivedData`, `~/Library/Caches`, and anything under `/tmp`.
- **Asks you, one item at a time:** `dist`, `build`, `out`, `release`, `artifacts`, `.ipa`, `.apk`, `.app` and similar outputs, any folder containing `.git`, whole folders in `~/Live`, `~/Projects`, `~/Documents` and similar roots, top-level home folders, the working directory or its parents, and wildcards over whole folders.
- **Everything else** goes to Claude Code's normal permission checks unchanged.

If you keep any item, nothing in the command runs, and Claude is told which paths you refused. Where nobody can answer the question, such as `claude -p`, guarded deletes are refused.

Replayed against 1,224 real delete commands from a month of sessions, it prompts on about 3% of them.

## What it reads and sends

It checks whether a target holds a `.git` folder and reads `HOME` and the session's working directory. It makes no network requests, runs no processes, and stores nothing.

## Install

```bash
claude plugin marketplace add Aplos-AI/aplos-mods
claude plugin install aplos-build-guard@aplos-mods
```

MIT licensed. Built by [Aplos AI](https://aplosai.com).
