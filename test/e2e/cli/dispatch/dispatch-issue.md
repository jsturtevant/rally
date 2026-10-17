---
clone: jsturtevant/rally-test-fixtures
setup: node ../dashboard/setup-squad.js
tags: [dispatch, slow]
---

# Dispatch Issue E2E Test

Real end-to-end dispatch to issue #1 on the test fixtures repo. Onboards the
cloned repo, dispatches to the issue (creates worktree, branch, context, launches
Copilot), verifies the dispatch appears in dashboard and sessions, then cleans up.

## Onboard the dispatch target

```markmason
rally onboard . --team default
```

Onboard the cloned fixtures repo so dispatch can find it.

```expected
✓ Updated .git/info/exclude
✓ Registered project: $PROJECT_NAME
```

## Dispatch an agent to the fixture issue

```markmason
rally dispatch issue 1 --repo jsturtevant/rally-test-fixtures --trust
```

Dispatch to issue #1. Creates worktree, branch, dispatch-context.md, and
launches Copilot.

```expected
Dispatched issue #1: [E2E Test] Dispatch issue test → $REPO_ROOT/.worktrees/rally-1
```

## Check the recorded dispatch identifier

```markmason
grep rally-test-fixtures-issue-1 $RALLY_HOME/active.yaml
```

Verify the dispatch is registered in active.yaml with correct ID.

```expected
- id: rally-test-fixtures-issue-1
```

## Check that the dispatch is implementing

```markmason
grep implementing $RALLY_HOME/active.yaml
```

```expected
status: implementing
```

## Check that dispatch context was written

```markmason
ls $REPO_ROOT/.worktrees/rally-1/.squad/dispatch-context.md
```

Dispatch-context.md should exist in the worktree.

```expected
$REPO_ROOT/.worktrees/rally-1/.squad/dispatch-context.md
```

## Check that context describes the issue

```markmason
grep Dispatch $REPO_ROOT/.worktrees/rally-1/.squad/dispatch-context.md
```

Context file should reference the issue.

## Check that the worktree has Git metadata

```markmason
ls $REPO_ROOT/.worktrees/rally-1/.git
```

Worktree should be a real git worktree (has .git file).

```expected
$REPO_ROOT/.worktrees/rally-1/.git
```

## List the dispatch session

```markmason
rally dispatch sessions
```

Sessions should list the dispatch.

## Clean up the dispatch and worktree

```markmason
rally dispatch clean --all --yes
```

Clean up all dispatches (removes worktree and branch).

## Confirm cleanup removed the dispatch

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
