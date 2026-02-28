---
title: Key Concepts
description: Core concepts in Rally
---

## Worktrees

Rally uses [git worktrees](https://git-scm.com/docs/git-worktree) to manage multiple branches simultaneously. Each dispatch gets its own worktree, allowing parallel work on multiple issues.

**Location:** `<project>/.worktrees/<issue-or-pr>/`

**Benefits:**
- No need to stash changes when switching tasks
- Each dispatch is completely isolated
- Can run builds/tests in parallel

## Dispatches

A dispatch is a work unit — an issue or PR that Copilot is working on.

**Components:**
- A git worktree with the code
- A tracking file in `~/rally/active/`
- A Copilot session (when active)

**Lifecycle:** See [Status Model](/rally/reference/status-model/)

## Projects

A project is a git repository registered with Rally.

**Registration:** `rally onboard <repo>`

**Storage:** `~/rally/projects.yaml`

**Data:**
- Repository path
- Remote configuration
- Team settings

## Team Configuration

Rally uses [Squad](https://bradygaster.github.io/squad/) team files:

| Directory | Purpose |
|-----------|---------|
| `.squad/` | Team state and context |
| `.squad-templates/` | Templates for issues/PRs |
| `.github/agents/` | Agent configurations |

These are symlinked into each project during onboarding.

## Sessions

A session is an active Copilot CLI instance working on a dispatch.

**Operations:**
- **Attach** (`a`) — Connect your terminal to a running session
- **View Logs** (`l`) — See what Copilot has done
- **Connect IDE** (`c`) — Open VS Code connected to the session

## The Rally Home Directory

Rally stores all data in `~/rally/`:

```
~/rally/
├── config.yaml      # User configuration
├── projects.yaml    # Registered projects
├── active/          # Dispatch tracking files
├── logs/            # Session logs
└── projects/        # Cloned repositories (for GitHub shorthand onboards)
```

## Read-Only Policy

By default, Rally runs Copilot with restricted tools — it can read code but cannot edit, create, or delete files. This is a safety measure.

**Trust mode** (`--trust` or `require_trust: never`) allows full write access.

See [Read-Only Policy](/rally/security/read-only-policy/) for details.
