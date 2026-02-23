# Decision: Dispatch Status Refresh via PID Polling

**By:** Kaylee (Core Dev)
**Date:** 2025-07-17
**Status:** Proposed

## Context

Issue #136: Dispatches get stuck at "planning" because the parent process exits before Copilot finishes (due to `child.unref()` on detached processes), so Node exit events never fire.

## Decision

Use PID-based polling instead of process exit events. `refreshDispatchStatuses()` checks if stored PIDs are still alive via `process.kill(pid, 0)`. Dead PID → status moves to "done".

Refresh is called automatically:
- Before dashboard rendering (`getDashboardData`)
- In `rally status` command
- Manually via `rally dispatch refresh`

## Rationale

- `child.unref()` means Node won't keep the event loop alive for the child — exit events are unreliable
- PID polling on next user interaction is simple, correct, and doesn't require background daemons
- "done" is the right terminal status for dead PIDs — Copilot may have finished successfully or failed, but either way it's no longer active

## Impact

- All agents: dispatches in "planning"/"implementing" will auto-transition to "done" when viewed
- Dashboard, status, and manual refresh all share the same `refreshDispatchStatuses()` function
- New file: `lib/dispatch-refresh.js` — import from here for refresh logic
