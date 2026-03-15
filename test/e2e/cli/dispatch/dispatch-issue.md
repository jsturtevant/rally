---
clone: jsturtevant/rally-test-fixtures
setup: setup-dispatch.js
---

# Dispatch Issue E2E Test

Real end-to-end dispatch to issue #1 on the test fixtures repo. Onboards the
cloned repo, dispatches to the issue (creates worktree, branch, context, launches
Copilot), verifies the dispatch appears in dashboard and sessions, then cleans up.

## `rally onboard . --team default`

Onboard the cloned fixtures repo so dispatch can find it.

```expected
✓ Updated .git/info/exclude
✓ Registered project: $PROJECT_NAME
```

## `rally dispatch issue 1 --repo jsturtevant/rally-test-fixtures --trust`

Dispatch to issue #1. Creates worktree, branch, dispatch-context.md, and
launches Copilot.

## `rally dashboard --json`

Dashboard JSON should show the dispatch for issue #1.

## `rally dispatch sessions`

Sessions should list the dispatch.

## `rally dispatch clean --all --yes`

Clean up all dispatches (removes worktree and branch).

## `rally dashboard --json`

After cleanup, no dispatches should remain.

```expected
{
  "dispatches": [],
  "onboardedProjects": [
    "jsturtevant/rally-test-fixtures"
  ]
}
```
