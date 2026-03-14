---
clone: jsturtevant/rally-test-fixtures
setup: setup-squad.js
---

# Onboard Interactive Remove — Decline

Tests declining the confirmation prompt during `rally onboard remove`.
Squad is pre-created by setup script. Local repo is cloned by runner.

## `rally onboard . --team default`

Onboard the local repo first so we have something to remove.

```expected
✓ Updated .git/info/exclude
✓ Registered project: $PROJECT_NAME
```

## `rally onboard remove`

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

## `grep $PROJECT_NAME $RALLY_HOME/projects.yaml`

After declining removal, the project should still be in projects.yaml.

```expected
  - name: $PROJECT_NAME
    path: $REPO_ROOT
```

## `rally onboard . --team default`

Re-onboard should show the project is still there (not removed).

```expected
✓ Updated .git/info/exclude
Project already registered — skipping
```
