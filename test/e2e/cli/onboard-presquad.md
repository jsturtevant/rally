---
repo: local
setup: setup-squad.js
---

# Onboard without --team flag (squad pre-exists)

Tests `rally onboard .` without `--team` when the personal squad already exists.
No interactive prompts — squad is found automatically.

## `rally onboard .`

Onboards without specifying a team. Squad already exists so no creation prompt.

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
  personalSquad: $XDG_CONFIG_HOME/squad/.squad
  projectsDir:   $RALLY_HOME/projects

Onboarded Projects (1):
  - $PROJECT_NAME: $REPO_ROOT

Active Dispatches (0):
  (none)
```

## `rally onboard remove $PROJECT_NAME --yes`

Removes the project.

```expected
✓ Removed project: $PROJECT_NAME (jsturtevant/rally-test-fixtures)
```
