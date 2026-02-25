# Dispatch Status Flow

This document describes how dispatch statuses transition from creation to completion.

## Statuses

| Status         | Icon | Dashboard Label     | Description                                      |
|----------------|------|---------------------|--------------------------------------------------|
| `planning`     | 🔵   | planning            | Copilot is planning the approach                 |
| `implementing` | ⏳   | copilot working     | Copilot is actively working (coding or reviewing)|
| `reviewing`    | 🟡   | ready for review    | Copilot finished — awaiting human review         |
| `pushed`       | 🟣   | pushed              | Changes have been pushed                         |
| `done`         | ✅   | done                | Dispatch is complete                             |
| `cleaned`      | ⚪   | cleaned             | Worktree has been removed                        |

## Transitions

```
┌──────────┐     ┌──────────────┐     ┌───────────┐     ┌────────┐     ┌──────┐     ┌─────────┐
│ planning │────▶│ implementing │────▶│ reviewing │────▶│ pushed │────▶│ done │────▶│ cleaned │
└──────────┘     └──────────────┘     └───────────┘     └────────┘     └──────┘     └─────────┘
```

### Issue dispatches

1. **planning** — Created when `rally dispatch issue` is run. Copilot agent is launched.
2. **implementing** — Copilot begins coding the solution.
3. **reviewing** — Automatic transition when the copilot process exits and the log file is no longer being written to. The work is ready for human review.
4. **pushed** → **done** → **cleaned** — Manual progression after human review.

### PR dispatches

1. **implementing** — Created when `rally dispatch pr` is run. Copilot agent is launched to perform a multi-model code review.
2. **reviewing** — Automatic transition when the copilot process exits and the log file is no longer active. The review output (REVIEW.md) is ready for human consumption.
3. **pushed** → **done** → **cleaned** — Manual progression.

## Automatic status detection

The `refreshDispatchStatuses()` function runs on every dashboard refresh and checks dispatches in `planning` or `implementing` status:

1. **PID check** — Is the copilot process (tracked by PID) still running?
2. **Log activity check** — Has the `.copilot-output.log` file been modified in the last 30 seconds?

If both checks indicate the process is no longer active, the status automatically transitions to `reviewing`.

Dispatches already in `reviewing`, `pushed`, `done`, or `cleaned` are not affected by the automatic refresh.
