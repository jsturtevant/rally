---
setup: node setup-squad.js
---

# Onboard via Clone

Tests `rally onboard owner/repo` and URL forms where Rally itself clones the repository.
Squad is pre-created by setup script. No `clone:` — Rally does the cloning.

## Clone and onboard an owner/repository reference

```markmason
rally onboard jsturtevant/rally-test-fixtures --team default
```

Onboards by cloning via owner/repo shorthand. Rally clones to projects dir.

```expected
⬇ Cloning https://github.com/jsturtevant/rally-test-fixtures.git → $RALLY_HOME/projects/rally-test-fixtures
✓ Cloned jsturtevant/rally-test-fixtures
✓ Updated .git/info/exclude
✓ Registered project: rally-test-fixtures
```

## Check the cloned Git repository

```markmason
ls $RALLY_HOME/projects/rally-test-fixtures/.git/info/exclude
```

Verify the cloned project directory actually exists and has a git repo.

```expected
$RALLY_HOME/projects/rally-test-fixtures/.git/info/exclude
```

## Show the cloned project in status

```markmason
rally status
```

After clone-onboard, status should show the project.

```expected
Rally Status
============

Config Paths:
  ✓ config: $RALLY_HOME/config.yaml
  ✓ projects: $RALLY_HOME/projects.yaml
  ✗ active: $RALLY_HOME/active.yaml

Directories:
  configDir:     $RALLY_HOME
  personalSquad: $XDG_CONFIG_HOME/squad/personal-squad
  projectsDir:   $RALLY_HOME/projects

Onboarded Projects (1):
  - rally-test-fixtures: $RALLY_HOME/projects/rally-test-fixtures

Active Dispatches (0):
  (none)
```

## Onboard the same repository again

```markmason
rally onboard jsturtevant/rally-test-fixtures --team default
```

Re-onboard same repo — clone target exists, project already registered.

```expected
  Clone target already exists — skipping clone: $RALLY_HOME/projects/rally-test-fixtures
✓ Updated .git/info/exclude
  Project already registered — skipping
```

## Remove the project registered by shorthand

```markmason
rally onboard remove rally-test-fixtures --yes
```

Clean up the owner/repo onboard.

```expected
✓ Removed project: rally-test-fixtures (jsturtevant/rally-test-fixtures)
```

## Onboard the existing checkout by HTTPS URL

```markmason
rally onboard https://github.com/jsturtevant/rally-test-fixtures --team default
```

Onboards via full HTTPS URL. Clone target still exists on disk, so clone is skipped.

```expected
  Clone target already exists — skipping clone: $RALLY_HOME/projects/rally-test-fixtures
✓ Updated .git/info/exclude
✓ Registered project: rally-test-fixtures
```

## Remove the project registered by URL

```markmason
rally onboard remove rally-test-fixtures --yes
```

Clean up after URL onboard.

```expected
✓ Removed project: rally-test-fixtures (jsturtevant/rally-test-fixtures)
```
