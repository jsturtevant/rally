# Decision: Dispatch Remove Command

**Date:** 2026-02-23
**Author:** Kaylee (Core Dev)
**Status:** Implemented (PR #132)

## Context

Issue #131 requested a way to remove an active dispatch. Users needed to clean up individual dispatches without using `dashboard clean` (which targets done dispatches or all dispatches).

## Decision

Added `rally dispatch remove <number>` as a new subcommand under the existing `dispatch` command group, following the same patterns as `dashboard-clean.js`:

- DI pattern for all external dependencies (testability)
- Ora spinner for progress, Chalk for colored output
- Graceful worktree removal (try/catch, may already be gone)
- `--repo` flag for disambiguation when multiple dispatches share the same number

## Trade-offs

- `findProjectPath()` is duplicated between `dashboard-clean.js` and `dispatch-remove.js`. Accepted for now to avoid refactoring an existing module mid-feature. Should be extracted to a shared utility if a third consumer appears.
- Removal is by number (user-facing) not by internal ID. This matches user mental model but requires disambiguation logic for cross-repo collisions.
