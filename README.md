# Rally <sub>your</sub> [Squad](https://bradygaster.github.io/squad/)

CLI tool for dispatching AI coding agents (Squad teams) to GitHub issues via git worktrees.

## Why Rally?

Rally is for individual developers using [Squad](https://bradygaster.github.io/squad/) on shared repos — solo devs, open source maintainers, or anyone on a codebase where committing `.squad/` files isn't appropriate. It automates the full Squad workflow — from GitHub issues to pull requests — without polluting your repository, eliminating ~15 manual steps: creating branches, setting up worktrees, symlinking Squad state, and managing multiple parallel dispatches.

<img src="https://github.com/user-attachments/assets/0dfda827-17c7-4a8e-8adb-6a6474faa43b">

## Requirements

- Node.js >= 20.0.0
- [git](https://git-scm.com/)
- [GitHub CLI (`gh`)](https://cli.github.com/)

## Installation

Run directly with npx from GitHub:

```bash
npx github:jsturtevant/rally
```

Or install globally:

```bash
npm install -g github:jsturtevant/rally
rally
```

For a specific version, pin to a tag:

```bash
npx github:jsturtevant/rally#v0.1.0
```

## Quick Start

```bash
rally setup              # Configure team directory
rally onboard <url>      # Clone and set up a repository
rally dispatch issue 42  # Dispatch Squad to an issue
rally dispatch pr 10     # Dispatch Squad to a PR review
rally dashboard          # View active dispatches
rally dashboard clean    # Remove completed dispatches
```

### Docker Sandbox (Optional)

For enhanced isolation, Rally can run Copilot inside a [Docker sandbox](https://docs.docker.com/ai/sandboxes/agents/copilot/) microVM:

- [Docker Desktop 4.58+](https://www.docker.com/products/docker-desktop/) with sandbox support
- `GH_TOKEN` or `GITHUB_TOKEN` set globally in shell config
- Docker Desktop restarted after setting the token

Use `--sandbox` with dispatch commands:
```bash
rally dispatch issue 42 --sandbox
rally dispatch pr 10 --sandbox
```

## Commands

### `rally setup`

Initialize Squad team state and Rally directories.

```
$ rally setup [options]

Initialize Squad team state and Rally directories

Options:
  --dir <path>  Where to create external team state
  -h, --help    display help for command
```

### `rally onboard`

Onboard a repo to Rally (local path, GitHub URL, or owner/repo).

```
$ rally onboard [options] [path]

Onboard a repo to Rally (local path, GitHub URL, or owner/repo)

Arguments:
  path              Path, GitHub URL, or owner/repo (defaults to current directory)

Options:
  --team <name>     Use a named team (skips interactive prompt)
  -h, --help        display help for command
```

### `rally status`

Show Rally configuration and active dispatches for debugging.

```
$ rally status [options]

Show Rally configuration and active dispatches for debugging

Options:
  --json       Output as JSON
  -h, --help   display help for command
```

### `rally dashboard`

Show active dispatch dashboard. Supports interactive (TTY) and plain-text (piped) output.

```
$ rally dashboard [options]

Show active dispatch dashboard

Options:
  --json              Output as JSON instead of interactive UI
  --project <name>    Filter by project (repo name)
  -h, --help          display help for command
```

**Keyboard shortcuts (interactive mode):** ↑/↓ navigate, Enter select, r refresh, q quit.

### `rally dispatch issue`

Dispatch Squad to a GitHub issue. Creates a worktree, symlinks Squad, writes context, and launches Copilot CLI.

```
$ rally dispatch issue [options] <number>

Dispatch Squad to a GitHub issue

Arguments:
  number                 GitHub issue number

Options:
  --repo <owner/repo>    Target repository (owner/repo)
  --repo-path <path>     Path to local repo clone
  --team-dir <path>      Path to custom squad directory
  -h, --help             display help for command
```

### `rally dispatch pr`

Dispatch Squad to a GitHub PR review. Creates a worktree checked out to the PR head, symlinks Squad, and launches Copilot CLI.

```
$ rally dispatch pr [options] <number>

Dispatch Squad to a GitHub PR review

Arguments:
  number                 GitHub PR number

Options:
  --repo <owner/repo>    Target repository (owner/repo)
  --repo-path <path>     Path to local repo clone
  --team-dir <path>      Path to custom squad directory
  -h, --help             display help for command
```

### `rally dispatch remove`

Remove an active dispatch.

```
$ rally dispatch remove [options] <number>

Remove an active dispatch

Arguments:
  number               Issue or PR number

Options:
  --repo <owner/repo>  Target repository (owner/repo)
  -h, --help           display help for command
```

### `rally dispatch log`

View Copilot output log for a dispatch.

```
$ rally dispatch log [options] <number>

View Copilot output log for a dispatch

Arguments:
  number               Issue or PR number

Options:
  --repo <owner/repo>  Target repository (owner/repo)
  -f, --follow         Follow log output (tail -f style)
  -h, --help           display help for command
```

### `rally dispatch clean`

Clean done dispatches (remove worktrees and branches).

```
$ rally dispatch clean [options]

Clean done dispatches (remove worktrees and branches)

Options:
  --all       Clean all dispatches, not just done ones
  --yes       Skip confirmation prompt for --all
  -h, --help  display help for command
```

### `rally dispatch refresh`

Refresh dispatch statuses by checking if Copilot processes have exited.

```
$ rally dispatch refresh [options]

Refresh dispatch statuses by checking if Copilot processes have exited

Options:
  -h, --help  display help for command
```

## Future Work

- **Smart worktree cleanup:** Automatic removal of completed worktrees and branches after PR merge
- **Team templates:** Pre-configured team setups for common tech stacks (Node, Python, Go, etc.)
- **PR creation automation:** Auto-create pull requests after Squad completes implementation
- **Advanced team configuration:** Team overlays, partial sharing, and team migration between projects
- **Team snapshots:** Export/import team state for bootstrapping from templates

## License

See [package.json](package.json) for details.
