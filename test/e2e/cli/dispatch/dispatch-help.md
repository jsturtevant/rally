# Dispatch Help Tests

Verifies help output for dispatch and all subcommands.

## `rally dispatch --help`

```expected
Usage: rally dispatch [options] [command]

Dispatch Squad to a GitHub issue or PR

Options:
  -h, --help                   display help for command

Commands:
  issue [options] [number]     Dispatch Squad to a GitHub issue
  pr [options] [number]        Dispatch Squad to a GitHub PR review
  remove [options] <number>    Remove an active dispatch
  refresh                      Refresh dispatch statuses by checking if Copilot processes have exited
  log [options] <number>       View Copilot output log for a dispatch
  clean [options]              Clean done dispatches (remove worktrees and branches)
  continue [options] <number>  Reconnect to Copilot session for an active dispatch
  sessions                     List active dispatches with session info
```

## `rally dispatch issue --help`

```expected
Usage: rally dispatch issue [options] [number]

Dispatch Squad to a GitHub issue

Arguments:
  number               GitHub issue number (interactive picker if omitted)

Options:
  --repo <owner/repo>  Target repository (owner/repo)
  --repo-path <path>   Path to local repo clone
  --sandbox            Run Copilot inside a Docker sandbox microVM for host isolation
  --trust              Skip author/org trust warnings (for automation)
  -h, --help           display help for command
```

## `rally dispatch pr --help`

```expected
Usage: rally dispatch pr [options] [number]

Dispatch Squad to a GitHub PR review

Arguments:
  number               GitHub PR number (interactive picker if omitted)

Options:
  --repo <owner/repo>  Target repository (owner/repo)
  --repo-path <path>   Path to local repo clone
  --sandbox            Run Copilot inside a Docker sandbox microVM for host isolation
  --prompt <path>      Path to a custom review prompt file
  --trust              Skip author/org trust warnings (for automation)
  -h, --help           display help for command
```

## `rally dispatch clean --help`

```expected
Usage: rally dispatch clean [options]

Clean done dispatches (remove worktrees and branches)

Options:
  --all       Clean all dispatches, not just done ones
  --yes       Skip confirmation prompt for --all
  -h, --help  display help for command
```
