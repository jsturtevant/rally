---
clone: jsturtevant/rally-test-fixtures
---

# Interactive Dashboard Test

Exercises the full interactive flow: `rally dashboard` triggers squad creation on first run
(no personal squad exists), then the Ink TUI launches. We quit the TUI, onboard the repo,
and verify it appears in dashboard JSON.

## `rally dashboard`

Triggers interactive squad creation, then the Ink TUI. Press q to quit after it renders.

```pty
match: Would you like to create one now?
send: y{enter}

match: What kind of team do you need?
send: {enter}

match: Squad created
send: q
```

## `rally onboard . --team default`

Now that squad exists from the dashboard flow, onboard the cloned repo.

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
