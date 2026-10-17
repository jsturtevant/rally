---
clone: jsturtevant/rally-test-fixtures
setup: node ../dashboard/setup-squad.js
tags: [dispatch, slow]
timeout: 600
---

# Dispatch PR Review E2E Test

Real end-to-end dispatch to PR #3 on the test fixtures repo. Onboards the
cloned repo, dispatches a PR review (creates worktree, fetches PR head,
writes review context, launches Copilot), waits for Copilot to complete
the review, verifies REVIEW.md exists, then cleans up.

## Onboard the pull request repository

```markmason
rally onboard . --team default
```

Onboard the cloned fixtures repo.

```expected
✓ Updated .git/info/exclude
✓ Registered project: $PROJECT_NAME
```

## Dispatch a review of the fixture pull request

```markmason
rally dispatch pr 3 --repo jsturtevant/rally-test-fixtures --trust
```

Dispatch PR review for PR #3. Creates worktree on PR head, writes
dispatch-context.md with PR details, launches Copilot for review.

```expected
Dispatched PR #3: [E2E Test] Sample PR for review dispatch → $REPO_ROOT/.worktrees/rally-pr-3
Review output → $REPO_ROOT/.worktrees/rally-pr-3/REVIEW.md
```

## Check the recorded review identifier

```markmason
grep rally-test-fixtures-pr-3 $RALLY_HOME/active.yaml
```

Verify the PR dispatch is registered with correct ID.

```expected
- id: rally-test-fixtures-pr-3
```

## Check that review context was written

```markmason
ls $REPO_ROOT/.worktrees/rally-pr-3/.squad/dispatch-context.md
```

Dispatch-context.md should exist in the PR worktree.

```expected
$REPO_ROOT/.worktrees/rally-pr-3/.squad/dispatch-context.md
```

## Check that context includes the pull request title

```markmason
grep Sample $REPO_ROOT/.worktrees/rally-pr-3/.squad/dispatch-context.md
```

Context file should reference the PR title.

## Wait for the review file and completed dispatch

```markmason
node ./wait-for-dispatch.js rally-test-fixtures-pr-3 540 --expect-file $REPO_ROOT/.worktrees/rally-pr-3/REVIEW.md
```

Wait for Copilot to complete the review (polls every 3s, up to 9 min).
Also waits for REVIEW.md to exist — on Windows, gh.exe exits before the
copilot child process finishes writing.

## Verify the generated review

```markmason
node ./check-review.js $REPO_ROOT/.worktrees/rally-pr-3/REVIEW.md
```

REVIEW.md must exist after Copilot completes the review.

```expected
$REPO_ROOT/.worktrees/rally-pr-3/REVIEW.md
```

## Clean up the review dispatch

```markmason
rally dispatch clean --all --yes
```

Clean up all dispatches.

## Confirm cleanup removed the review dispatch

```markmason
rally dashboard --json
```

After cleanup, no dispatches should remain.

```expected
{
  "dispatches": [],
  "onboardedProjects": [
    "jsturtevant/rally-test-fixtures"
  ]
}
```
