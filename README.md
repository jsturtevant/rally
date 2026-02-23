# Rally

CLI tool for dispatching AI coding agents (Squad teams) to GitHub issues via git worktrees.

## Requirements

- Node.js >= 20.0.0
- [git](https://git-scm.com/)
- [GitHub CLI (`gh`)](https://cli.github.com/)

## Installation

```bash
npm install -g rally-cli
```

Or run directly with npx:

```bash
npx rally
```

## Quick Start

```bash
rally setup              # Configure team directory
rally onboard <url>      # Clone and set up a repository
rally dispatch <issue#>  # Create worktree + launch Copilot CLI
rally dashboard          # View active dispatches
rally clean              # Remove completed dispatches
```

## Commands

### `rally setup`

Initialize Squad team state and Rally directories.

```
$ rally setup --help
Usage: rally setup [options]

Initialize Squad team state and Rally directories

Options:
  --dir <path>  Where to create external team state
  -h, --help    display help for command
```

### `rally onboard`

Onboard a repo to Rally (local path, GitHub URL, or owner/repo).

```
$ rally onboard --help
Usage: rally onboard [options] [path]

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
$ rally status --help
Usage: rally status [options]

Show Rally configuration and active dispatches for debugging

Options:
  --json       Output as JSON
  -h, --help   display help for command
```

### `rally dashboard`

Show active dispatch dashboard. Supports interactive (TTY) and plain-text (piped) output.

```
$ rally dashboard --help
Usage: rally dashboard [options]

Show active dispatch dashboard

Options:
  --json              Output as JSON instead of interactive UI
  --project <name>    Filter by project (repo name)
  -h, --help          display help for command
```

**Keyboard shortcuts (interactive mode):** ↑/↓ navigate, Enter select, r refresh, q quit.

## License

See [package.json](package.json) for details.
