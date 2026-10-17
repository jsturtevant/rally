---
clone: jsturtevant/rally-test-fixtures
setup: node setup-squad.js
---

# Onboard Interactive Remove

Tests `rally onboard remove` without --yes flag (interactive confirmation via PTY).
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

## Select and confirm removal interactively

```markmason
rally onboard remove
```

Interactive remove — select the project from the picker, then confirm.

```pty
match: Select a project to remove
send: {enter}
match: from Rally
send: y{enter}
```

```expected
✓ Removed project: $PROJECT_NAME (jsturtevant/rally-test-fixtures)
```
