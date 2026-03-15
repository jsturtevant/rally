---
clone: jsturtevant/rally-test-fixtures
setup: ../dashboard/setup-squad.js
timeout: 300
---

# Dispatch Refresh E2E Test

Exercises `rally dispatch refresh` first with zero active dispatches, then with a
real issue dispatch whose Copilot PID has already exited. The key assertion is
that the status stays `implementing` until `rally dispatch refresh` runs.

## `rally onboard . --team default`

Onboard the cloned fixtures repo so dispatch can find it.

```expected
✓ Updated .git/info/exclude
✓ Registered project: $PROJECT_NAME
```

## `rally dispatch refresh`

With no active dispatches yet, refresh should report that everything is already
up to date.

```expected
All dispatch statuses are up to date.
```

## `rally dispatch issue 1 --repo jsturtevant/rally-test-fixtures --trust`

Dispatch issue #1 and launch Copilot with trust enabled.

```expected
Dispatched issue #1: [E2E Test] Dispatch issue test → $REPO_ROOT/.worktrees/rally-1
```

## `grep status: $RALLY_HOME/active.yaml`

Verify the real dispatch is active and currently implementing.

```expected
status: implementing
```

## `node ./wait-for-pid.js rally-test-fixtures-issue-1 240`

Wait for the Copilot PID to exit without running `rally dispatch refresh`.

## `grep status: $RALLY_HOME/active.yaml`

Even after the PID exits, the dispatch should still be marked implementing until
refresh runs.

```expected
status: implementing
```

## `sleep 31`

Give the log activity window time to expire without refreshing the dispatch.

## `rally dispatch refresh`

Now run the command under test to update the dispatch status.

## `grep status: $RALLY_HOME/active.yaml`

After refresh runs, the dispatch should no longer be implementing.

```expected
status: reviewing
```

## `rally dispatch clean --all --yes`

Clean up the worktree and dispatch record.
