---
name: rally
description: Guide for using the Rally CLI tool to dispatch AI agents to GitHub issues and PR reviews via git worktrees. Use this when working with Rally dispatches, the dashboard, or managing worktrees.
---

# Rally CLI

Rally is a CLI tool that dispatches AI agents (via GitHub Copilot CLI) to work on GitHub issues and PR reviews. It uses **git worktrees** to give each dispatch an isolated working copy and tracks all active work in a central state file.

## Prerequisites

- **Node.js** ≥ 20
- **git** — for worktree management
- **gh** (GitHub CLI) — for fetching issues/PRs and launching Copilot
- **gh copilot** extension — for AI agent sessions

Install Rally globally:

```bash
npm install -g github:jsturtevant/rally
```

Or run directly with npx:

```bash
npx github:jsturtevant/rally
```

For a specific version:

```bash
npx github:jsturtevant/rally#v0.1.0
```

## First-Time Setup

```bash
rally setup              # Creates ~/rally/ with team/, projects/, config.yaml
rally onboard <target>   # Register a repo (local path, GitHub URL, or owner/repo)
```

### Setup details

`rally setup` creates the Rally home directory (default `~/rally/`, override with `RALLY_HOME`):
- `~/rally/team/` — shared team configuration
- `~/rally/projects/` — cloned project repos
- `~/rally/config.yaml` — Rally configuration

### Onboarding a project

```bash
rally onboard .                          # Current directory
rally onboard /path/to/repo              # Local path
rally onboard owner/repo                 # GitHub shorthand (clones to ~/rally/projects/)
rally onboard https://github.com/o/r     # Full URL
rally onboard owner/repo --fork me/repo  # Fork workflow: origin→fork, upstream→main
rally onboard --team myteam              # Skip interactive team prompt
```

Onboarding symlinks team files (`.squad/`, `.squad-templates/`, `.github/agents/`) into the project, adds `.worktrees/` to `.git/info/exclude`, and registers the project in `projects.yaml`.

### Removing a project

```bash
rally onboard remove [project]   # Interactive picker if project omitted
rally onboard remove myrepo --yes  # Skip confirmation
```

## Dispatching Work

### Dispatch to an issue

```bash
rally dispatch issue 42                # Dispatch to issue #42
rally dispatch issue 42 --repo o/r     # Specify repo explicitly
rally dispatch issue                   # Interactive picker (choose repo, then issue)
rally dispatch issue 42 --sandbox      # Run in Docker sandbox microVM
rally dispatch issue 42 --trust        # Skip author trust warnings
```

What happens:
1. Fetches issue details via `gh issue view`
2. Creates branch `rally/<number>-<slug>` from current HEAD
3. Creates worktree at `<repo>/.worktrees/rally-<number>/`
4. Symlinks `.squad/` into the worktree
5. Writes `dispatch-context.md` with issue title, body, labels
6. Launches `gh copilot` with a prompt to read context and implement a fix
7. Registers the dispatch in `active.yaml`

### Dispatch to a PR (code review)

```bash
rally dispatch pr 15                   # Review PR #15
rally dispatch pr 15 --repo o/r        # Specify repo
rally dispatch pr                      # Interactive picker
rally dispatch pr 15 --prompt review.md  # Custom review prompt file
rally dispatch pr 15 --sandbox         # Docker sandbox
```

What happens:
1. Fetches PR details, validates it's open (not merged/closed)
2. Creates branch `rally/pr-<number>-<slug>`
3. Creates worktree at `<repo>/.worktrees/rally-pr-<number>/`
4. Fetches the PR head ref and resets the worktree to it
5. Writes `dispatch-context.md` with PR title, body, files changed
6. Launches Copilot with a multi-model review prompt
7. Review output goes to `REVIEW.md` in the worktree root

### Resume a dispatch

```bash
rally dispatch continue 42             # Reconnect to Copilot session for #42
rally dispatch continue 42 -m "focus on tests"  # Send additional instructions
rally dispatch continue 42 --repo o/r
```

### View dispatch logs

```bash
rally dispatch log 42                  # View Copilot output log for #42
rally dispatch log 42 -f               # Follow mode (tail)
rally dispatch log 42 --repo o/r
```

### Remove a dispatch

```bash
rally dispatch remove 42               # Remove dispatch record for #42
rally dispatch remove 42 --repo o/r
```

### Clean finished dispatches

```bash
rally dispatch clean                   # Clean done/reviewing/pushed/cleaned dispatches
rally dispatch clean --all             # Clean ALL dispatches (prompts for confirmation)
rally dispatch clean --all --yes       # Skip confirmation
```

Cleaning removes the worktree, deletes the local branch, and removes the record from `active.yaml`.

### Refresh statuses

```bash
rally dispatch refresh                 # Check if Copilot processes have exited, update statuses
```

### List sessions

```bash
rally dispatch sessions                # Show active dispatches with session info
```

## Dashboard

```bash
rally dashboard                        # Interactive full-screen TUI
rally dashboard --json                 # JSON output (for scripting)
rally dashboard --project myrepo       # Filter by project name
rally                                  # Default command opens dashboard
```

### Dashboard keyboard shortcuts

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate dispatch list |
| `Enter` | Open action menu for selected dispatch |
| `d` | View dispatch details |
| `v` | Open worktree in VS Code |
| `o` | Open issue/PR in browser |
| `a` | Attach to Copilot session (exits dashboard, runs `dispatch continue`) |
| `c` | Connect IDE — opens VS Code + bridges Copilot session |
| `l` | View Copilot output log |
| `n` | New dispatch — browse onboarded projects and pick an issue/PR |
| `u` | Mark selected dispatch as "upstream" |
| `x` | Delete selected dispatch |
| `r` | Refresh dashboard data |
| `q` | Quit |

The dashboard auto-refreshes every 5 seconds.

## Status Check

```bash
rally status                           # Show config and active dispatches
rally status --json                    # JSON output
```

## Dispatch Status Model

Each dispatch progresses through these statuses:

```
planning → implementing → reviewing → pushed → done → cleaned
```

| Status | Meaning |
|--------|---------|
| `planning` | Issue dispatch created, Copilot is analyzing the issue |
| `implementing` | Copilot is actively writing code |
| `reviewing` | PR review dispatch, Copilot is reviewing code |
| `pushed` | Changes have been pushed (manual status via dashboard `p` key) |
| `done` | Copilot session has exited |
| `cleaned` | Worktree and branch removed |

## Key Concepts

### Worktrees

Rally uses **git worktrees** to isolate each dispatch. Each dispatch gets its own directory under `<repo>/.worktrees/`:
- Issues: `.worktrees/rally-<number>/`
- PRs: `.worktrees/rally-pr-<number>/`

Worktrees share the same git history as the main repo but have independent working directories and branches.

### Configuration directory

Default: `~/rally/` (override with `RALLY_HOME` env var, legacy `~/.rally/` supported).

Contains:
- `config.yaml` — Rally settings (team dir, projects dir, version)
- `projects.yaml` — registered projects with name, repo, path, team info
- `active.yaml` — all active dispatch records
- `team/` — shared team configuration (`.squad/`, templates)
- `projects/` — cloned repos (when onboarded via URL)

### Config settings (`config.yaml` → `settings` key)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `docker_sandbox` | `always` / `never` / `ask` | `ask` | Docker sandbox usage |
| `require_trust` | `always` / `never` / `ask` | `ask` | Author/org trust checks |
| `review_template` | string or null | `null` | Custom review prompt path (relative to config dir) |
| `deny_tools_copilot` | string[] | DEFAULT_DENY_TOOLS | Tools denied without sandbox |
| `deny_tools_sandbox` | string[] | DEFAULT_DENY_TOOLS | Tools denied in sandbox |

CLI flags (`--sandbox`, `--trust`, `--prompt`) override config settings.

### active.yaml

Central state file tracking all dispatches. Each record contains:
- `id` — unique identifier (e.g. `myrepo-issue-42`)
- `repo` — `owner/repo`
- `number` — issue or PR number
- `type` — `issue` or `pr`
- `branch` — git branch name
- `worktreePath` — absolute path to the worktree
- `status` — current status (see status model above)
- `session_id` — Copilot session ID (or PID, or `pending`)
- `pid` — Copilot process ID
- `logPath` — path to `.copilot-output.log`
- `title` — issue/PR title
- `created` — ISO timestamp

### projects.yaml

Registry of onboarded projects. Each entry has:
- `name` — repository name
- `repo` — `owner/repo`
- `path` — absolute local path
- `team` — team type identifier
- `teamDir` — path to team directory
- `onboarded` — ISO timestamp
- `fork` — (optional) fork `owner/repo`

### Read-only dispatch policy

Dispatched Copilot agents run in **read-only mode**:
- CAN: read code, make local edits, run builds/tests, use git locally
- CANNOT: `git push`, run `gh` CLI commands, use `curl`/`wget`/`nc`/`ssh`
- Remote reads use MCP tools (e.g. `github-mcp-server-issue_read`)

### Repo resolution

When `--repo` is omitted, Rally resolves the target repo in this order:
1. `--repo owner/repo` flag
2. Current working directory (if inside an onboarded project)
3. Single-project fallback (if only one project is registered)
4. Error with list of registered projects

## Common Patterns

### Full issue workflow

```bash
rally setup                            # One-time setup
rally onboard owner/repo               # Register the repo
rally dispatch issue 42                # Dispatch agent to issue
rally dashboard                        # Monitor progress
rally dispatch log 42                  # Check agent output
rally dispatch continue 42             # Resume if needed
# Review changes in .worktrees/rally-42/
rally dispatch clean                   # Clean up when done
```

### PR review workflow

```bash
rally dispatch pr 15                   # Dispatch multi-model review
rally dispatch log 15                  # Check review progress
# Read REVIEW.md in .worktrees/rally-pr-15/
rally dispatch clean                   # Clean up
```

### Multi-project workflow

```bash
rally onboard owner/repo-a
rally onboard owner/repo-b
rally dispatch issue 10 --repo owner/repo-a
rally dispatch pr 5 --repo owner/repo-b
rally dashboard                        # See all dispatches across projects
```

### Fork workflow

```bash
rally onboard upstream/repo --fork myuser/repo
# origin → myuser/repo (your fork)
# upstream → upstream/repo (main project)
rally dispatch issue 42
```
