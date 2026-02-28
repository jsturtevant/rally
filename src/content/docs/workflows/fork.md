---
title: Fork Workflow
description: Contributing to open source with Rally
---

## Fork Workflow

When contributing to open source, you typically:
1. Fork the main repository
2. Clone your fork
3. Add the original repo as "upstream"
4. Push to your fork, PR to upstream

Rally automates this setup with the `--fork` flag.

## Setting Up a Fork

```bash
rally onboard upstream/repo --fork myuser/repo
```

This configures:
- `origin` → `myuser/repo` (your fork)
- `upstream` → `upstream/repo` (main project)

## How It Works

When you dispatch to an issue in a fork-configured project:

1. Rally fetches from upstream to get latest changes
2. Creates a worktree branching from upstream/main
3. Dispatches Copilot to work on the issue
4. Commits are pushed to your fork
5. PRs are opened against the upstream repo

## Example Workflow

```bash
# 1. Set up fork relationship
rally onboard facebook/react --fork myuser/react

# 2. Dispatch to an issue in the upstream repo
rally dispatch issue 12345 --project react

# 3. Copilot creates branch and works on issue
# 4. When ready, PR is opened: myuser/react → facebook/react
```

## Dashboard View

Fork workflows show in the dashboard like any other dispatch:

```
Rally Dashboard

 Issue/PR                                Status               Changes   Age
myuser/react (fork of facebook/react)
❯ Issue #12345  Fix rendering bug        🟡 ready for review   +23 -5   2h
```

## Manual Setup

If you already have a fork cloned, you can onboard it and Rally will detect the fork relationship:

```bash
cd ~/projects/my-react-fork
rally onboard .
# Rally detects origin/upstream and configures accordingly
```

## Related

- [Onboarding Projects](/rally/guides/onboarding/)
- [Multi-Project Workflow](/rally/workflows/multi-project/)
