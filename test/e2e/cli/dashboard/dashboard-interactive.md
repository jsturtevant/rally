---
clone: jsturtevant/rally-test-fixtures
---

# Interactive Dashboard Squad Creation Test

Verifies that squad creation works via the interactive flow (PTY prompts), then
confirms the dashboard reflects the onboarded project. Uses `rally onboard .`
to trigger squad creation since the Ink TUI's fullscreen rendering makes PTY
matching unreliable in CI.

## `rally onboard .`

Without `--team`, triggers interactive squad creation (no squad exists yet).

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

## `rally dashboard --json`

Dashboard JSON should list the onboarded project after interactive squad creation.

```expected
{
  "dispatches": [],
  "onboardedProjects": [
    "jsturtevant/rally-test-fixtures"
  ]
}
```
