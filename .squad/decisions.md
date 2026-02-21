# Decisions

Team decisions that affect how we work. All agents read this before starting work.

<!-- Scribe merges entries from .squad/decisions/inbox/ into this file. -->

---

## Decision: PRD Draft — Architecture & State Management

**By:** Mal (Lead)  
**Date:** 2026-02-21  
**Status:** Proposed

### Decision

Drafted the initial PRD (`docs/PRD.md`) establishing:

1. **Three-file state model** under `~/.dispatcher/`: `config.json`, `projects.json`, `active.json`. File-based, zero dependencies, human-readable.
2. **Symlink + exclude as the core pattern.** `onboard` creates symlinks and writes `.git/info/exclude`. This is the foundational technique — everything else builds on it.
3. **Worktrees inside the repo** at `.worktrees/dispatcher-<N>/` with `dispatcher/<N>-<slug>` branch naming.
4. **Module-per-command structure** in `lib/` with shared utilities.

### Open Questions (need team input)

- How does Dispatcher invoke Squad after worktree setup? (Option A: just set up + print instructions, Option B: invoke Squad CLI, Option C: open VS Code)
- Per-project vs. shared team state?
- Windows symlink fallback strategy?

### Impact

All agents should read `docs/PRD.md` before implementing any command. It has CLI specs, error cases, and state formats.
