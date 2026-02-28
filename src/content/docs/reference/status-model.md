---
title: Status Model
description: Understanding dispatch status and lifecycle
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

## Checking Status

```bash
rally status                 # Summary view
rally status --json          # JSON for scripting
```

Dashboard shows status icons for each dispatch.
