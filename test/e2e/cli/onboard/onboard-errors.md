# Onboard Error Tests

Tests for error cases — bad paths, missing projects, non-git directories.

## Initialize an empty Rally environment

```markmason
rally status
```

Triggers initial setup so subsequent error commands have clean output.

## Reject a nonexistent local path

```markmason (exit 2)
rally onboard /tmp/nonexistent-path --team default
```

Onboarding a path that doesn't exist should fail with a clear error.

```expected
Error: Not a git repository. Run from inside a repo or provide a path to one.
```

## Reject removal when no projects exist

```markmason (exit 1)
rally onboard remove nonexistent --yes
```

Removing a project when no projects are onboarded at all.

```expected
Error: No onboarded projects found.
```

## Reject an invalid fork reference

```markmason (exit 2)
rally onboard --fork badformat .
```

Invalid fork format — must be owner/repo.

```expected
Error: Invalid --fork format: "badformat". Expected owner/repo (e.g. myuser/myrepo).
```

## Report a failed repository clone

```markmason (exit 2)
rally onboard nonexistent-user-abc123/nonexistent-repo-xyz789 --team default
```

Cloning a repo that doesn't exist should fail with a clone error.
