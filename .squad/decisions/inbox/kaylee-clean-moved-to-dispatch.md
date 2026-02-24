# Decision: Clean moved from dashboard to dispatch

**Author:** Kaylee (Core Dev)
**Date:** 2026
**Issue:** #146
**PR:** #150

## Context

The `clean` command was under `rally dashboard clean` but it's a dispatch lifecycle operation — it removes worktrees, branches, and active.yaml entries. It belongs with the other dispatch subcommands (`issue`, `pr`, `remove`, `log`).

## Decision

- `clean` is now at `rally dispatch clean`
- Clean deletes branches (previously preserved them)
- Clean targets both `done` and `cleaned` statuses
- No backward-compat alias for `dashboard clean` — we're early stage

## Impact

- Anyone who used `rally dashboard clean` needs to use `rally dispatch clean`
- Branches are now deleted during clean — this is a behavior change
- Dashboard 'd' shortcut added for quick dispatch removal
