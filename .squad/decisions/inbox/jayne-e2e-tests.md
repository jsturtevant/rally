# Decision: E2E Test Patterns for Rally CLI

**By:** Jayne (Tester)
**Date:** 2026-02-23
**Status:** Proposed

## Decision

E2E tests bypass `rally setup` and `rally onboard` interactive prompts by seeding config files (config.yaml, projects.yaml, active.yaml) directly into a temp `RALLY_HOME`. This is the canonical pattern for testing any downstream command that depends on setup/onboard state.

Since `dispatch` is not wired as a CLI subcommand, E2E tests import `dispatchIssue` from `lib/dispatch-issue.js` directly. When dispatch becomes a CLI command, tests should switch to `execFileSync` invocation.

## Key Findings

1. `.squad` is tracked in git — worktrees already contain `.squad/` after checkout. The `createSymlink` function will EEXIST if `teamDir` points to an existing directory. Tests pass a nonexistent `teamDir` to skip the symlink step.
2. Worktree cleanup **must** use `git worktree remove --force` before any `rmSync` call, otherwise EIO errors occur.
3. `dashboardClean` is testable via dependency injection (`_ora`, `_chalk`, `_removeWorktree`).

## Impact

All agents writing tests should:
- Seed config via YAML files, not through `rally setup`/`rally onboard` CLI
- Clean up worktrees with `git worktree remove` + `git branch -D`
- Use 30-60s timeouts for any ESM-based CLI invocation
