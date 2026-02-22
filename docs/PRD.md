# Rally — Product Requirements Document

**Version:** 0.1.0 (Draft)
**Author:** Mal (Lead)
**Date:** 2026-02-21
**Status:** Draft — pending team review

---

## 1. Problem Statement

Squad gives you an AI team. But getting that team into a project — especially without polluting the repo — is manual and error-prone. And once you have a team, orchestrating the full lifecycle (issue → branch → worktree → plan → implement → test → review → PR) requires too many manual steps.

**Pain points:**

1. **Setup friction.** Squad's `init` creates files inside the repo. Teams that don't want to commit AI state have to manually symlink, exclude, and manage paths. Tamir Dresher documented this — it works, but it's ~15 manual steps.
2. **No worktree automation.** Squad supports worktrees, but creating them, symlinking team state in, and tearing them down is all manual.
3. **No issue-to-PR pipeline.** Going from "here's a GitHub issue" to "here's a PR with tests and a code review" requires manually: creating a branch, setting up the worktree, adding the squad, running the plan, iterating on implementation, adding tests, and requesting review.
4. **No visibility.** When you have multiple issues in flight across worktrees, there's no way to see what's active, what's done, and what's blocked.

Rally solves all four. One CLI, five commands.

---

## 2. Target Users

### Primary: Individual developers using Squad on shared repos
- Solo developers working on projects where the rest of the team doesn't use Squad
- Open source maintainers, contributors to large repos, or anyone on a shared codebase where committing `.squad/` files isn't appropriate
- One person who wants Squad's power without affecting their teammates or the repo
- Want to parallelize work across multiple issues using worktrees

### Non-users
- People who don't use Squad (Rally is tightly coupled to Squad)
- People who want Squad committed to their repo (they don't need Rally — vanilla Squad works fine)

---

## 3. Commands & Workflows

### 3.1 `rally setup`

**Purpose:** Initialize Squad team state in an external directory (outside any repo). This is the "portable team" that gets symlinked into projects.

**Usage:**
```bash
rally setup [--dir <path>]
```

**Behavior:**
1. Create a directory for external team state (default: `~/.rally/team/`)
2. Create a directory for cloned projects (default: `~/.rally/projects/`)
3. Run `npx github:bradygaster/squad` inside that directory to generate the full `.squad/` tree, `.squad-templates/`, and `.github/agents/squad.agent.md`
4. Store the setup paths in `~/.rally/config.yaml`

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--dir <path>` | `~/.rally/team/` | Where to create external team state |

**Example:**
```bash
$ rally setup
✓ Created team directory at ~/.rally/team/
✓ Initialized Squad in ~/.rally/team/
✓ Saved config to ~/.rally/config.yaml
```

**Output on re-run (idempotent):**
```bash
$ rally setup
  Team directory already exists — skipping
  Squad already initialized — skipping
✓ Config verified
```

**Config file (`~/.rally/config.yaml`):**
```yaml
teamDir: /home/user/.rally/team
projectsDir: /home/user/.rally/projects
version: 0.1.0
```

**Error cases:**
- Squad not installed → `✗ Squad not found. Install with: npx github:bradygaster/squad`
- No write permission → `✗ Cannot write to <path>: permission denied`

---

### 3.2 `rally onboard`

**Purpose:** Connect a repo to your external Squad team without committing anything. Uses symlinks + `.git/info/exclude`. Accepts a local path or a GitHub URL — when given a URL, clones the repo first.

**Precondition:** `rally setup` has been run.

**Usage:**
```bash
rally onboard [<repo-url-or-path>]
```

The argument can be:
- **Nothing** — onboards the current working directory (existing behavior)
- **A local path** — onboards the repo at that path (e.g., `rally onboard ~/projects/my-app`)
- **A GitHub URL** — `https://github.com/owner/repo` or the shorthand `owner/repo`. Clones the repo into the configured projects directory first, then onboards it.

**Behavior:**
1. Read `~/.rally/config.yaml` to find team directory and projects directory
2. **If the argument is a GitHub URL or `owner/repo` shorthand:**
   - Clone the repo into `<projectsDir>/<repo-name>/` (default: `~/.rally/projects/<repo-name>/`)
   - If the directory already exists, skip the clone and use the existing checkout
3. **Team selection prompt:** Ask the user which team configuration to use:
   ```
   ? Use your existing team or create a new one for this project?
     ❯ Existing team — use shared team from ~/.rally/team/
       New team — create a project-specific team for <project-name>
   ```
   - **Existing team:** Symlinks point to the shared `<teamDir>/` (default behavior, same as before)
   - **New team:** Creates a project-specific team directory at `~/.rally/teams/<project-name>/`, runs `npx github:bradygaster/squad` inside it, and symlinks point there instead
4. In the target repo, create symlinks (pointing to whichever team directory was selected):
   - `.squad/` → `<selectedTeamDir>/.squad/`
   - `.squad-templates/` → `<selectedTeamDir>/.squad-templates/`
   - `.github/agents/squad.agent.md` → `<selectedTeamDir>/.github/agents/squad.agent.md`
5. Add entries to `.git/info/exclude` (NOT `.gitignore` — local only, never committed):
   ```
   # Rally — Squad symlinks
   .squad
   .squad/
   .squad-templates
   .squad-templates/
   .github/agents/squad.agent.md
   ```
6. Register the repo in `~/.rally/projects.yaml` (including which team type was selected)

**Why `.git/info/exclude`?**
From Tamir Dresher's technique: `.git/info/exclude` works identically to `.gitignore` but is local-only. It's never committed, so the repo stays clean. On Windows, both the symlink name and the directory form need separate entries (e.g., `.squad` and `.squad/`).

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--team <shared\|new>` | _(prompt)_ | Skip the team selection prompt. `shared` uses the existing team; `new` creates a project-specific team. |

**Example (local repo, shared team):**
```bash
$ cd ~/projects/my-app
$ rally onboard
? Use your existing team or create a new one for this project?
  ❯ Existing team
✓ Symlinked .squad/ → ~/.rally/team/.squad/
✓ Symlinked .squad-templates/ → ~/.rally/team/.squad-templates/
✓ Symlinked .github/agents/squad.agent.md → ~/.rally/team/.github/agents/squad.agent.md
✓ Updated .git/info/exclude
✓ Registered project: my-app (shared team)
```

**Example (GitHub URL, new project-specific team):**
```bash
$ rally onboard owner/cool-project
✓ Cloned owner/cool-project → ~/.rally/projects/cool-project/
? Use your existing team or create a new one for this project?
  ❯ New team
✓ Created team directory at ~/.rally/teams/cool-project/
✓ Initialized Squad in ~/.rally/teams/cool-project/
✓ Symlinked .squad/ → ~/.rally/teams/cool-project/.squad/
✓ Symlinked .squad-templates/ → ~/.rally/teams/cool-project/.squad-templates/
✓ Symlinked .github/agents/squad.agent.md → ~/.rally/teams/cool-project/.github/agents/squad.agent.md
✓ Updated .git/info/exclude
✓ Registered project: cool-project (project-specific team)
```

**Idempotent:** If symlinks already exist and point to the right place, skip and report. If a clone target already exists, use the existing checkout.

**Error cases:**
- Not inside a git repo (when no argument given) → `✗ Not a git repository. Run from inside a repo or provide a GitHub URL.`
- Setup not run → `✗ No team directory found. Run: rally setup`
- Symlink target doesn't exist → `✗ Team directory missing: <path>. Run: rally setup`
- Clone fails → `✗ Failed to clone <url>: <git error>`
- Invalid URL/shorthand → `✗ Not a valid GitHub URL or owner/repo shorthand: <input>`

**Projects registry (`~/.rally/projects.yaml`):**
```yaml
projects:
  - name: my-app
    path: /home/user/projects/my-app
    team: shared
    teamDir: /home/user/.rally/team
    onboarded: "2026-02-21T10:00:00Z"
  - name: cool-project
    path: /home/user/.rally/projects/cool-project
    team: project
    teamDir: /home/user/.rally/teams/cool-project
    onboarded: "2026-02-21T11:00:00Z"
```

---

### 3.3 `rally dispatch issue` (Issue Mode)

**Purpose:** Take a GitHub issue and run the full Squad lifecycle: branch → worktree → plan → implement → test → review → PR.

**Precondition:** Repo is onboarded (`rally onboard` has been run).

**Usage:**
```bash
rally dispatch issue <issue-number> [--repo <owner/repo>]
```

**Behavior:**
1. Resolve the target repo (see **Repo resolution** below)
2. Fetch issue metadata from GitHub (`gh issue view <number> --json title,body,labels`)
3. Create a branch named `rally/<issue-number>-<slug>` from the default branch
4. Create a git worktree at `<repo>/.worktrees/rally-<issue-number>/`
5. Symlink Squad files into the worktree (leverages `.git/info/exclude` entries from `onboard` — they apply to all worktrees automatically)
6. Write issue context to `.squad/dispatch-context.md` in the worktree
7. Invoke Squad to plan: `npx github:bradygaster/squad` with issue context
8. Log the dispatch to `~/.rally/active.yaml`

**Repo resolution (applies to both `issue` and `pr` subcommands):**
The `--repo <owner/repo>` flag explicitly specifies the GitHub repo to target. If omitted, Rally infers the repo:
1. **Current directory** — if the cwd is inside an onboarded project, use that project's repo
2. **Single project** — if `projects.yaml` contains exactly one onboarded project, use it
3. **Ambiguous** — if multiple projects are onboarded and cwd doesn't match any, error: `✗ Multiple projects onboarded. Specify with --repo owner/repo`

**The worktree + exclude trick:**
Git exclude entries in the main `.git/info/exclude` apply to ALL worktrees. This is why `onboard` is a separate step — it sets up excludes once, and every worktree benefits.

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--repo <owner/repo>` | _(inferred)_ | GitHub repo to target (e.g., `owner/repo`) |
| `--base <branch>` | default branch | Branch to create worktree from |
| `--no-plan` | `false` | Skip automatic planning step |

**Example:**
```bash
$ rally dispatch issue 42
✓ Fetched issue #42: "Add user authentication"
✓ Created branch: rally/42-add-user-authentication
✓ Created worktree: .worktrees/rally-42/
✓ Symlinked Squad into worktree
✓ Wrote dispatch context
✓ Squad is planning…

  Worktree ready at: .worktrees/rally-42/
  To work with Squad: cd .worktrees/rally-42/
```

**Example (explicit repo):**
```bash
$ rally dispatch issue 42 --repo owner/my-app
```

**Active dispatch registry (`~/.rally/active.yaml`):**
```yaml
dispatches:
  - id: my-app-42
    repo: /home/user/projects/my-app
    issue: 42
    branch: rally/42-add-user-authentication
    worktree: /home/user/projects/my-app/.worktrees/rally-42
    status: planning
    created: "2026-02-21T10:30:00Z"
```

**Statuses:** `planning` → `implementing` → `reviewing` → `done` → `cleaned`

**Error cases:**
- Issue not found → `✗ Issue #42 not found. Check the issue number and repo.`
- Repo not onboarded → `✗ Repo not onboarded. Run: rally onboard`
- Worktree already exists → `✗ Worktree for issue #42 already exists at .worktrees/rally-42/`
- `gh` CLI not installed → `✗ GitHub CLI (gh) not found. Install from: https://cli.github.com`
- Not authenticated → `✗ Not authenticated with GitHub. Run: gh auth login`

---

### 3.4 `rally dispatch pr` (PR Review Mode)

**Purpose:** Dispatch Squad to review an existing pull request.

**Usage:**
```bash
rally dispatch pr <pr-number> [--repo <owner/repo>]
```

**Behavior:**
1. Resolve the target repo (see **Repo resolution** in §3.3)
2. Fetch PR metadata from GitHub (`gh pr view <number> --json title,body,headRefName,baseRefName,files`)
3. Create a worktree from the PR's head branch at `.worktrees/rally-pr-<number>/`
4. Symlink Squad into the worktree
5. Write PR context (diff summary, changed files, PR description) to `.squad/dispatch-context.md`
6. Invoke Squad with a review-focused prompt
7. Log to `~/.rally/active.yaml` with status `reviewing`

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--repo <owner/repo>` | _(inferred)_ | GitHub repo to target (e.g., `owner/repo`) |

**Example:**
```bash
$ rally dispatch pr 87
✓ Fetched PR #87: "Refactor auth middleware"
✓ Created worktree from branch: feature/refactor-auth
✓ Symlinked Squad into worktree
✓ Wrote review context (12 files changed)
✓ Squad is reviewing…

  Worktree ready at: .worktrees/rally-pr-87/
```

**Example (explicit repo):**
```bash
$ rally dispatch pr 87 --repo owner/api-srv
```

**Error cases:**
- PR not found → `✗ PR #87 not found.`
- PR already merged → `✗ PR #87 is already merged.`
- PR closed → `✗ PR #87 is closed.`

---

### 3.5 `rally dashboard`

**Purpose:** Show all active dispatches across all onboarded projects.

**Usage:**
```bash
rally dashboard
```

**Behavior:**
1. Read `~/.rally/active.yaml`
2. For each active dispatch, check worktree health (does it still exist?)
3. Display a table of active work

**Example output:**
```
Rally Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Project    Issue   Branch                              Status       Age
 ───────    ─────   ──────                              ──────       ───
 my-app     #42     rally/42-add-user-auth         implementing 2h
 my-app     #51     rally/51-fix-login-bug         planning     30m
 api-srv    PR #87  feature/refactor-auth               reviewing    1d
 my-app     #38     rally/38-update-deps           done         3d

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 3 active · 1 done · 0 blocked
```

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--json` | `false` | Output as JSON instead of table |
| `--project <name>` | all | Filter to a specific project |

**Subcommands:**
```bash
rally dashboard clean           # Remove 'done' dispatches and delete their worktrees
rally dashboard clean --all     # Remove ALL dispatches and worktrees
```

---

## 4. Architecture

### 4.1 State Layout

```
~/.rally/
├── config.yaml          # Global config (team directory, projects directory)
├── projects.yaml        # Registry of onboarded projects
├── active.yaml          # Active dispatches across all projects
├── team/                # Shared Squad team state (default)
│   ├── .squad/
│   ├── .squad-templates/
│   └── .github/
│       └── agents/
│           └── squad.agent.md
├── teams/               # Project-specific team directories
│   └── cool-project/    # Team state for a specific project
│       ├── .squad/
│       ├── .squad-templates/
│       └── .github/
│           └── agents/
│               └── squad.agent.md
└── projects/            # Cloned repos (from GitHub URLs)
    └── cool-project/    # A repo cloned via `rally onboard owner/cool-project`

~/projects/my-app/                   # An onboarded project (shared team)
├── .squad/ → ~/.rally/team/.squad/           (symlink)
├── .squad-templates/ → ~/.rally/team/...     (symlink)
├── .github/agents/squad.agent.md → ...            (symlink)
├── .git/
│   └── info/
│       └── exclude                  # Contains Squad symlink patterns
└── .worktrees/
    ├── rally-42/               # Worktree for issue #42
    │   ├── .squad/ → ...            (symlink)
    │   └── (project files)
    └── rally-pr-87/            # Worktree for PR review

~/.rally/projects/cool-project/ # An onboarded project (project-specific team)
├── .squad/ → ~/.rally/teams/cool-project/.squad/    (symlink)
├── .squad-templates/ → ~/.rally/teams/cool-project/...  (symlink)
├── .github/agents/squad.agent.md → ...                   (symlink)
├── .git/
│   └── info/
│       └── exclude
└── .worktrees/
```

### 4.2 Data Flow

```
rally setup
  └─→ Creates ~/.rally/team/ with Squad files
  └─→ Writes ~/.rally/config.yaml

rally onboard
  └─→ Reads config.yaml
  └─→ If GitHub URL: clones repo into projectsDir
  └─→ Prompts for team selection (shared or project-specific)
  └─→ If new team: creates ~/.rally/teams/<project>/ and runs Squad init
  └─→ Creates symlinks in repo (pointing to selected team dir)
  └─→ Updates .git/info/exclude
  └─→ Writes to projects.yaml (with team type)

rally dispatch issue <issue>
  └─→ Resolves target repo (--repo flag, cwd, or projects.yaml)
  └─→ Reads config.yaml, projects.yaml
  └─→ Calls gh CLI for issue data
  └─→ Creates branch + worktree
  └─→ Symlinks Squad into worktree
  └─→ Writes dispatch-context.md
  └─→ Invokes Squad
  └─→ Updates active.yaml

rally dashboard
  └─→ Reads active.yaml
  └─→ Validates worktree health
  └─→ Renders table
```

### 4.3 Module Structure

```
rally/
├── bin/
│   └── rally.js        # Entry point, CLI parsing via Commander
├── lib/
│   ├── setup.js             # setup command
│   ├── onboard.js           # onboard command
│   ├── dispatch.js          # dispatch command (issue + PR modes)
│   ├── dashboard.js         # dashboard command
│   ├── config.js            # Config read/write (~/.rally/*.yaml) — uses js-yaml
│   ├── symlink.js           # Symlink creation + validation
│   ├── exclude.js           # .git/info/exclude management
│   ├── worktree.js          # Git worktree create/remove
│   ├── github.js            # GitHub CLI wrapper (issues, PRs)
│   └── ui/                  # Ink-based terminal UI components (see §5)
│       ├── App.jsx          # Root Ink app — wraps all views
│       ├── components/      # Reusable Ink React components
│       │   ├── StatusMessage.jsx   # ✓/✗/⚠ status lines (uses Chalk)
│       │   ├── DispatchBox.jsx     # Bordered info panel for dispatch details
│       │   ├── DispatchTable.jsx   # Table of active dispatches (uses ink-table or custom)
│       │   ├── TeamPrompt.jsx      # Team selection prompt (uses @inquirer/prompts)
│       │   └── ProgressSteps.jsx   # Multi-step progress indicator
│       └── Dashboard.jsx    # Full-screen dashboard Ink app with React state
├── test/
│   ├── setup.test.js
│   ├── onboard.test.js
│   ├── dispatch.test.js
│   ├── dashboard.test.js
│   ├── config.test.js
│   ├── symlink.test.js
│   ├── exclude.test.js
│   └── worktree.test.js
└── package.json
```

---

## 5. Terminal UI/UX

Rally's terminal interface is built on **Ink** (React for the terminal), **Chalk** (styling), and **Ora** (spinners) — the same stack used by GitHub Copilot CLI, Claude Code CLI, and other polished Node.js CLIs. UI components are Ink React components in `lib/ui/`. Interactive prompts use **@inquirer/prompts**. The interface degrades gracefully when output is piped.

### 5.0 Dependencies

Rally uses a curated set of production-quality npm packages — the same stack powering tools like GitHub Copilot CLI and Claude Code CLI.

| Package | Version | Purpose |
|---------|---------|---------|
| **ink** | `^5.0.0` | React-based terminal UI framework. Component architecture, layout, focus management. |
| **ink-table** | `^4.0.0` | Table rendering within Ink. Used for dashboard and dispatch listings. |
| **chalk** | `^5.0.0` | Terminal string styling (colors, bold, dim, underline). Replaces raw ANSI escape code constants. |
| **ora** | `^8.0.0` | Elegant terminal spinners for async operations. |
| **commander** | `^12.0.0` | CLI argument parsing, subcommands, help generation. Industry standard. |
| **js-yaml** | `^4.0.0` | YAML parsing and serialization for config files. |
| **@inquirer/prompts** | `^7.0.0` | Interactive selection menus and confirmations (team selection, etc.). |

**Dev dependencies:**

| Package | Version | Purpose |
|---------|---------|---------|
| **ink-testing-library** | `^4.0.0` | Testing utilities for Ink components. |

### 5.1 Design Language

#### Brand Palette

All colors are applied via **Chalk** helpers. No raw ANSI escape codes in application code.

| Role | Chalk Call | Usage |
|------|-----------|-------|
| **Primary** | `chalk.cyan(…)` | Command names, headers, emphasis |
| **Success** | `chalk.green(…)` | `✓` checkmarks, completed statuses |
| **Error** | `chalk.red(…)` | `✗` failures, error messages |
| **Warning** | `chalk.yellow(…)` | `⚠` warnings, caution states |
| **Secondary** | `chalk.dim(…)` | Hints, timestamps, skipped operations, paths |
| **Accent** | `chalk.bold(…)` | Section titles, project names, counts |
| **Muted** | `chalk.dim.strikethrough(…)` | Cleaned/archived dispatches |

Chalk automatically handles TTY detection, `NO_COLOR`, and `FORCE_COLOR` — no manual branching needed.

#### Status Icons

```
✓  Success     (green)
✗  Error       (red)
⚠  Warning     (yellow)
●  Active      (cyan, pulsing in dashboard)
◌  Pending     (dim)
◆  In progress (yellow)
```

#### Typography Rules

| Element | Chalk Style | Example |
|---------|-------------|---------|
| Section headers | `chalk.bold.cyan(…)` | `Rally Dashboard` |
| Command names | `chalk.cyan(…)` | `rally setup` |
| File paths | `chalk.dim(…)` | `~/.rally/config.yaml` |
| User input / values | `chalk.bold(…)` | `my-app` |
| Hints / help text | `chalk.dim(…)` | `Run: rally setup` |
| Error messages | `chalk.bold.red('✗') + msg` | `✗ Message here` |
| Success messages | `chalk.green('✓') + msg` | `✓ Message here` |
| Skipped operations | `chalk.dim(…)`, indented | `  Team directory already exists — skipping` |

---

### 5.2 UI Components (Ink Architecture)

All components live in `lib/ui/` as Ink (React) components or thin wrappers around Chalk/Ora. Command modules import from `lib/ui/` — they never write raw ANSI codes directly.

#### 5.2.1 StatusMessage Component (`lib/ui/components/StatusMessage.jsx`)

Renders `✓`/`✗`/`⚠` status lines using Chalk. Replaces raw ANSI color constants.

```jsx
import { Text } from 'ink';
import chalk from 'chalk';

// <StatusMessage type="success">Saved config</StatusMessage>
// <StatusMessage type="error">Not a git repository</StatusMessage>
// <StatusMessage type="warning">Symlink already exists</StatusMessage>
// <StatusMessage type="skip">Team directory already exists — skipping</StatusMessage>
```

#### 5.2.2 DispatchBox Component (`lib/ui/components/DispatchBox.jsx`)

Renders bordered info panels using Ink's `<Box>` with `borderStyle="round"` or `borderStyle="single"`.

```jsx
import { Box, Text } from 'ink';

// <DispatchBox title="Dispatch #42">
//   <Text>Issue:    #42 Add user authentication</Text>
//   <Text>Branch:   rally/42-add-user-auth</Text>
//   <Text>Worktree: .worktrees/rally-42/</Text>
// </DispatchBox>
```

**Example output:**

```
┌─────────────── Dispatch #42 ───────────────┐
│                                            │
│  Issue:   Add user authentication          │
│  Branch:  rally/42-add-user-auth      │
│  Status:  ◆ implementing                   │
│  Age:     2h 15m                           │
│                                            │
└────────────────────────────────────────────┘
```

Ink handles auto-sizing to terminal width and responds to resize events natively.

#### 5.2.3 DispatchTable Component (`lib/ui/components/DispatchTable.jsx`)

Renders the dispatch table using `ink-table` or a custom Ink `<Box>` layout with flexbox-style columns.

```jsx
import Table from 'ink-table';

// <DispatchTable dispatches={dispatches} />
// Columns: Project, Issue, Branch, Status, Age
```

Ink handles column width calculation and terminal-width truncation automatically.

**Example output:**

```
 Project    Issue   Branch                              Status        Age
 ───────    ─────   ──────                              ──────        ───
 my-app     #42     rally/42-add-user-auth         ◆ implementing 2h
 my-app     #51     rally/51-fix-login-bug         ● planning     30m
 api-srv    PR #87  feature/refactor-auth               ● reviewing    1d
```

#### 5.2.4 Spinner (Ora)

Async operation spinners use **Ora** directly — no custom spinner implementation needed.

```js
import ora from 'ora';

const spinner = ora('Cloning owner/cool-project…').start();
// ... async work ...
spinner.succeed('Cloned owner/cool-project');
// or: spinner.fail('Clone failed: <error>');
```

Ora handles TTY detection, frame animation, and non-TTY fallback automatically.

**Example behavior:**

```
⠹ Cloning owner/cool-project…        ← animating
✓ Cloned owner/cool-project           ← final (green ✓, line replaced)
```

#### 5.2.5 ProgressSteps Component (`lib/ui/components/ProgressSteps.jsx`)

Multi-step progress indicator built as an Ink component with React state.

```jsx
import { Box, Text } from 'ink';
import chalk from 'chalk';

// <ProgressSteps steps={steps} current={currentStep} />
// Each step shows ✓ (done), ◆ (current), or ◌ (pending)
```

Falls back to text-only output when not TTY: `Step 3/5: Setting up Squad…`.

#### 5.2.6 Interactive Prompts (@inquirer/prompts)

Interactive selection menus use **@inquirer/prompts** instead of a custom raw-mode implementation. This provides polished arrow-key navigation, search, and accessibility out of the box.

```js
import { select } from '@inquirer/prompts';

const teamChoice = await select({
  message: 'Use your existing team or create a new one for this project?',
  choices: [
    { name: 'Existing team — use shared team from ~/.rally/team/', value: 'shared' },
    { name: 'New team — create a project-specific team', value: 'new' },
  ],
});
```

**Example output:**

```
? Use your existing team or create a new one for this project?
  ❯ Existing team — use shared team from ~/.rally/team/
    New team — create a project-specific team
```

Non-TTY fallback: uses the first choice as default (or accepts `--team` flag).

---

### 5.3 Dashboard Layout

The dashboard is a full **Ink app** (`lib/ui/Dashboard.jsx`) that manages its own React state and renders to the alternate screen buffer.

```jsx
import { render, Box, Text, useInput, useApp } from 'ink';
import { useState, useEffect } from 'react';

// The Dashboard component manages:
// - Active dispatches state (loaded from active.yaml)
// - Selected row index
// - Auto-refresh interval (every 5 seconds)
// - Keyboard input handling (↑↓ select, q quit, r refresh, c clean)
```

**Alternate buffer control:** Ink's `render()` with `{ exitOnCtrlC: true }` handles screen buffer management. The dashboard uses Ink's `useApp()` hook for clean exit.

#### Layout (responsive to terminal width/height)

```
┌────────────────────────────────── Rally Dashboard ──────────────────────────────────┐
│                                                                                          │
│  ┌─ Active Dispatches ─────────────────────────────────────────────────────────────────┐  │
│  │  Project    Issue   Branch                         Status          Age              │  │
│  │  ───────    ─────   ──────                         ──────          ───              │  │
│  │  my-app     #42     rally/42-add-user-auth    ◆ implementing  2h              │  │
│  │  my-app     #51     rally/51-fix-login        ● planning      30m             │  │
│  │  api-srv    PR #87  feature/refactor-auth          ● reviewing     1d              │  │
│  └─────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
│  ┌─ Projects ──────────────────────────┐  ┌─ Team ──────────────────────────────────┐   │
│  │  my-app       3 dispatches (shared) │  │  Team dir:  ~/.rally/team/         │   │
│  │  api-srv      1 dispatch   (shared) │  │  Agents:    5                           │   │
│  │  cool-proj    0 dispatches (own)    │  │  Type:      shared                      │   │
│  └─────────────────────────────────────┘  └─────────────────────────────────────────┘   │
│                                                                                          │
│  ─────────────────────────────────────────────────────────────────────────────────────── │
│  q quit · r refresh · c clean done · ↑↓ select · enter open worktree                    │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Panels** (all Ink `<Box>` components with border props):

1. **Active Dispatches** — full-width `<DispatchTable>`. Sorted by status (active first, done last). Highlighted selection row via React state.
2. **Projects** — left `<Box>`. Lists onboarded projects from `projects.yaml` with dispatch count and team type.
3. **Team** — right `<Box>`. Shows current team directory, agent count, team type.
4. **Status bar** — bottom `<Text>`. Keyboard shortcuts and summary stats.

**Refresh behavior:**

- Auto-refresh every 5 seconds via `useEffect` with `setInterval` (re-read `active.yaml`, recheck worktree health)
- Manual refresh with `r` key via `useInput` hook
- Ink handles terminal resize events automatically

**Keyboard navigation (via `useInput` hook):**

| Key | Action |
|-----|--------|
| `↑` / `↓` | Move selection in dispatches table |
| `Enter` | Print worktree path and exit (for `cd $(rally dashboard --select)`) |
| `r` | Refresh data |
| `c` | Clean completed dispatches |
| `q` / `Ctrl-C` | Exit dashboard (Ink unmounts, restores screen) |

**Non-TTY mode:** When piped (e.g., `rally dashboard | cat`), skip the Ink app entirely. Render the table once as plain text (same as §3.5 output) using Chalk (which auto-strips colors when piped), and exit.

---

### 5.4 Graceful Degradation

All UI output must work in two modes. Chalk and Ink handle most of this automatically:

| Feature | TTY (interactive terminal) | Non-TTY (piped / redirected) |
|---------|---------------------------|------------------------------|
| Colors | Full Chalk styling | Chalk auto-strips — plain text |
| Spinner | Ora animated braille dots | Ora static message, result on completion |
| Progress | Ink component, in-place | `Step 3/5: message` |
| Prompt | @inquirer/prompts navigation | Use flag default or first choice |
| Dashboard | Full Ink app with interactivity | Single render, plain table, exit |
| Box/panel | Ink `<Box>` with borders | Indent with spaces, no border chars |

**`NO_COLOR` support:** Chalk respects the `NO_COLOR` environment variable automatically (disables colors even on TTY). This follows the [no-color.org](https://no-color.org) convention.

**`FORCE_COLOR` support:** Chalk respects `FORCE_COLOR` automatically (enables colors even when not TTY).

---

### 5.5 Example Output Mockups

#### `rally setup`

```
  ┌─ rally setup ─────────────────────────────┐
  │                                                 │
  │  ✓ Created team directory at ~/.rally/team/│
  │  ⠹ Initializing Squad…                         │
  │  ✓ Initialized Squad in ~/.rally/team/     │
  │  ✓ Created projects directory                   │
  │  ✓ Saved config to ~/.rally/config.yaml    │
  │                                                 │
  │  Ready! Next step:                              │
  │    rally onboard                           │
  │                                                 │
  └─────────────────────────────────────────────────┘
```

#### `rally onboard` (with team prompt)

```
  ⠹ Cloning owner/cool-project…
  ✓ Cloned owner/cool-project → ~/.rally/projects/cool-project/

  ? Use your existing team or create a new one for this project?
    ❯ Existing team — use shared team from ~/.rally/team/
      New team — create a project-specific team

  ✓ Symlinked .squad/
  ✓ Symlinked .squad-templates/
  ✓ Symlinked .github/agents/squad.agent.md
  ✓ Updated .git/info/exclude
  ✓ Registered project: cool-project (shared team)
```

#### `rally dispatch issue 42`

```
  ⠹ Fetching issue #42…
  ✓ Fetched issue #42: "Add user authentication"

  ┌─ Dispatch ─────────────────────────────────────┐
  │  Issue:    #42 Add user authentication         │
  │  Branch:   rally/42-add-user-auth         │
  │  Worktree: .worktrees/rally-42/           │
  └────────────────────────────────────────────────┘

  ✓ Created branch
  ✓ Created worktree
  ✓ Symlinked Squad into worktree
  ✓ Wrote dispatch context

  ⠹ Squad is planning…
  ✓ Squad planning complete

  Worktree ready at: .worktrees/rally-42/
  To work with Squad: cd .worktrees/rally-42/
```

#### `rally dashboard` (full-screen Ink app)

```
┌──────────────────────────── Rally Dashboard ────────────────────────────┐
│                                                                              │
│  Active Dispatches                                                           │
│  ─────────────────────────────────────────────────────────────────────────── │
│  Project    Issue   Branch                         Status          Age       │
│  ───────    ─────   ──────                         ──────          ───       │
│▸ my-app     #42     rally/42-add-user-auth    ◆ implementing  2h       │
│  my-app     #51     rally/51-fix-login        ● planning      30m      │
│  api-srv    PR #87  feature/refactor-auth          ● reviewing     1d       │
│  my-app     #38     rally/38-update-deps      ✓ done          3d       │
│                                                                              │
│  3 active · 1 done · 0 blocked                                              │
│                                                                              │
│  ────────────────────────────────────────────────────────────────────────── │
│  q quit · r refresh · c clean done · ↑↓ select · enter open                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Non-TTY (piped) output example

```
$ rally dashboard | cat
Rally Dashboard

Project    Issue   Branch                              Status        Age
-------    -----   ------                              ------        ---
my-app     #42     rally/42-add-user-auth         implementing  2h
my-app     #51     rally/51-fix-login-bug         planning      30m
api-srv    PR #87  feature/refactor-auth               reviewing     1d

3 active · 0 done · 0 blocked
```

---

### 5.6 Implementation Notes

1. **All UI code lives in `lib/ui/`.** Components are Ink (React) components in `lib/ui/components/`. The dashboard is `lib/ui/Dashboard.jsx`. Command modules import from `lib/ui/` — they never write raw ANSI codes directly.

2. **Chalk is the styling foundation.** Every component uses Chalk for colors. Chalk handles TTY detection, `NO_COLOR`, and `FORCE_COLOR` automatically — no manual branching needed.

3. **Ora handles all spinners.** No custom spinner implementation. Ora provides braille-dot animation, TTY detection, and graceful fallback out of the box.

4. **Commander handles CLI parsing.** The entry point (`bin/rally.js`) uses Commander for argument parsing, subcommand routing, help generation, and version display. No manual `process.argv` parsing.

5. **js-yaml handles config files.** The `config.js` module uses `js-yaml` for parsing and serializing YAML. No custom YAML parser needed.

6. **@inquirer/prompts handles interactive input.** Team selection prompts and confirmations use @inquirer/prompts. Non-TTY fallback uses flag defaults.

7. **Ink manages the dashboard lifecycle.** The dashboard is a full Ink app with React state. Ink handles screen buffer management, resize events, and cleanup on exit (including `SIGINT`/`SIGTERM`).

8. **Windows compatibility.** Chalk and Ink handle Windows Terminal compatibility automatically. Legacy `cmd.exe` without Windows Terminal may not support all features — Chalk's TTY detection handles this gracefully.

---

## 6. Integration Points

### 6.1 Squad
- **Setup:** Runs `npx github:bradygaster/squad` to initialize team state
- **Export/Import:** Future enhancement — `rally setup --from <export.json>` could use Squad's `export`/`import` to bootstrap from an existing team snapshot
- **Invocation:** After worktree setup, Rally invokes Squad within the worktree context. The exact invocation mechanism (Copilot agent mode, CLI, etc.) is an open question (see §9).

### 6.2 Git
- **Worktrees:** `git worktree add <path> -b <branch>` and `git worktree remove <path>`
- **Exclude:** Direct file write to `.git/info/exclude`
- **Branches:** `git branch`, `git checkout`
- **Symlinks:** `fs.symlinkSync()` with platform-appropriate handling

### 6.3 GitHub CLI (`gh`)
- **Issues:** `gh issue view <n> --json title,body,labels,assignees`
- **PRs:** `gh pr view <n> --json title,body,headRefName,baseRefName,changedFiles`
- **PR creation:** Future — `gh pr create` after implementation is complete
- **Auth check:** `gh auth status`

### 6.4 Platform
- **Symlinks on Windows:** Requires Developer Mode or admin privileges. Rally should detect and provide clear error messages.
- **Path separators:** All paths use `path.join()` — never hardcoded separators.

---

## 7. Non-Goals

1. **Rally does not replace Squad.** It orchestrates Squad — it doesn't duplicate any Squad functionality (no team management, no agent definitions, no skills).
2. **Rally does not manage git branching strategy.** It creates branches with a `rally/` prefix, but it doesn't enforce merge strategies or branch protection.
3. **Rally does not implement AI agents.** It sets up the environment and invokes Squad. The actual AI work (planning, coding, reviewing) is Squad's responsibility.
4. **Rally does not commit Squad files.** The entire point is keeping the repo clean. If you want committed Squad state, use vanilla Squad.
5. **Rally does not manage advanced team configurations.** v1 supports choosing between a shared team and a project-specific team at onboard time. More advanced setups (team overlays, partial sharing, team migration between projects) are future considerations.
6. **Rally does not provide a GUI or web dashboard.** Terminal-only for v1.

---

## 8. Technical Constraints

| Constraint | Detail |
|-----------|--------|
| **Runtime** | Node.js (minimum version TBD — at least v18 for stable built-in test runner) |
| **Dependencies** | Curated set of production-quality npm packages (see §5.0). Node.js built-ins (`fs`, `path`, `os`, `child_process`) plus Ink, Chalk, Ora, Commander, js-yaml, @inquirer/prompts. |
| **Test framework** | `node:test` + `node:assert/strict` |
| **Platforms** | Windows, macOS, Linux. All paths via `path.join()`. Symlink handling must account for Windows. |
| **External tools** | Requires `git` and `gh` (GitHub CLI) on PATH. Requires `npx` for Squad installation. |
| **Error handling** | `fatal(msg)` pattern — clean user-facing messages, no stack traces. |
| **Idempotency** | All commands must be safe to re-run. Skip-if-exists pattern throughout. |
| **Output style** | `✓` for success, `✗` for errors, dim text for skipped operations. Chalk for styling. |

---

## 9. Open Questions

### 9.1 How does Rally invoke Squad after worktree setup?
Squad is normally invoked via Copilot agent mode in the IDE. When Rally creates a worktree and sets up context, how does the user actually start working with Squad?
- **Option A:** Rally just sets up the environment and prints instructions ("cd into worktree, open in editor, start Copilot")
- **Option B:** Rally invokes a Squad CLI command directly
- **Option C:** Rally opens the worktree in VS Code with Copilot agent mode activated

### 9.2 Per-project vs. shared team state? *(Partially resolved)*
The `onboard` command now prompts users to choose between a shared team and a project-specific team. This resolves the basic question of "should we support both?" — yes, via a prompt at onboard time.

**What's been decided:**
- Users choose at onboard time: shared team (`~/.rally/team/`) or project-specific team (`~/.rally/teams/<project>/`)
- Project-specific teams get a fresh Squad init — independent `.squad/` state, decisions, history
- The `--team <shared|new>` flag allows scripting without the prompt
- `projects.yaml` tracks which team type each project uses

**What remains open:**
- **Migration:** Can a project switch from shared to project-specific (or vice versa) after onboarding? What happens to accumulated history/decisions?
- **Team templates:** Should `rally onboard --team new` support `--from <export.json>` to bootstrap a project-specific team from a Squad export?
- **Base team + overlays (Option C from original question):** The current design is all-or-nothing. A layered approach (shared base + project-specific overrides) might be valuable but adds complexity. Defer to v2.

### 9.3 Worktree location
- **Option A:** Inside the repo at `.worktrees/` (current design — easy to find, but adds a directory to the repo root)
- **Option B:** Outside the repo at `~/.rally/worktrees/<project>/` (clean repo, but harder to navigate)
- **Option C:** Sibling to the repo at `../<repo>-worktrees/` (git's default suggestion)

### 9.4 Dispatch context format
What goes in `.squad/dispatch-context.md`? How structured should it be?
- Issue title, body, labels, comments?
- For PRs: diff stats, file list, review comments?
- Should it reference existing Squad skills or decisions?

### 9.5 Status tracking granularity
Current design has 5 statuses (`planning` → `implementing` → `reviewing` → `done` → `cleaned`). Is this enough? Should status be inferred from git state (branch merged = done) or manually set?

### 9.6 Dashboard clean behavior
Should `dashboard clean` delete the branch too? Just the worktree? Should it require confirmation?

### 9.7 Windows symlink permissions
Windows requires Developer Mode or elevated privileges for symlinks. Should Rally:
- Detect and error clearly?
- Fall back to directory junctions?
- Fall back to copying instead of symlinking?

### 9.8 Squad export/import integration
Should `rally setup` accept a Squad export JSON to bootstrap from an existing team? This would enable team sharing without committing state:
```bash
rally setup --from teammate-export.json
```

---

## Appendix A: Command Summary

| Command | Description |
|---------|-------------|
| `rally setup` | Initialize external Squad team state |
| `rally onboard` | Connect a repo to your team via symlinks |
| `rally dispatch issue <issue>` | Dispatch Squad to a GitHub issue |
| `rally dispatch pr <pr>` | Dispatch Squad to review a PR |
| `rally dashboard` | View all active dispatches |
| `rally dashboard clean` | Clean up completed dispatches |

## Appendix B: Key Techniques

### The Symlink + Exclude Pattern (from Tamir Dresher)
1. Squad state lives outside the repo in a dedicated directory
2. Symlinks bring it into the working directory so tools find it at expected paths
3. `.git/info/exclude` hides symlinks from git — local-only, never committed
4. On Windows, exclude needs both forms: `name` and `name/`
5. Exclude entries in main `.git/` apply to all worktrees — set up once, works everywhere

### Worktree Lifecycle
1. `git worktree add .worktrees/rally-N -b rally/N-slug` — create
2. Symlink Squad files into worktree
3. Work happens in the worktree
4. `git worktree remove .worktrees/rally-N` — clean up
5. `git branch -d rally/N-slug` — optional branch cleanup
