---
clone: jsturtevant/rally-test-fixtures
setup: ../dashboard/setup-squad.js
---

# Dispatch Refresh E2E Test

Verifies `rally dispatch refresh` reports a clean result when the project is
onboarded but has no active dispatches.

## `rally onboard . --team default`

Onboard the cloned fixtures repo so `dispatch refresh` runs in a real project
context.

```expected
✓ Updated .git/info/exclude
✓ Registered project: $PROJECT_NAME
```

## `rally dispatch refresh`

With no active dispatches, refresh should report that everything is already up
to date.

```expected
All dispatch statuses are up to date.
```
