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

📖 **[Full documentation →](https://jsturtevant.github.io/rally/)**

## AI Safety

> ** ⚠️ Use your best judgement. ** Rally makes an effort to enforce multiple layers of protection, but no system is foolproof. When working with untrusted content, always review agent output before merging, and use the Docker sandbox for maximum isolation.

Rally enforces multiple layers of protection:

- **Read-only dispatch policy** — Agents can read code and make local edits, but cannot `git push`, run `gh` commands, or use network tools (`curl`, `wget`, etc.)
- **Trust checks** — Warns about prompt injection risk when dispatching to issues/PRs from untrusted authors
- **Worktree isolation** — Each dispatch gets its own git worktree with path permissions
- **Docker sandbox** — Optional container isolation via `--sandbox` flag

📖 **[Security documentation →](https://jsturtevant.github.io/rally/security/overview/)**


### Config file safety

Rally's config directory (`~/rally/`) is created with **0700 permissions** (user-only access). All config writes use **atomic rename** (write to temp file, then rename) to prevent corruption from crashes or concurrent access.

## License

[MIT](LICENSE)
