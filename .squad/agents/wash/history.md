# Project Context

- **Owner:** James Sturtevant
- **Project:** Dispatcher — a CLI tool that dispatches Squad teams to GitHub issues and PR reviews via git worktrees
- **Stack:** Node.js with curated npm packages (Ink, Chalk, Ora, Commander, js-yaml, @inquirer/prompts) + node:test for testing
- **Created:** 2026-02-21

## Project Description

Dispatcher is a command line tool that works with Squad. Key commands:
- **setup** — Sets up Squad outside of a repo
- **onboard** — Onboards a new team to a repo without committing the files
- **dispatch** — Takes a GitHub issue, creates a worktree, adds the Squad, has them plan, iterate, add tests, and do code reviews
- **PR review** — Similar dispatch flow for PR reviews
- **dashboard** — Shows all active projects with worktrees and active teams

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-02-21 — PRD Draft & Architecture

- **All implementation begins with** `docs/PRD.md` — comprehensive spec covering 5 commands with CLI specs, error cases, state models, and open questions.
- **State model:** Three JSON files under `~/.dispatcher/` — `config.json`, `projects.json`, `active.json`. Simple, zero-dep, file-based.
- **Core technique:** Symlink + `.git/info/exclude` (from Tamir Dresher's pattern). Foundation for `onboard` command.
- **Worktree location:** `.worktrees/dispatcher-<N>/` with branch naming `dispatcher/<N>-<slug>`.
- **Module structure:** `bin/dispatcher.js` entry + `lib/` modules per command + shared utilities.
- **Key decisions:** Three-file state, worktrees inside repo, module-per-command. Open questions logged in PRD §8.
- **Target user clarification (2026-02-21):** Solo developers on shared/OSS repos, NOT teams adopting Squad together. Individual using Squad where rest of team doesn't — e.g., open source projects or large shared repos where committing `.squad/` is inappropriate.
- **No CI/CD for Dispatcher (2026-02-21):** Zero CI/CD integration. No GitHub Actions, no pipeline triggers, no automated invocation. This is a manual CLI tool.


### 2026-02-21 22:47 — Config format: YAML not JSON
- User directive: all Dispatcher config files use YAML, not JSON
- See `.squad/decisions.md` → "Decision: Config file format changed from JSON to YAML"

### 2026-02-22 — Onboard Expansion (§3.2) & Dispatch Subcommands (§3.3–3.4)

**From Mal (Lead):**
- **Onboard expansion:** Now accepts GitHub URLs (`https://github.com/owner/repo` or `owner/repo`), clones into configurable `projectsDir` (default: `~/.dispatcher/projects/`). User selects team type at onboard: shared (`~/.dispatcher/team/`) or project-specific (`~/.dispatcher/teams/<project>/`). Flag: `--team <shared|new>`. `projects.yaml` schema expanded to track `team` and `teamDir`.
- **Dispatch subcommands:** Explicit subcommands `dispatcher dispatch issue <number>` and `dispatcher dispatch pr <number>` (was implicit + `--pr` flag). Both accept `--repo <owner/repo>` with fallback inference logic. Sections §3.3, §3.4, §4.2 updated in PRD.
- **State layout:** `~/.dispatcher/` gains `teams/` (project-specific) and `projects/` (cloned repos).
- **See:** `.squad/decisions.md` → "Onboard Command Expansion" and "Dispatch uses explicit subcommands"

**What this means for you:**
- Review `docs/PRD.md` §3.2, §3.3, §3.4, §4.1, §4.2 before implementing
- `lib/setup.js` must create `projectsDir` (default: `~/.dispatcher/projects/`) and `teams/` directory
- `lib/config.js` must handle new `projectsDir` key in YAML config

### 2026-02-22 — PRD Git/GitHub Integration Review (Wash)

**Reviewed:** docs/PRD.md for git/GitHub integration feasibility and correctness.

**Findings summary:**
- **1 Blocker:** `gh` CLI field names inconsistent between §3.3 and §6.3. Issues: §3.3 uses `labels` but §6.3 adds `assignees`. PRs: §3.3 uses `files` but §6.3 uses `changedFiles`. These are different objects—must decide which semantics are needed and align PRD.
- **5 Concerns:** Windows exclude entries (file vs directory symlinks need different forms), worktree cleanup with uncommitted changes (error handling not specified), symlink redundancy (worktree inherits main repo excludes—confirm if we symlink twice), stale "zero-dependency" claims in history/decisions (PRD now uses js-yaml and multiple packages), PR state validation (behavior doesn't explicitly mention checking `state` field).
- **1 Nice-to-have:** Repo inference edge case UX (inform user which repo was selected when multiple exist).

**Key decision needed:** Resolve gh CLI field names before implementation. See `.squad/decisions.md` → "PRD Review Findings" for summary, and full details in prior inbox review.

### 2026-02-22 — Dependency Pivot & PRD Review Cycle Complete

**From Mal (Lead):**
- **Major pivot:** User approved dependencies. Adopt Ink, Chalk, Ora, Commander, js-yaml, @inquirer/prompts (same stack as GitHub Copilot CLI/Claude Code CLI). This eliminates hand-rolled UI modules and YAML parser. See `.squad/decisions.md` → "Decision: Dependency Pivot" for full rationale.
- **Terminal UI reframed:** `lib/ui/` becomes directory of Ink component wrappers instead of raw ANSI codes. See `.squad/decisions.md` → "Decision: Terminal UI/UX — Ink/Chalk Component System".

**PRD Review Summary (all 4 agents):**
- ✓ PRD is architecturally sound and internally consistent
- ✓ Integration feasible, CLI structure maps cleanly
- 🔴 **5 critical blockers in PRD §9 (open questions) must be resolved before implementation:**
  1. gh CLI field names (Wash concern → team blocker now)
  2. Windows symlink fallback strategy (Jayne blocker)
  3. Squad invocation mechanism (Jayne blocker)
  4. Dispatch status lifecycle rules (Jayne blocker)
  5. dispatch-context.md format specification (Jayne blocker)
- 🟡 12+ error-handling gaps, 20+ edge cases, test framework not specified (Jayne findings)

**Next steps:**
- Mal: Schedule decision sync to resolve 5 blockers
- Kaylee/Wash: Await blocker resolution before implementation
- Jayne: Await blocker resolution, then write test suite and `docs/TESTING.md`

See `.squad/decisions.md` → "PRD Review Findings" for full status and team action items.
