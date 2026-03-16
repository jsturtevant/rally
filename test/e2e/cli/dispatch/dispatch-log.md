---
clone: jsturtevant/rally-test-fixtures
setup: ../dashboard/setup-squad.js
timeout: 300
tags: [dispatch, slow]
---

# Dispatch Log E2E Test

Exercises `rally dispatch log` with a fast help check, a missing-dispatch error,
and a real end-to-end dispatch whose captured Copilot log is displayed before
cleanup.

## `rally dispatch log --help`

Shows dispatch log usage.

```expected
Usage: rally dispatch log [options] <number>

View Copilot output log for a dispatch

Arguments:
  number               Issue or PR number

Options:
  --repo <owner/repo>  Target repository (owner/repo)
  -f, --follow         Follow log output (tail -f style)
  -h, --help           display help for command
```

## `rally dispatch log 999` (exit 1)

No dispatch exists for issue #999, so the command should fail.

## `rally onboard . --team default`

Onboard the cloned fixtures repo so dispatch can find it.

```expected
✓ Updated .git/info/exclude
✓ Registered project: $PROJECT_NAME
```

## `rally dispatch issue 1 --repo jsturtevant/rally-test-fixtures --trust`

Dispatch issue #1 and launch Copilot with trust enabled.

```expected
Dispatched issue #1: [E2E Test] Dispatch issue test → $REPO_ROOT/.worktrees/rally-1
```

## `node ./wait-for-pid.js rally-test-fixtures-issue-1 240`

Wait for the Copilot PID to exit without refreshing dispatch status.

## `rally dispatch log 1 --repo jsturtevant/rally-test-fixtures | grep 'Total session time:'`

The Copilot log always ends with a summary block containing session time.
Grep for the completion marker to verify the log has real content.

```expected
Total session time:
```

## `rally dispatch clean --all --yes`

Clean up the worktree and active dispatch record.
