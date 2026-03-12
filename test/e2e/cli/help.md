# Help and Version Tests

Tests for basic CLI help and version commands. These don't require any repo setup.

## `rally --help`

Shows all available commands and global options.

```expected
Usage: rally [options] [command]

Dispatch Squad teams to GitHub issues and PR reviews via git worktrees

Options:
  -V, --version             output the version number
  -h, --help                display help for command

Commands:
  onboard [options] [path]  Onboard a repo to Rally (local path, GitHub URL, or owner/repo)
  status [options]          Show Rally configuration and active dispatches for debugging
  dashboard [options]       Show active dispatch dashboard
  dispatch                  Dispatch Squad to a GitHub issue or PR
  help [command]            display help for command
```

## `rally --version`

Prints the installed version number.

```expected
0.1.0
```

## `rally bad-command` (exit 1)

Smoke test for non-zero exits without an expected output block.
