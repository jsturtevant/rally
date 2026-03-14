---
clone: jsturtevant/rally-test-fixtures
---

# Onboard Integration Tests

Tests for `rally onboard` commands that require a real git repository.
The first onboard creates the personal squad via interactive prompts (PTY).

## `rally onboard . --team default`

Onboards the current directory with explicit team name. Creates personal squad on first run.

```pty
match: Would you like to create one now?
send: y{enter}

match: What kind of team do you need?
send: {enter}
```

```expected
✓ Updated .git/info/exclude
✓ Registered project: $PROJECT_NAME
```

## `grep $PROJECT_NAME $RALLY_HOME/projects.yaml`

Verify the project was actually written to projects.yaml.

```expected
  - name: $PROJECT_NAME
    path: $REPO_ROOT
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

## `rally onboard remove $PROJECT_NAME --yes`

Removes the project without interactive prompt.

```expected
✓ Removed project: $PROJECT_NAME (jsturtevant/rally-test-fixtures)
```

## `grep $PROJECT_NAME $RALLY_HOME/projects.yaml` (exit 1)

After removal, the project should no longer appear in projects.yaml.

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
