---
title: Quick Start
description: Get up and running with Rally in minutes
---

## Quick Start

```bash
rally onboard owner/repo       # Register a project (auto-creates ~/rally/ on first run)

rally dashboard                 # Launch the dashboard ← this is the main entry point
```

The dashboard is Rally's home screen. From here you can dispatch agents to issues and PRs, monitor progress, view logs, and manage all your work.

```
Rally Dashboard

 Issue/PR                               Status               Changes   Age
owner/myrepo
❯ Issue #42  Fix login timeout          ⏳ copilot working              5m
     PR #38  Refactor auth module       🟡 ready for review   +85 -12  23m
owner/otherapp
  Issue #15  Add dark mode toggle       ⏳ copilot working              2h

3 active · 1 done · 0 orphaned

↑/↓ navigate · Enter actions · d details · v open · o browser · a attach
c connect IDE · l logs · n new dispatch · u upstream · x delete · r refresh · q quit
```

## Common Keyboard Shortcuts

- **`n`** — dispatch a new issue or PR
- **`o`** — open in the browser
- **`a`** — attach to a running Copilot session
- **`l`** — view logs
- **`d`** — dispatch details

See the [Dashboard Workflow](/rally/workflows/dashboard/) for the full keyboard shortcut reference.

## Next Steps

- [Onboarding Projects](/rally/guides/onboarding/)
- [Dashboard Workflow](/rally/workflows/dashboard/)
- [CLI Workflows](/rally/workflows/cli/)
