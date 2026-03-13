---
clone: jsturtevant/rally-test-fixtures
---

# Interactive Onboard Tests

Tests for `rally onboard .` without `--team` flag — exercises the interactive squad creation flow via PTY.

## `rally onboard .`

Onboards the current directory. Without `--team`, triggers interactive squad creation
(since no personal squad exists yet). The PTY steps answer the prompts automatically.

```pty
match: Would you like to create one now?
send: y

match: What kind of team do you need?
send: {enter}
```

```expected
✓ Updated .git/info/exclude
✓ Registered project: $PROJECT_NAME
```

## `rally status`

After interactive onboard, status should show 1 project and the squad.

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
