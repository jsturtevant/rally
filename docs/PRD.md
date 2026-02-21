# Dispatcher — Product Requirements Document

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

Dispatcher solves all four. One CLI, five commands.

---

## 2. Target Users

### Primary: Solo developers and small teams using Squad
- Already have Squad installed or want to start using it
- Work on repos where committing `.squad/` is undesirable (open source, shared repos, corporate repos)
- Want to parallelize work across multiple issues using worktrees

### Secondary: CI/CD pipelines
- `dispatch` can be triggered from GitHub Actions on issue assignment
- `dashboard` output can feed monitoring

### Non-users
- People who don't use Squad (Dispatcher is tightly coupled to Squad)
- People who want Squad committed to their repo (they don't need Dispatcher — vanilla Squad works fine)

---

## 3. Commands & Workflows

### 3.1 `dispatcher setup`

**Purpose:** Initialize Squad team state in an external directory (outside any repo). This is the "portable team" that gets symlinked into projects.

**Usage:**
```bash
dispatcher setup [--dir <path>]
```

**Behavior:**
1. Create a directory for external team state (default: `~/.dispatcher/team/`)
2. Run `npx github:bradygaster/squad` inside that directory to generate the full `.squad/` tree, `.squad-templates/`, and `.github/agents/squad.agent.md`
3. Store the setup path in `~/.dispatcher/config.json`

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--dir <path>` | `~/.dispatcher/team/` | Where to create external team state |

**Example:**
```bash
$ dispatcher setup
✓ Created team directory at ~/.dispatcher/team/
✓ Initialized Squad in ~/.dispatcher/team/
✓ Saved config to ~/.dispatcher/config.json
```

**Output on re-run (idempotent):**
```bash
$ dispatcher setup
  Team directory already exists — skipping
  Squad already initialized — skipping
✓ Config verified
```

**Config file (`~/.dispatcher/config.json`):**
```json
{
  "teamDir": "/home/user/.dispatcher/team",
  "version": "0.1.0"
}
```

**Error cases:**
- Squad not installed → `✗ Squad not found. Install with: npx github:bradygaster/squad`
- No write permission → `✗ Cannot write to <path>: permission denied`

---

### 3.2 `dispatcher onboard`

**Purpose:** Connect a repo to your external Squad team without committing anything. Uses symlinks + `.git/info/exclude`.

**Precondition:** `dispatcher setup` has been run.

**Usage:**
```bash
dispatcher onboard [--repo <path>]
```

**Behavior:**
1. Read `~/.dispatcher/config.json` to find team directory
2. In the target repo (default: cwd), create symlinks:
   - `.squad/` → `<teamDir>/.squad/`
   - `.squad-templates/` → `<teamDir>/.squad-templates/`
   - `.github/agents/squad.agent.md` → `<teamDir>/.github/agents/squad.agent.md`
3. Add entries to `.git/info/exclude` (NOT `.gitignore` — local only, never committed):
   ```
   # Dispatcher — Squad symlinks
   .squad
   .squad/
   .squad-templates
   .squad-templates/
   .github/agents/squad.agent.md
   ```
4. Register the repo in `~/.dispatcher/projects.json`

**Why `.git/info/exclude`?**
From Tamir Dresher's technique: `.git/info/exclude` works identically to `.gitignore` but is local-only. It's never committed, so the repo stays clean. On Windows, both the symlink name and the directory form need separate entries (e.g., `.squad` and `.squad/`).

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--repo <path>` | `.` (cwd) | Path to the repo to onboard |

**Example:**
```bash
$ cd ~/projects/my-app
$ dispatcher onboard
✓ Symlinked .squad/ → ~/.dispatcher/team/.squad/
✓ Symlinked .squad-templates/ → ~/.dispatcher/team/.squad-templates/
✓ Symlinked .github/agents/squad.agent.md → ~/.dispatcher/team/.github/agents/squad.agent.md
✓ Updated .git/info/exclude
✓ Registered project: my-app
```

**Idempotent:** If symlinks already exist and point to the right place, skip and report.

**Error cases:**
- Not inside a git repo → `✗ Not a git repository. Run from inside a repo.`
- Setup not run → `✗ No team directory found. Run: dispatcher setup`
- Symlink target doesn't exist → `✗ Team directory missing: <path>. Run: dispatcher setup`

**Projects registry (`~/.dispatcher/projects.json`):**
```json
{
  "projects": [
    {
      "name": "my-app",
      "path": "/home/user/projects/my-app",
      "onboarded": "2026-02-21T10:00:00Z"
    }
  ]
}
```

---

### 3.3 `dispatcher dispatch` (Issue Mode)

**Purpose:** Take a GitHub issue and run the full Squad lifecycle: branch → worktree → plan → implement → test → review → PR.

**Precondition:** Repo is onboarded (`dispatcher onboard` has been run).

**Usage:**
```bash
dispatcher dispatch <issue-number> [--repo <path>]
```

**Behavior:**
1. Fetch issue metadata from GitHub (`gh issue view <number> --json title,body,labels`)
2. Create a branch named `dispatcher/<issue-number>-<slug>` from the default branch
3. Create a git worktree at `<repo>/.worktrees/dispatcher-<issue-number>/`
4. Symlink Squad files into the worktree (leverages `.git/info/exclude` entries from `onboard` — they apply to all worktrees automatically)
5. Write issue context to `.squad/dispatch-context.md` in the worktree
6. Invoke Squad to plan: `npx github:bradygaster/squad` with issue context
7. Log the dispatch to `~/.dispatcher/active.json`

**The worktree + exclude trick:**
Git exclude entries in the main `.git/info/exclude` apply to ALL worktrees. This is why `onboard` is a separate step — it sets up excludes once, and every worktree benefits.

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--repo <path>` | `.` (cwd) | Path to the repo |
| `--base <branch>` | default branch | Branch to create worktree from |
| `--no-plan` | `false` | Skip automatic planning step |

**Example:**
```bash
$ dispatcher dispatch 42
✓ Fetched issue #42: "Add user authentication"
✓ Created branch: dispatcher/42-add-user-authentication
✓ Created worktree: .worktrees/dispatcher-42/
✓ Symlinked Squad into worktree
✓ Wrote dispatch context
✓ Squad is planning…

  Worktree ready at: .worktrees/dispatcher-42/
  To work with Squad: cd .worktrees/dispatcher-42/
```

**Active dispatch registry (`~/.dispatcher/active.json`):**
```json
{
  "dispatches": [
    {
      "id": "my-app-42",
      "repo": "/home/user/projects/my-app",
      "issue": 42,
      "branch": "dispatcher/42-add-user-authentication",
      "worktree": "/home/user/projects/my-app/.worktrees/dispatcher-42",
      "status": "planning",
      "created": "2026-02-21T10:30:00Z"
    }
  ]
}
```

**Statuses:** `planning` → `implementing` → `reviewing` → `done` → `cleaned`

**Error cases:**
- Issue not found → `✗ Issue #42 not found. Check the issue number and repo.`
- Repo not onboarded → `✗ Repo not onboarded. Run: dispatcher onboard`
- Worktree already exists → `✗ Worktree for issue #42 already exists at .worktrees/dispatcher-42/`
- `gh` CLI not installed → `✗ GitHub CLI (gh) not found. Install from: https://cli.github.com`
- Not authenticated → `✗ Not authenticated with GitHub. Run: gh auth login`

---

### 3.4 `dispatcher dispatch --pr` (PR Review Mode)

**Purpose:** Dispatch Squad to review an existing pull request.

**Usage:**
```bash
dispatcher dispatch --pr <pr-number> [--repo <path>]
```

**Behavior:**
1. Fetch PR metadata from GitHub (`gh pr view <number> --json title,body,headRefName,baseRefName,files`)
2. Create a worktree from the PR's head branch at `.worktrees/dispatcher-pr-<number>/`
3. Symlink Squad into the worktree
4. Write PR context (diff summary, changed files, PR description) to `.squad/dispatch-context.md`
5. Invoke Squad with a review-focused prompt
6. Log to `~/.dispatcher/active.json` with status `reviewing`

**Example:**
```bash
$ dispatcher dispatch --pr 87
✓ Fetched PR #87: "Refactor auth middleware"
✓ Created worktree from branch: feature/refactor-auth
✓ Symlinked Squad into worktree
✓ Wrote review context (12 files changed)
✓ Squad is reviewing…

  Worktree ready at: .worktrees/dispatcher-pr-87/
```

**Error cases:**
- PR not found → `✗ PR #87 not found.`
- PR already merged → `✗ PR #87 is already merged.`
- PR closed → `✗ PR #87 is closed.`

---

### 3.5 `dispatcher dashboard`

**Purpose:** Show all active dispatches across all onboarded projects.

**Usage:**
```bash
dispatcher dashboard
```

**Behavior:**
1. Read `~/.dispatcher/active.json`
2. For each active dispatch, check worktree health (does it still exist?)
3. Display a table of active work

**Example output:**
```
Dispatcher Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Project    Issue   Branch                              Status       Age
 ───────    ─────   ──────                              ──────       ───
 my-app     #42     dispatcher/42-add-user-auth         implementing 2h
 my-app     #51     dispatcher/51-fix-login-bug         planning     30m
 api-srv    PR #87  feature/refactor-auth               reviewing    1d
 my-app     #38     dispatcher/38-update-deps           done         3d

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
dispatcher dashboard clean           # Remove 'done' dispatches and delete their worktrees
dispatcher dashboard clean --all     # Remove ALL dispatches and worktrees
```

---

## 4. Architecture

### 4.1 State Layout

```
~/.dispatcher/
├── config.json          # Global config (team directory path)
├── projects.json        # Registry of onboarded projects
├── active.json          # Active dispatches across all projects
└── team/                # External Squad team state
    ├── .squad/
    ├── .squad-templates/
    └── .github/
        └── agents/
            └── squad.agent.md

~/projects/my-app/                   # An onboarded project
├── .squad/ → ~/.dispatcher/team/.squad/           (symlink)
├── .squad-templates/ → ~/.dispatcher/team/...     (symlink)
├── .github/agents/squad.agent.md → ...            (symlink)
├── .git/
│   └── info/
│       └── exclude                  # Contains Squad symlink patterns
└── .worktrees/
    ├── dispatcher-42/               # Worktree for issue #42
    │   ├── .squad/ → ...            (symlink)
    │   └── (project files)
    └── dispatcher-pr-87/            # Worktree for PR review
```

### 4.2 Data Flow

```
dispatcher setup
  └─→ Creates ~/.dispatcher/team/ with Squad files
  └─→ Writes ~/.dispatcher/config.json

dispatcher onboard
  └─→ Reads config.json
  └─→ Creates symlinks in repo
  └─→ Updates .git/info/exclude
  └─→ Writes to projects.json

dispatcher dispatch <issue>
  └─→ Reads config.json, projects.json
  └─→ Calls gh CLI for issue data
  └─→ Creates branch + worktree
  └─→ Symlinks Squad into worktree
  └─→ Writes dispatch-context.md
  └─→ Invokes Squad
  └─→ Updates active.json

dispatcher dashboard
  └─→ Reads active.json
  └─→ Validates worktree health
  └─→ Renders table
```

### 4.3 Module Structure

```
dispatcher/
├── bin/
│   └── dispatcher.js        # Entry point, argument parsing
├── lib/
│   ├── setup.js             # setup command
│   ├── onboard.js           # onboard command
│   ├── dispatch.js          # dispatch command (issue + PR modes)
│   ├── dashboard.js         # dashboard command
│   ├── config.js            # Config read/write (~/.dispatcher/*.json)
│   ├── symlink.js           # Symlink creation + validation
│   ├── exclude.js           # .git/info/exclude management
│   ├── worktree.js          # Git worktree create/remove
│   ├── github.js            # GitHub CLI wrapper (issues, PRs)
│   └── ui.js                # ANSI colors, table rendering, spinners
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

## 5. Integration Points

### 5.1 Squad
- **Setup:** Runs `npx github:bradygaster/squad` to initialize team state
- **Export/Import:** Future enhancement — `dispatcher setup --from <export.json>` could use Squad's `export`/`import` to bootstrap from an existing team snapshot
- **Invocation:** After worktree setup, Dispatcher invokes Squad within the worktree context. The exact invocation mechanism (Copilot agent mode, CLI, etc.) is an open question (see §8).

### 5.2 Git
- **Worktrees:** `git worktree add <path> -b <branch>` and `git worktree remove <path>`
- **Exclude:** Direct file write to `.git/info/exclude`
- **Branches:** `git branch`, `git checkout`
- **Symlinks:** `fs.symlinkSync()` with platform-appropriate handling

### 5.3 GitHub CLI (`gh`)
- **Issues:** `gh issue view <n> --json title,body,labels,assignees`
- **PRs:** `gh pr view <n> --json title,body,headRefName,baseRefName,changedFiles`
- **PR creation:** Future — `gh pr create` after implementation is complete
- **Auth check:** `gh auth status`

### 5.4 Platform
- **Symlinks on Windows:** Requires Developer Mode or admin privileges. Dispatcher should detect and provide clear error messages.
- **Path separators:** All paths use `path.join()` — never hardcoded separators.

---

## 6. Non-Goals

1. **Dispatcher does not replace Squad.** It orchestrates Squad — it doesn't duplicate any Squad functionality (no team management, no agent definitions, no skills).
2. **Dispatcher does not manage git branching strategy.** It creates branches with a `dispatcher/` prefix, but it doesn't enforce merge strategies, branch protection, or CI gates.
3. **Dispatcher does not implement AI agents.** It sets up the environment and invokes Squad. The actual AI work (planning, coding, reviewing) is Squad's responsibility.
4. **Dispatcher does not commit Squad files.** The entire point is keeping the repo clean. If you want committed Squad state, use vanilla Squad.
5. **Dispatcher does not manage multiple team configurations.** v1 has one team directory. Multi-team support (different teams for different repos) is a future consideration.
6. **Dispatcher does not provide a GUI or web dashboard.** Terminal-only for v1.

---

## 7. Technical Constraints

| Constraint | Detail |
|-----------|--------|
| **Runtime** | Node.js (minimum version TBD — at least v18 for stable built-in test runner) |
| **Dependencies** | Zero runtime dependencies. Node.js built-ins only (`fs`, `path`, `os`, `child_process`). |
| **Test framework** | `node:test` + `node:assert/strict` |
| **Platforms** | Windows, macOS, Linux. All paths via `path.join()`. Symlink handling must account for Windows. |
| **External tools** | Requires `git` and `gh` (GitHub CLI) on PATH. Requires `npx` for Squad installation. |
| **Error handling** | `fatal(msg)` pattern — clean user-facing messages, no stack traces. |
| **Idempotency** | All commands must be safe to re-run. Skip-if-exists pattern throughout. |
| **Output style** | `✓` for success, `✗` for errors, dim text for skipped operations. ANSI color constants. |

---

## 8. Open Questions

### 8.1 How does Dispatcher invoke Squad after worktree setup?
Squad is normally invoked via Copilot agent mode in the IDE. When Dispatcher creates a worktree and sets up context, how does the user actually start working with Squad?
- **Option A:** Dispatcher just sets up the environment and prints instructions ("cd into worktree, open in editor, start Copilot")
- **Option B:** Dispatcher invokes a Squad CLI command directly
- **Option C:** Dispatcher opens the worktree in VS Code with Copilot agent mode activated

### 8.2 Per-project vs. shared team state?
Current design: one team directory shared across all projects. But different projects might want different team skills, decisions, or agent histories.
- **Option A:** Single shared team (v1, simple)
- **Option B:** Per-project team directories under `~/.dispatcher/teams/<project>/`
- **Option C:** Base team + per-project overlays

### 8.3 Worktree location
- **Option A:** Inside the repo at `.worktrees/` (current design — easy to find, but adds a directory to the repo root)
- **Option B:** Outside the repo at `~/.dispatcher/worktrees/<project>/` (clean repo, but harder to navigate)
- **Option C:** Sibling to the repo at `../<repo>-worktrees/` (git's default suggestion)

### 8.4 Dispatch context format
What goes in `.squad/dispatch-context.md`? How structured should it be?
- Issue title, body, labels, comments?
- For PRs: diff stats, file list, review comments?
- Should it reference existing Squad skills or decisions?

### 8.5 Status tracking granularity
Current design has 5 statuses (`planning` → `implementing` → `reviewing` → `done` → `cleaned`). Is this enough? Should status be inferred from git state (branch merged = done) or manually set?

### 8.6 Dashboard clean behavior
Should `dashboard clean` delete the branch too? Just the worktree? Should it require confirmation?

### 8.7 Windows symlink permissions
Windows requires Developer Mode or elevated privileges for symlinks. Should Dispatcher:
- Detect and error clearly?
- Fall back to directory junctions?
- Fall back to copying instead of symlinking?

### 8.8 Squad export/import integration
Should `dispatcher setup` accept a Squad export JSON to bootstrap from an existing team? This would enable team sharing without committing state:
```bash
dispatcher setup --from teammate-export.json
```

---

## Appendix A: Command Summary

| Command | Description |
|---------|-------------|
| `dispatcher setup` | Initialize external Squad team state |
| `dispatcher onboard` | Connect a repo to your team via symlinks |
| `dispatcher dispatch <issue>` | Dispatch Squad to a GitHub issue |
| `dispatcher dispatch --pr <pr>` | Dispatch Squad to review a PR |
| `dispatcher dashboard` | View all active dispatches |
| `dispatcher dashboard clean` | Clean up completed dispatches |

## Appendix B: Key Techniques

### The Symlink + Exclude Pattern (from Tamir Dresher)
1. Squad state lives outside the repo in a dedicated directory
2. Symlinks bring it into the working directory so tools find it at expected paths
3. `.git/info/exclude` hides symlinks from git — local-only, never committed
4. On Windows, exclude needs both forms: `name` and `name/`
5. Exclude entries in main `.git/` apply to all worktrees — set up once, works everywhere

### Worktree Lifecycle
1. `git worktree add .worktrees/dispatcher-N -b dispatcher/N-slug` — create
2. Symlink Squad files into worktree
3. Work happens in the worktree
4. `git worktree remove .worktrees/dispatcher-N` — clean up
5. `git branch -d dispatcher/N-slug` — optional branch cleanup
