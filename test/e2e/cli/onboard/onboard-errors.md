# Onboard Error Tests

Tests for error cases — bad paths, missing projects, non-git directories.
No repo setup needed since we're testing failure modes.

## `rally onboard /tmp/nonexistent-path --team default` (exit 2)

Onboarding a path that doesn't exist should fail with a clear error.

```contains
Error: Not a git repository. Run from inside a repo or provide a path to one.
```

## `rally onboard remove nonexistent --yes` (exit 1)

Removing a project that was never onboarded should fail.

```contains
Error: No onboarded projects found.
```
