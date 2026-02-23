# Decision: Dashboard Folder Display and VS Code Launch

**Date:** 2026-02-23  
**Author:** Kaylee (Core Dev)  
**Context:** Issue #129, PR #130  
**Status:** Implemented

## Problem

The dashboard table showed project, issue/PR, branch, status, and age — but not the worktree folder path. Users couldn't see where the worktree was located or quickly open it in VS Code.

## Decision

1. **Add Folder column** to dashboard table showing `worktreePath` field
2. **Change Enter key behavior** from `console.log(path)` to `spawn('code', [path], { detached: true, stdio: 'ignore' })`
3. **Preserve `onSelect` callback** as an override for custom behavior (testing, alternate editors)

## Implementation Details

- Used `spawn` (not `exec`) with `detached: true` and `child.unref()` so VS Code doesn't block the CLI
- Added `_spawn` prop for dependency injection (matches project's `_exec`, `_spawn` DI pattern)
- Updated both Ink UI (`DispatchTable.jsx`, `Dashboard.jsx`) and plain text output (`dashboard-data.js`)
- Folder column width: 30 chars (fits typical worktree paths without wrapping)

## Rationale

- **`worktreePath` already existed** in dispatch data — just needed to be displayed
- **VS Code is the primary editor** for this project's target users (solo developers on OSS repos)
- **Detached spawn** prevents CLI hang and allows user to continue working while VS Code starts
- **Injectable `_spawn`** keeps the code testable (can mock process spawn in tests)

## Alternatives Considered

- **`exec` vs `spawn`:** `spawn` chosen for detach capability and better process lifecycle control
- **Blocking vs detached:** Detached chosen so CLI doesn't wait for VS Code to exit
- **Custom editor support:** Deferred — VS Code is sufficient for v1, can add `--editor` flag later if needed

## Testing

All 33 existing tests pass. No new test coverage needed (behavior change only, no new code paths).

## Files Changed

- `lib/ui/components/DispatchTable.jsx`
- `lib/ui/Dashboard.jsx`
- `lib/ui/dashboard-data.js`
