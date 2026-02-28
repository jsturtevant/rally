---
title: Multi-Project Workflow
description: Working with multiple repositories
---

## Multi-Project Support

Rally supports working across multiple repositories simultaneously. Each project gets its own isolated worktrees and dispatch tracking.

## Onboarding Multiple Projects

```bash
rally onboard owner/repo1
rally onboard owner/repo2
rally onboard owner/repo3
```

Or onboard from different orgs:

```bash
rally onboard alice/frontend
rally onboard bob/backend
rally onboard company/shared-lib
```

## Dashboard with Multiple Projects

When you have multiple projects, the dashboard groups dispatches by project:

```
Rally Dashboard

 Issue/PR                                Status               Changes   Age
alice/frontend
❯ Issue #42  Fix login timeout           ⏳ copilot working              5m

bob/backend
  Issue #15  Add rate limiting           🔵 implementing                12m
  PR #38     Refactor auth module        🟡 ready for review   +85 -12  23m

company/shared-lib
  PR #101    Update types                ✅ done               +12 -3   1d

4 active · 1 done · 0 orphaned
```

## Dispatching to Specific Projects

When you press `n` in the dashboard with multiple projects:

1. Rally shows a project picker
2. Select the project
3. Choose Issue or PR
4. Enter the number

From CLI:

```bash
rally dispatch issue 42 --project frontend
rally dispatch pr 99 --project backend
```

## Project Isolation

Each project maintains separate:
- Worktrees (in `project/.worktrees/`)
- Dispatch tracking (in `~/rally/active/`)
- Team configuration (symlinked to project)

## Cleaning Across Projects

```bash
rally clean --all           # Cleans all done dispatches across all projects
rally clean                  # Interactive cleanup with project grouping
```

## Best Practices

1. **Use descriptive project names** — Rally uses the repo name by default
2. **Clean regularly** — Use `rally clean` to remove merged dispatches
3. **Check status** — `rally status` shows all projects at a glance

## Related

- [Onboarding Projects](/rally/guides/onboarding/)
- [Fork Workflow](/rally/workflows/fork/)
