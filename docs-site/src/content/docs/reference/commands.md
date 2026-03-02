---
title: Command Reference
description: Complete CLI command reference
---

## Global Options

All commands support these options:

```
--help, -h      Show help
--version       Show version
--debug         Enable debug output
```

## Commands

### `rally dashboard`

Launch the interactive dashboard.

```bash
rally dashboard
rally                        # Alias
```

### `rally onboard`

Register a project with Rally.

```bash
rally onboard <repo>                     # Onboard a repository
rally onboard remove [project]           # Remove a project
```

**Arguments:**
- `<repo>` — Path, GitHub shorthand (`owner/repo`), or URL

**Options:**
- `--fork <fork>` — Configure fork relationship
- `--team <team>` — Team configuration to use
- `--yes` — Skip confirmation prompts

**Examples:**
```bash
rally onboard .                          # Current directory
rally onboard owner/repo                 # GitHub shorthand
rally onboard owner/repo --fork me/repo  # Fork workflow
rally onboard remove myrepo --yes        # Remove without confirmation
```

### `rally dispatch`

Dispatch Copilot to an issue or PR.

```bash
rally dispatch                           # Interactive mode
rally dispatch issue <number>            # Dispatch to issue
rally dispatch pr <number>               # Dispatch to PR
```

**Options:**
- `--project <name>` — Target project
- `--sandbox` — Run in Docker sandbox
- `--trust` — Skip trust confirmation

**Examples:**
```bash
rally dispatch issue 42
rally dispatch pr 99 --project myrepo
rally dispatch issue 15 --sandbox
```

### `rally status`

Show status of active dispatches.

```bash
rally status                 # Human-readable output
rally status --json          # JSON output
```

### `rally clean`

Clean up completed dispatches.

```bash
rally clean                  # Interactive cleanup
rally clean --all            # Clean all done dispatches
rally clean --orphaned       # Clean orphaned worktrees only
```

**Options:**
- `--all` — Clean all without prompts
- `--orphaned` — Only clean orphaned worktrees
- `--yes` — Skip confirmation

### `rally refresh`

Refresh project data from GitHub.

```bash
rally refresh                # Refresh all projects
rally refresh <project>      # Refresh specific project
```

### `rally sessions`

List Copilot sessions.

```bash
rally sessions               # List all sessions
rally sessions --active      # Show only active sessions
```

### `rally setup`

Configure Rally settings.

```bash
rally setup                  # Interactive setup
rally setup team             # Configure team settings
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Configuration error |
| 130 | User interrupt (Ctrl+C) |
