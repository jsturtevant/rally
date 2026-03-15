---
clone: jsturtevant/rally-test-fixtures
setup: ../dashboard/setup-squad.js
timeout: 600
---

# Dispatch PR Review E2E Test

Real end-to-end dispatch to PR #3 on the test fixtures repo. Onboards the
cloned repo, dispatches a PR review (creates worktree, fetches PR head,
writes review context, launches Copilot), waits for Copilot to complete
the review, verifies REVIEW.md exists, then cleans up.

## `rally onboard . --team default`

Onboard the cloned fixtures repo.

```expected
✓ Updated .git/info/exclude
✓ Registered project: $PROJECT_NAME
```

## `rally dispatch pr 3 --repo jsturtevant/rally-test-fixtures --trust`

Dispatch PR review for PR #3. Creates worktree on PR head, writes
dispatch-context.md with PR details, launches Copilot for review.

```expected
Dispatched PR #3: [E2E Test] Sample PR for review dispatch → $REPO_ROOT/.worktrees/rally-pr-3
Review output → $REPO_ROOT/.worktrees/rally-pr-3/REVIEW.md
```

## `grep rally-test-fixtures-pr-3 $RALLY_HOME/active.yaml`

Verify the PR dispatch is registered with correct ID.

```expected
- id: rally-test-fixtures-pr-3
```

## `ls $REPO_ROOT/.worktrees/rally-pr-3/.squad/dispatch-context.md`

Dispatch-context.md should exist in the PR worktree.

```expected
$REPO_ROOT/.worktrees/rally-pr-3/.squad/dispatch-context.md
```

## `grep Sample $REPO_ROOT/.worktrees/rally-pr-3/.squad/dispatch-context.md`

Context file should reference the PR title.

## `node ./wait-for-dispatch.js rally-test-fixtures-pr-3 540`

Wait for Copilot to complete the review (polls dispatch refresh every 3s, up to 9 min).

## `ls $REPO_ROOT/.worktrees/rally-pr-3/REVIEW.md`

REVIEW.md should exist after Copilot completes.

```expected
$REPO_ROOT/.worktrees/rally-pr-3/REVIEW.md
```

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
