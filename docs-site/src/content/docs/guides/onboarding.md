---
title: Onboarding Projects
description: Register repositories with Rally
---

## Onboarding a Project

```bash
rally onboard .                          # Current directory
rally onboard /path/to/repo              # Local path
rally onboard owner/repo                 # GitHub shorthand (clones to ~/rally/projects/)
rally onboard https://github.com/o/r     # Full URL
rally onboard owner/repo --fork me/repo  # Fork workflow: origin→fork, upstream→main
rally onboard --team myteam              # Skip interactive team prompt
```

Onboarding symlinks team files (`.squad/`, `.squad-templates/`, `.github/agents/`) into the project, adds `.worktrees/` to `.git/info/exclude`, and registers the project in `projects.yaml`.

## What Happens During Onboarding

1. Rally validates the repository exists and is a git repo
2. Team configuration files are symlinked into the project
3. `.worktrees/` is added to git exclude (keeps worktrees out of git status)
4. Project is registered in `~/rally/projects.yaml`

## Fork Workflow

For contributing to open source projects:

```bash
rally onboard upstream/repo --fork myuser/repo
# origin → myuser/repo (your fork)
# upstream → upstream/repo (main project)
```

## Removing a Project

```bash
rally onboard remove [project]         # Interactive picker if project omitted
rally onboard remove myrepo --yes      # Skip confirmation
```

## Next Steps

- [Multi-Project Workflow](/rally/workflows/multi-project/)
- [Fork Workflow](/rally/workflows/fork/)
