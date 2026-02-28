# Dispatch Status Flow

This document describes how dispatch statuses transition from creation to completion.

## Statuses

| Status         | Icon | Dashboard Label       | Description                                      |
|----------------|------|-----------------------|--------------------------------------------------|
| `implementing` | ⏳   | copilot working       | Copilot is actively working (coding or reviewing)|
| `reviewing`    | 🟡   | ready for review      | Copilot finished — awaiting human review         |
| `upstream`     | 🔵   | waiting on upstream   | Marked as waiting on upstream (manual via `p`)   |

## Transitions

```
┌──────────────┐     ┌───────────┐     ┌──────────┐
│ implementing │────▶│ reviewing │────▶│ upstream │
└──────────────┘     └───────────┘     └──────────┘
```

### Issue dispatches

1. **implementing** — Created when `rally dispatch issue` is run. Copilot agent is launched.
2. **reviewing** — Automatic transition when the copilot process exits and the log file is no longer being written to. The work is ready for human review.
3. **upstream** — Manual status set via dashboard `p` key after human review (e.g., PR opened, waiting for CI/review).

### PR dispatches

1. **implementing** — Created when `rally dispatch pr` is run. Copilot agent is launched to perform a multi-model code review.
2. **reviewing** — Automatic transition when the copilot process exits and the log file is no longer active. The review output (REVIEW.md) is ready for human consumption.
3. **upstream** — Manual status set via dashboard `p` key.

## Automatic status detection

The `refreshDispatchStatuses()` function runs on every dashboard refresh and checks dispatches in `implementing` status:

1. **PID check** — Is the copilot process (tracked by PID) still running?
2. **Log activity check** — Has the `.copilot-output.log` file been modified in the last 30 seconds?

If both checks indicate the process is no longer active, the status automatically transitions to `reviewing`.

Dispatches already in `reviewing` or `upstream` are not affected by the automatic refresh.

## Cleanup

Use `rally clean` to remove dispatches and their worktrees. This permanently deletes dispatch records — there is no intermediate `done` or `cleaned` status.
