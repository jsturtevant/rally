---
clone: jsturtevant/rally-test-fixtures
setup: setup-squad.js
---

# Onboard Fork Auto — Local Path

Tests `rally onboard --fork auto .` on an already-cloned repo.
Auto-discovery derives the fork from the GitHub username + repo name.

## `rally onboard --fork auto . --team default`

Fork auto on local path — should discover the user's fork automatically.
Since the repo owner is the same user, origin/upstream both point to the same URL.

```expected
✓ Renamed origin → upstream
✓ Added origin → https://github.com/jsturtevant/rally-test-fixtures.git
✓ Updated .git/info/exclude
✓ Registered project: $PROJECT_NAME
```

## `git -C $REPO_ROOT remote get-url origin`

Origin should now point to the user's fork.

```expected
https://github.com/jsturtevant/rally-test-fixtures.git
```

## `git -C $REPO_ROOT remote get-url upstream`

Upstream should point to the original repo (preserved from original clone).

```expected
git@github.com:jsturtevant/rally-test-fixtures.git
```
