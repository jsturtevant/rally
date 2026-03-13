# Onboard Error Tests

Tests for error cases — bad paths, missing projects, non-git directories.

## `rally status`

Triggers initial setup so subsequent error commands have clean output.

## `rally onboard /tmp/nonexistent-path --team default` (exit 2)

Onboarding a path that doesn't exist should fail with a clear error.

```expected
Error: Not a git repository. Run from inside a repo or provide a path to one.
```

## `rally onboard remove nonexistent --yes` (exit 1)

Removing a project that was never onboarded should fail.

```expected
Error: No onboarded projects found.
```
