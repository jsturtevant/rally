---
title: CLI Workflows
description: Using Rally from the command line
---

## CLI Commands

While the dashboard is the main interface, Rally provides CLI commands for scriptable workflows.

### Core Commands

```bash
rally dashboard              # Launch interactive dashboard
rally onboard owner/repo     # Register a project
rally dispatch               # Dispatch with interactive prompts
rally dispatch issue 42      # Direct dispatch to issue #42
rally dispatch pr 99         # Direct dispatch to PR #99
rally status                 # List active dispatches
rally clean                  # Clean up completed dispatches
```

### Status and Monitoring

```bash
rally status                 # Summary of all active dispatches
rally status --json          # JSON output for scripting
rally sessions               # List Copilot sessions
```

### Cleanup Commands

```bash
rally clean                  # Interactive cleanup of done dispatches
rally clean --all            # Clean all done dispatches
rally clean --orphaned       # Clean orphaned worktrees only
```

### Project Management

```bash
rally onboard remove [project]  # Remove project
rally refresh                   # Refresh project data from GitHub
```

## Dispatch Flow (CLI)

```bash
# Option 1: Interactive
rally dispatch
# → Select project
# → Choose Issue or PR
# → Enter number

# Option 2: Direct
rally dispatch issue 42 --project myrepo
rally dispatch pr 99 --project myrepo
```

## Common Workflows

### Starting Fresh

```bash
rally onboard owner/myrepo
rally dashboard
# Press 'n' to dispatch first issue
```

### Daily Workflow

```bash
rally dashboard              # Check status
# Work on items, push changes
rally clean --all            # Clean up merged PRs
```

### CI/Scripting

```bash
# Check for completed dispatches
if rally status --json | jq -e '.done | length > 0'; then
  rally clean --all
fi
```

## Command Reference

See the [Command Reference](/rally/reference/commands/) for full details on all commands and options.
