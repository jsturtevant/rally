---
title: Status Model
description: Rally dispatch status lifecycle
---

## Dispatch Lifecycle

A dispatch moves through these statuses:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   new dispatch                                                  │
│        │                                                        │
│        ▼                                                        │
│   ⏳ copilot working ─────┬───────────────────────┐             │
│        │                  │                       │             │
│        ▼                  ▼                       ▼             │
│   🔵 implementing    🟣 pushed            ⏸️ waiting on         │
│        │                  │                 upstream            │
│        │                  ▼                       │             │
│        └──────────▶ 🟡 ready for review ◀────────┘             │
│                           │                                     │
│                           ▼                                     │
│                      ✅ done                                    │
│                           │                                     │
│                           ▼                                     │
│                      (cleaned)                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Core Statuses

The simplified status flow for issue and PR dispatches:

| Status         | Icon | Dashboard Label       | Description                                      |
|----------------|------|-----------------------|--------------------------------------------------|
| `implementing` | ⏳   | copilot working       | Copilot is actively working (coding or reviewing)|
| `reviewing`    | 🟡   | ready for review      | Copilot finished — awaiting human review         |
| `upstream`     | 🔵   | waiting on upstream   | Marked as waiting on upstream (manual via `u`)   |

### Simplified Flow

```
┌──────────────┐     ┌───────────┐     ┌──────────┐
│ implementing │────▶│ reviewing │────▶│ upstream │
└──────────────┘     └───────────┘     └──────────┘
```

## Status Definitions

### ⏳ Copilot Working

Copilot is actively working in the worktree. A Copilot session is attached.

**Transitions:**
- → Implementing (session ends without push)
- → Pushed (session pushes commits)
- → Waiting on Upstream (user marks as waiting)

### 🔵 Implementing

Worktree exists with changes, but no active Copilot session. Work in progress.

**Transitions:**
- → Copilot Working (attach session)
- → Pushed (manual or Copilot push)

### 🟣 Pushed

Commits have been pushed to the branch, but no PR exists yet.

**Transitions:**
- → Ready for Review (PR opened)
- → Copilot Working (more work needed)

### 🟡 Ready for Review

A PR is open and ready for review.

**Transitions:**
- → Done (PR merged)
- → Copilot Working (revisions requested)

### ⏸️ Waiting on Upstream

User has marked this dispatch as waiting — typically for CI, review feedback, or upstream changes.

**Transitions:**
- → Any active status (user resumes work)
- → Done (PR merged)

### ✅ Done

PR has been merged. Dispatch is complete and can be cleaned.

**Transitions:**
- → Cleaned (user runs `rally clean`)

### 👻 Orphaned

A worktree exists but has no tracking file. This can happen if:
- Rally was interrupted during cleanup
- Files were manually deleted
- A bug in Rally

**Resolution:** Clean orphaned worktrees with `rally clean --orphaned`

## Issue Dispatches

1. **implementing** — Created when `rally dispatch issue` is run. Copilot agent is launched.
2. **reviewing** — Automatic transition when the copilot process exits and the log file is no longer being written to. The work is ready for human review.
3. **upstream** — Manual status set via dashboard `u` key after human review (e.g., PR opened, waiting for CI/review).

## PR Dispatches

1. **implementing** — Created when `rally dispatch pr` is run. Copilot agent is launched to perform a multi-model code review.
2. **reviewing** — Automatic transition when the copilot process exits and the log file is no longer active. The review output (REVIEW.md) is ready for human consumption.
3. **upstream** — Manual status set via dashboard `u` key.

## Automatic Status Detection

The `refreshDispatchStatuses()` function runs on every dashboard refresh and checks dispatches in `implementing` status:

1. **PID check** — Is the copilot process (tracked by PID) still running?
2. **Log activity check** — Has the `.copilot-output.log` file been modified in the last 30 seconds?

If both checks indicate the process is no longer active, the status automatically transitions to `reviewing`.

Dispatches already in `reviewing` or `upstream` are not affected by the automatic refresh.

## Cleanup

Use `rally clean` to remove dispatches and their worktrees. This permanently deletes dispatch records — there is no intermediate `done` or `cleaned` status.

## Checking Status

```bash
rally status                 # Summary view
rally status --json          # JSON for scripting
```

Dashboard shows status icons for each dispatch.
