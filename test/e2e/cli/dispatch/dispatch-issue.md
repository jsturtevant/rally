---
clone: jsturtevant/rally-test-fixtures
setup: ../dashboard/setup-squad.js
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

```expected
Dispatched issue #1: [E2E Test] Dispatch issue test → $REPO_ROOT/.worktrees/rally-1
```

## `grep rally-test-fixtures-issue-1 $RALLY_HOME/active.yaml`

Verify the dispatch is registered in active.yaml with correct ID.

```expected
- id: rally-test-fixtures-issue-1
```

## `grep implementing $RALLY_HOME/active.yaml`

```expected
status: implementing
```

## `ls $REPO_ROOT/.worktrees/rally-1/.squad/dispatch-context.md`

Dispatch-context.md should exist in the worktree.

```expected
$REPO_ROOT/.worktrees/rally-1/.squad/dispatch-context.md
```

## `grep Dispatch $REPO_ROOT/.worktrees/rally-1/.squad/dispatch-context.md`

Context file should reference the issue.

## `ls $REPO_ROOT/.worktrees/rally-1/.git`

Worktree should be a real git worktree (has .git file).

```expected
$REPO_ROOT/.worktrees/rally-1/.git
```

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
