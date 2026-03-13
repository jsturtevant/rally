---
setup: setup-squad.js
---

# Onboard with Explicit Fork

Tests `rally onboard owner/repo --fork owner/repo` where an explicit fork is provided.
Squad is pre-created by setup script. Rally clones then configures fork remotes.

## `rally onboard jsturtevant/rally-test-fixtures --fork jsturtevant/rally-test-fixtures --team default`

Clone + explicit fork. Clones the repo, then configures remotes:
origin renamed to upstream, new origin set to fork URL.

```expected
⬇ Cloning https://github.com/jsturtevant/rally-test-fixtures.git → $RALLY_HOME/projects/rally-test-fixtures
✓ Cloned jsturtevant/rally-test-fixtures
✓ Renamed origin → upstream
✓ Added origin → https://github.com/jsturtevant/rally-test-fixtures.git
✓ Updated .git/info/exclude
✓ Registered project: rally-test-fixtures
```

## `rally onboard remove rally-test-fixtures --yes`

Clean up.

```expected
✓ Removed project: rally-test-fixtures (jsturtevant/rally-test-fixtures)
```
