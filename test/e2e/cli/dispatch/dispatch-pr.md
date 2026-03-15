---
clone: jsturtevant/rally-test-fixtures
setup: setup-dispatch.js
---

# Dispatch PR Review E2E Test

Real end-to-end dispatch to PR #3 on the test fixtures repo. Onboards the
cloned repo, dispatches a PR review (creates worktree, fetches PR head,
writes review context, launches Copilot), verifies via dashboard, then cleans up.

## `rally onboard . --team default`

Onboard the cloned fixtures repo.

```expected
✓ Updated .git/info/exclude
✓ Registered project: $PROJECT_NAME
```

## `rally dispatch pr 3 --repo jsturtevant/rally-test-fixtures --trust`

Dispatch PR review for PR #3. Creates worktree on PR head, writes
dispatch-context.md with PR details, launches Copilot for review.

## `rally dashboard --json`

Dashboard JSON should show the PR dispatch.

## `rally dispatch clean --all --yes`

Clean up all dispatches.

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
