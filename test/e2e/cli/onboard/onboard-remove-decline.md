---
clone: jsturtevant/rally-test-fixtures
setup: node setup-squad.js
---

# Onboard Interactive Remove — Decline

Tests declining the confirmation prompt during `rally onboard remove`.
Squad is pre-created by setup script. Local repo is cloned by runner.

## Onboard a project before testing removal

```markmason
rally onboard . --team default
```

Onboard the local repo first so we have something to remove.

```expected
✓ Updated .git/info/exclude
✓ Registered project: $PROJECT_NAME
```

## Decline removal in the interactive picker

```markmason
rally onboard remove
```

Interactive remove — select the project from the picker, then decline the confirmation.

```pty
match: Select a project to remove
send: {enter}
match: from Rally
send: n{enter}
```

```expected
Cancelled.
```

## Confirm the project remains registered

```markmason
grep $PROJECT_NAME $RALLY_HOME/projects.yaml
```

After declining removal, the project should still be in projects.yaml.

```expected
  - name: $PROJECT_NAME
    path: $REPO_ROOT
```

## Confirm onboarding still finds the project

```markmason
rally onboard . --team default
```

Re-onboard should show the project is still there (not removed).

```expected
✓ Updated .git/info/exclude
Project already registered — skipping
```
