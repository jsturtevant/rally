---
repo: local
---

# Onboard Integration Tests

Tests for `rally onboard` commands that require a real git repository.

## `rally onboard . --team default`

Onboards the current directory with explicit team name.

```expected
✓ Updated .git/info/exclude
✓ Registered project: $PROJECT_NAME
```

## `rally status`

After onboarding, status should show 1 project.

```expected
Rally Status
============

Config Paths:
  ✓ config: $RALLY_HOME/config.yaml
  ✓ projects: $RALLY_HOME/projects.yaml
  ✗ active: $RALLY_HOME/active.yaml

Directories:
  configDir:     $RALLY_HOME
  personalSquad: $HOME/.config/squad/.squad
  projectsDir:   $RALLY_HOME/projects

Onboarded Projects (1):
  - $PROJECT_NAME: $REPO_ROOT

Active Dispatches (0):
  (none)
```
