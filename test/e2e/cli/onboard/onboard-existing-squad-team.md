---
repo: local
setup: setup-squad.js
---

# Onboard with Pre-existing Squad

Tests `rally onboard .` (no `--team` flag) when the personal squad already exists.
Squad is created by the setup script before tests run — no interactive prompts needed.

## `rally onboard . --team default`

Onboards with explicit team name. Squad already exists so no creation prompt.

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

## `rally onboard . --team default`

Re-onboarding the same repo should be idempotent.

```expected
✓ Updated .git/info/exclude
  Project already registered — skipping
```

## `rally onboard remove nonexistent --yes` (exit 1)

Removing a project name that doesn't match any onboarded project.

```expected
Error: Project "nonexistent" not found. Run rally onboard remove to see available projects.
```

## `rally onboard remove $PROJECT_NAME --yes`

Removes the project without interactive prompt.

```expected
✓ Removed project: $PROJECT_NAME (jsturtevant/rally-test-fixtures)
```

## `rally status`

After removing, status should show 0 projects.

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

Onboarded Projects (0):
  (none)

Active Dispatches (0):
  (none)
```
