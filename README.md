# Rally <sub>your</sub> [Squad](https://bradygaster.github.io/squad/)

CLI tool for dispatching AI coding agents (Squad teams) to GitHub issues via git worktrees.

## Why Rally?

Rally is for individual developers using [Squad](https://bradygaster.github.io/squad/) on shared repos — solo devs, open source maintainers, or anyone on a codebase where committing `.squad/` files isn't appropriate. It automates the full Squad workflow — from GitHub issues to pull requests — without polluting your repository, eliminating ~15 manual steps: creating branches, setting up worktrees, symlinking Squad state, and managing multiple parallel dispatches.

![Animated demo of Rally CLI automating Squad workflows in a terminal](https://github.com/user-attachments/assets/0dfda827-17c7-4a8e-8adb-6a6474faa43b)

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
rally onboard owner/repo       # Register a project (auto-creates ~/rally/ on first run)

rally dashboard                 # Launch the dashboard ← this is the main entry point
```

The dashboard is Rally's home screen. From here you can dispatch agents to issues and PRs, monitor progress, view logs, and manage all your work.

```
Rally Dashboard

 Issue/PR                               Status               Changes   Age
owner/myrepo
❯ Issue #42  Fix login timeout          ⏳ copilot working              5m
     PR #38  Refactor auth module       🟡 ready for review   +85 -12  23m
owner/otherapp
  Issue #15  Add dark mode toggle       ⏳ copilot working              2h

3 active · 1 done · 0 orphaned

↑/↓ navigate · Enter actions · d details · v open · o browser · a attach
c connect IDE · l logs · n new dispatch · u upstream · x delete · r refresh · q quit
```

Common keyboard shortcuts from the dashboard:

- **`n`** — dispatch a new issue or PR
- **`o`** — open in the browser
- **`a`** — attach to a running Copilot session
- **`l`** — view logs
- **`d`** — dispatch details

See the [Dashboard](#dashboard) section for the full keyboard shortcut reference.

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

#### Removing a project

```bash
rally onboard remove [project]         # Interactive picker if project omitted
rally onboard remove myrepo --yes      # Skip confirmation
```

## Workflows

### For humans (dashboard workflow)

The dashboard is the primary way to use Rally day-to-day:

1. **Start:** `rally onboard owner/repo` (creates `~/rally/` automatically on first run)
2. **Launch:** `rally dashboard` to open the dashboard
3. **Dispatch:** Press `n` to pick an issue or PR from your onboarded projects
4. **Monitor:** Watch progress in real time (auto-refreshes every 5 seconds)
5. **Review:** Press `o` to open the PR in your browser, or `v` to open in VS Code
6. **Attach:** Press `a` to attach to a running Copilot session if it needs guidance

### CLI Workflows

Agents and scripts should use CLI commands directly:

```bash
rally dispatch issue 42                # Dispatch to an issue
rally dispatch pr 15                   # Dispatch to a PR review
rally dispatch continue 42             # Resume a session
rally dispatch log 42                  # Check agent output
rally dispatch clean                   # Clean up when done
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

## Dashboard

The dashboard (`rally dashboard`) is the primary interface for Rally. It supports interactive (TTY) and plain-text (piped) output.

```
$ rally dashboard [options]

Options:
  --json              Output as JSON instead of interactive UI
  --project <name>    Filter by project (repo name)
  -h, --help          display help for command
```

**Keyboard shortcuts (interactive mode):**

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

## Commands

> **For scripts and agents.** The CLI commands below are the programmatic interface to Rally. If you're a human, use the [Dashboard](#dashboard) instead — it's faster and easier.

### `rally onboard`

Onboard a repo to Rally (local path, GitHub URL, or owner/repo).

```
$ rally onboard [options] [path]

Onboard a repo to Rally (local path, GitHub URL, or owner/repo)

Arguments:
  path              Path, GitHub URL, or owner/repo (defaults to current directory)

Options:
  --team <name>     Use a named team (skips interactive prompt)
  --fork <owner/repo>  Fork workflow: set origin to your fork, upstream to main repo
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
  --sandbox              Run Copilot inside a Docker sandbox microVM
  --trust                Skip author trust warnings
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
  --sandbox              Run Copilot inside a Docker sandbox microVM
  --prompt <file>        Custom review prompt file
  -h, --help             display help for command
```

### `rally dispatch continue`

Resume or reconnect to an existing Copilot session for a dispatch.

```
$ rally dispatch continue [options] <number>

Resume a Copilot session for a dispatch

Arguments:
  number                 Issue or PR number

Options:
  --repo <owner/repo>    Target repository (owner/repo)
  -m, --message <text>   Send additional instructions to the session
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

### `rally dispatch sessions`

List active dispatches with their Copilot session info.

```
$ rally dispatch sessions [options]

Show active dispatches with session info

Options:
  -h, --help  display help for command
```

## Configuration

Rally reads user settings from `config.yaml` in the config directory (`~/rally/` by default, override with `RALLY_HOME`). This file is created automatically on first run.

Settings live under the `settings` key in `config.yaml`:

```yaml
# ~/rally/config.yaml
settings:
  docker_sandbox: ask
  require_trust: ask
  review_template: prompts/review.md
  deny_tools_copilot:
    - "shell(git push)"
    - "shell(gh)"
    - "shell(curl)"
    - "shell(wget)"
    - "shell(nc)"
    - "shell(ssh)"
    - "shell(scp)"
  deny_tools_sandbox:
    - "shell(git push)"
    - "shell(gh)"
    - "shell(curl)"
    - "shell(wget)"
    - "shell(nc)"
    - "shell(ssh)"
    - "shell(scp)"
```

### Settings reference

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `docker_sandbox` | `'always'` \| `'never'` \| `'ask'` | `'ask'` | Controls Docker sandbox usage. `always` enables it for every dispatch, `never` disables it, `ask` uses sandbox only when `--sandbox` flag is passed. |
| `require_trust` | `'always'` \| `'never'` \| `'ask'` | `'ask'` | Controls author/org trust checks before dispatching. `always` requires trust confirmation, `never` skips all trust checks, `ask` warns on author mismatch and prompts interactively. |
| `review_template` | `string` \| `null` | `null` | Path to a custom review prompt file, **relative to the config directory** (e.g. `prompts/review.md` resolves to `~/rally/prompts/review.md`). Used for `dispatch pr` when `--prompt` is not passed. |
| `deny_tools_copilot` | `string[]` | See below | Tools denied when running Copilot **without** Docker sandbox. |
| `deny_tools_sandbox` | `string[]` | See below | Tools denied when running Copilot **inside** Docker sandbox. |

**Default deny lists** (both `deny_tools_copilot` and `deny_tools_sandbox`):

```
shell(git push), shell(gh), shell(curl), shell(wget), shell(nc), shell(ssh), shell(scp)
```

### Precedence

CLI flags take precedence over config settings. For example, `rally dispatch issue 42 --sandbox` enables the sandbox even if `docker_sandbox` is set to `never`, and `--prompt review.md` overrides `review_template`.

### Security note on deny_tools

The `deny_tools_copilot` and `deny_tools_sandbox` values must be arrays of strings. It is recommended to always include at least one denied tool — see the default list for recommended values. If you don't want to customize the deny lists, omit them entirely and the defaults will be used.

## Dispatch Status Model

Each dispatch progresses through these statuses:

```
implementing → reviewing → upstream
```

| Status | Meaning |
|--------|---------|
| `implementing` | Copilot is actively working |
| `reviewing` | Copilot finished — ready for human review |
| `upstream` | Marked as waiting on upstream (manual status via dashboard `u` key) |

Use `rally clean` to remove dispatches and their worktrees.

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
- **CAN:** read code, make local edits, run builds/tests, use git locally
- **CANNOT:** `git push`, run `gh` CLI commands, use `curl`/`wget`/`nc`/`ssh`
- Remote reads use MCP tools (e.g. `github-mcp-server-issue_read`)

### Repo resolution

When `--repo` is omitted, Rally resolves the target repo in this order:
1. `--repo owner/repo` flag
2. Current working directory (if inside an onboarded project)
3. Single-project fallback (if only one project is registered)
4. Error with list of registered projects

## Security & Safety

> **⚠️ Use your best judgement.** Rally makes an effort to enforce multiple layers of protection, but no system is foolproof. Always review agent output before merging, and use the Docker sandbox for maximum isolation when working with untrusted content.

### Read-only dispatch policy

Every dispatched Copilot session runs under a **read-only policy** that is prepended to the prompt. The agent can read code, make local edits, and run tests — but cannot publish anything. Specific tool denials enforced via `--deny-tool` flags:

| Blocked tool | Why |
|---|---|
| `git push` | Prevents agents from pushing commits |
| `gh` (all subcommands) | Blocks PR creation, issue comments, and other GitHub mutations |
| `curl`, `wget`, `nc`, `ssh`, `scp` | Prevents network exfiltration of repo data |

Agents can still use MCP read-only tools (`github-mcp-server-issue_read`, `pull_request_read`, etc.) for safe remote data access.

### Trust checks

Before dispatching, Rally checks whether the issue/PR was authored by someone other than the current user. If there's a mismatch, it warns about **prompt injection risk** — untrusted issue/PR content could contain instructions that trick the agent. Rally also checks org membership for org-owned repos.

- **Interactive mode:** Shows warnings and prompts for confirmation
- **Non-interactive mode:** Auto-rejects author mismatches (pass `--trust` to override)
- **Config:** Set `require_trust: never` in `config.yaml` to skip checks entirely

### Worktree isolation

Each dispatch gets its own **git worktree** — an independent working directory with its own branch. This prevents cross-contamination between concurrent dispatches and keeps your main working tree untouched.

Copilot CLI's built-in [path permissions](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/configure-copilot-cli#setting-path-permissions) restrict agents to the worktree directory by default (since Rally sets `cwd` to the worktree path). Rally also passes `--disallow-temp-dir` to further tighten isolation by removing temp directory access.

You can disable this in `config.yaml` if agents need temp directory access:

```yaml
settings:
  disallow_temp_dir: false
```

> **Note:** For maximum filesystem isolation, use the Docker sandbox which provides a full container boundary.

### Docker sandbox

For maximum isolation, Rally can run Copilot inside a [Docker sandbox](https://docs.docker.com/ai/sandboxes/agents/copilot/) microVM. The agent executes in a lightweight container with no access to the host filesystem beyond the worktree.

Requires [Docker Desktop 4.58+](https://www.docker.com/products/docker-desktop/) with sandbox support and `GH_TOKEN` or `GITHUB_TOKEN` set globally.

```bash
rally dispatch issue 42 --sandbox
rally dispatch pr 10 --sandbox
```

Or set `docker_sandbox: always` in `config.yaml` to enable it for all dispatches.

### Input sanitization

- **Git ref names** are stripped to `[a-zA-Z0-9/_.-]` before interpolation into prompts
- **Worktree paths** must be absolute with no `..` traversal segments
- **GitHub usernames/orgs** are validated against `[A-Za-z0-9_.-]` before API calls

### Config file safety

Rally's config directory (`~/rally/`) is created with **0700 permissions** (user-only access). All config writes use **atomic rename** (write to temp file, then rename) to prevent corruption from crashes or concurrent access.

## Future Work

- **Smart worktree cleanup:** Automatic removal of completed worktrees and branches after PR merge
- **Team templates:** Pre-configured team setups for common tech stacks (Node, Python, Go, etc.)
- **PR creation automation:** Auto-create pull requests after Squad completes implementation
- **Advanced team configuration:** Team overlays, partial sharing, and team migration between projects
- **Team snapshots:** Export/import team state for bootstrapping from templates

## License

See [package.json](package.json) for details.
