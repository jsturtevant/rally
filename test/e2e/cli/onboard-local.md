---
repo: local
---

# Onboard Integration Tests

Tests for `rally onboard` commands that require a real git repository.

## `rally onboard . --team default`

Onboards the current directory with explicit team name.

```expected
✓ Updated .git/info/exclude
```

## `rally status`

After onboarding, status should show 1 project.

```expected
Rally Status
============

Config Paths:

Onboarded Projects (1):
```
