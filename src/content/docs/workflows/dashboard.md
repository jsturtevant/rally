---
title: Dashboard Workflow
description: Working with the Rally dashboard
---

## The Dashboard

The dashboard is Rally's main interface. Launch it with:

```bash
rally dashboard
# or just
rally
```

## Dashboard Views

### Main Table View

```
Rally Dashboard

 Issue/PR                               Status               Changes   Age
owner/myrepo
❯ Issue #42  Fix login timeout          ⏳ copilot working              5m
     PR #38  Refactor auth module       🟡 ready for review   +85 -12  23m

2 active · 0 done · 0 orphaned

↑/↓ navigate · Enter actions · d details · v open · o browser · a attach
c connect IDE · l logs · n new dispatch · u upstream · x delete · r refresh · q quit
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑/↓` or `j/k` | Navigate selection |
| `Enter` | Open action menu for selected item |
| `d` | Show dispatch details |
| `n` | New dispatch (issue or PR) |
| `v` | Open worktree in VS Code |
| `c` | Connect IDE to Copilot session |
| `o` | Open in browser |
| `a` | Attach to running Copilot session |
| `l` | View Copilot logs |
| `u` | Mark as "waiting on upstream" |
| `x` | Delete dispatch (with confirmation) |
| `r` | Refresh data |
| `?` | Toggle help |
| `q` | Quit |

### Status Icons

| Icon | Status |
|------|--------|
| ⏳ | Copilot working (session active) |
| 🔵 | Implementing (worktree exists, no session) |
| 🟣 | Pushed (commits on branch) |
| 🟡 | Ready for review (PR opened) |
| ⏸️ | Waiting on upstream (paused) |
| ✅ | Done (PR merged) |
| 👻 | Orphaned (worktree without active file) |

## Dispatch Flow

1. Press `n` to start a new dispatch
2. Select a project (if multiple onboarded)
3. Choose Issue or PR
4. Enter the issue/PR number
5. Rally creates a worktree and launches Copilot

## Actions on Dispatches

### View Details (`d`)

Shows full dispatch information:
- Title and description
- Status and timeline
- File changes
- Linked commits

### Attach to Session (`a`)

Opens a new terminal attached to the running Copilot session. You can interact with Copilot directly while it works.

### View Logs (`l`)

Shows the Copilot output log. Useful for debugging or seeing what Copilot has done.

### Mark Upstream (`u`)

Marks the dispatch as "waiting on upstream" — useful when you've pushed changes and are waiting for CI, review, or other feedback.

### Delete (`x`)

Removes the dispatch and its worktree. Rally asks for confirmation before deleting.

## Next Steps

- [CLI Workflows](/rally/workflows/cli/)
- [Multi-Project Workflow](/rally/workflows/multi-project/)
