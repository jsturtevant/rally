# Decision: Copilot Log Redirection Strategy

**Author:** Kaylee (Core Dev)  
**Date:** 2026-02-23  
**Context:** Issue #135 — Copilot CLI output bleeding into user terminal  

## Problem

When `rally dispatch issue` launches `gh copilot` as a background process with `stdio: 'inherit'`, Copilot's output pollutes the user's terminal. Users want clean terminal output and the ability to review Copilot logs later.

## Decision

**Redirect Copilot stdout/stderr to a log file in the worktree.**

### Implementation Details

1. **Log file location:** `.copilot-output.log` in worktree root (same directory as `.squad` symlink)
   - Consistent path pattern: `join(worktreePath, '.copilot-output.log')`
   - Lives alongside worktree, gets cleaned up when worktree is removed
   - Hidden file (dotfile) to avoid cluttering user's view

2. **File descriptor management:** 
   - Use `fs.openSync(logPath, 'w')` to get fd
   - Pass `stdio: ['ignore', fd, fd]` to spawn (stdout and stderr both to log)
   - Immediately `fs.closeSync(fd)` after spawn (child inherits the open fd)
   - stdin ignored (Copilot is non-interactive in this mode)

3. **State tracking:**
   - Add optional `logPath` field to dispatch records in `active.yaml`
   - Persisted during `addDispatch()` call in `setupDispatchWorktree()`
   - Enables retrieval with `rally dispatch log <number>`

4. **New command:** `rally dispatch log <number> [--repo] [--follow]`
   - Finds dispatch by number (same disambiguation logic as `dispatch remove`)
   - Reads and displays log file content
   - Graceful degradation: warns if logPath missing or file not found
   - `--follow` flag accepted but not yet implemented (placeholder for future)

### Alternatives Considered

- **Pipe to `tee`:** Rejected — too shell-specific, not cross-platform
- **Separate stdout/stderr files:** Rejected — single unified log is simpler for users
- **Global log directory:** Rejected — worktree-local keeps cleanup atomic
- **No redirection + terminal multiplexing:** Rejected — forces user to manage terminal state

## Impact

### User-Facing
- ✅ Clean terminal output during dispatch
- ✅ Logs are retrievable: `rally dispatch log <number>`
- ✅ Logs cleaned up automatically when dispatch removed
- ⚠️ Pre-existing dispatches (created before this change) won't have logs

### Developer-Facing
- `launchCopilot()` signature extended with `logPath` parameter
- Return value extended from `{ sessionId, process }` to `{ sessionId, process, logPath }`
- All callers must be updated (currently only `setupDispatchWorktree()`)
- DI pattern extended: `_fs` parameter with `openSync`/`closeSync` for testing

### Testing
- 7 new test cases in `test/dispatch-log.test.js`
- 3 new test cases in `test/copilot.test.js` for log redirection
- All existing tests continue to pass (backward compatible — logPath is optional)

## Follow-Up Work

1. **Implement `--follow` flag** — tail -f style log streaming (future issue)
2. **Log rotation** — if log files grow too large (not currently a concern)
3. **Log file compression** — for long-running dispatches (future optimization)

## Rationale

This approach is:
- **Simple:** Single log file per dispatch, standard fs APIs
- **Discoverable:** `rally dispatch log` mirrors `rally dispatch remove` UX
- **Atomic:** Log lifecycle tied to worktree lifecycle
- **Testable:** Full DI pattern, no global state, clean mocking
- **Cross-platform:** Pure Node.js fs module, works on Windows/macOS/Linux
