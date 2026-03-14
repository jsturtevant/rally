---
setup: setup-squad.js
---

# Onboard with Fork Auto-discovery

Tests `rally onboard --fork owner/repo` without an explicit path.
The --fork value is treated as the upstream repo to clone, then the user's
fork is auto-discovered via `gh api user`.
Squad is pre-created by setup script.

## `rally onboard --fork jsturtevant/rally-test-fixtures --team default`

Fork without path — clones the upstream repo, then auto-discovers the user's
GitHub username to configure fork remotes.

```expected
⬇ Cloning https://github.com/jsturtevant/rally-test-fixtures.git → $RALLY_HOME/projects/rally-test-fixtures
✓ Cloned jsturtevant/rally-test-fixtures
✓ Renamed origin → upstream
✓ Added origin → https://github.com/jsturtevant/rally-test-fixtures.git
✓ Updated .git/info/exclude
✓ Registered project: rally-test-fixtures
```

## `git -C $RALLY_HOME/projects/rally-test-fixtures remote get-url origin`

Verify origin points to the auto-discovered fork.

```expected
https://github.com/jsturtevant/rally-test-fixtures.git
```

## `git -C $RALLY_HOME/projects/rally-test-fixtures remote get-url upstream`

Verify upstream points to the original repo.

```expected
https://github.com/jsturtevant/rally-test-fixtures.git
```

## `rally onboard remove rally-test-fixtures --yes`

Clean up.

```expected
✓ Removed project: rally-test-fixtures (jsturtevant/rally-test-fixtures)
```
