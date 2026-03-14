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

Removing a project when no projects are onboarded at all.

```expected
Error: No onboarded projects found.
```

## `rally onboard --fork badformat .` (exit 2)

Invalid fork format — must be owner/repo.

```expected
Error: Invalid --fork format: "badformat". Expected owner/repo (e.g. myuser/myrepo).
```

## `rally onboard nonexistent-user-abc123/nonexistent-repo-xyz789 --team default` (exit 2)

Cloning a repo that doesn't exist should fail with a clone error.
