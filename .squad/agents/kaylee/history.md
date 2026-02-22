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
- **UPDATE (2026-02-22):** `js-yaml` package now used (dependency pivot). No hand-rolled YAML parser needed.
- See `.squad/decisions.md` → "Decision: Config file format changed from JSON to YAML"

### 2026-02-22 — Onboard Expansion (§3.2) & Dispatch Subcommands (§3.3–3.4)

**From Mal (Lead):**
- **Onboard expansion:** Now accepts GitHub URLs (`https://github.com/owner/repo` or `owner/repo`), clones into configurable `projectsDir` (default: `~/.dispatcher/projects/`). User selects team type at onboard: shared (`~/.dispatcher/team/`) or project-specific (`~/.dispatcher/teams/<project>/`). Flag: `--team <shared|new>`. `projects.yaml` schema expanded to track `team` and `teamDir`.
- **Dispatch subcommands:** Explicit subcommands `dispatcher dispatch issue <number>` and `dispatcher dispatch pr <number>` (was implicit + `--pr` flag). Both accept `--repo <owner/repo>` with fallback inference logic. Sections §3.3, §3.4, §4.2 updated in PRD.
- **State layout:** `~/.dispatcher/` gains `teams/` (project-specific) and `projects/` (cloned repos).
- **See:** `.squad/decisions.md` → "Onboard Command Expansion" and "Dispatch uses explicit subcommands"

**What this means for you:**
- Review `docs/PRD.md` §3.2, §3.3, §3.4, §4.1, §4.2 before implementing
- `lib/onboard.js` must handle GitHub URL parsing, git clone, team selection prompt
- `lib/dispatch.js` must route explicit subcommands and infer repo from context

### 2026-02-22 — Dependency Pivot & CLI Structure Review Complete

**From Mal (Lead):**
- **Major pivot:** User approved dependencies. Adopt Ink, Chalk, Ora, Commander, js-yaml, @inquirer/prompts (same stack as GitHub Copilot CLI/Claude Code CLI). This eliminates hand-rolled UI modules. See `.squad/decisions.md` → "Decision: Dependency Pivot".
- **Terminal UI reframed:** `lib/ui/` becomes directory of Ink component wrappers (colors, box, table, spinner, progress, prompt, status, dashboard) instead of raw ANSI codes. See `.squad/decisions.md` → "Decision: Terminal UI/UX — Ink/Chalk Component System".

**CLI Structure Review (Kaylee):**
- ✓ CLI structure maps cleanly to Commander/Ink
- ✓ Dispatch subcommands route correctly
- ✓ Module-per-command pattern holds
- 🔴 **1 blocker:** Charter says "zero-dependency" but PRD now specifies Ink/Chalk/etc. **RESOLVED** by Dependency Pivot decision (above). Update charter.md.
- 🟡 7 concerns: Subcommand routing, Ink lifecycle, dashboard state, terminal capability detection, progress animation, error consistency, input validation.
- 🟢 4 nice-to-haves: Decorators, logging utility, hot-reload, composition helpers.

**PRD Review (4-agent cycle):**
- ✓ PRD architecturally sound
- 🔴 **5 critical blockers in PRD §9 must resolve before implementation:** gh CLI fields, Windows symlinks, Squad invocation, status lifecycle, context.md format.
- 🟡 12+ error-handling gaps, 20+ edge cases, test framework not specified (Jayne findings).

**What this means for you:**
- Use Ink for terminal rendering, Chalk for colors, Ora for spinners—no raw ANSI codes in app code
- Review PRD §5 (Ink component architecture) and §4.3 (module structure) before implementing
- Await blocker resolution before full implementation (target: after Mal decision sync)

### 2026-02-22 02:28 — Charter Updated: Zero-Dependency References Removed

**From Scribe (cross-agent propagation):**
- **Charter refresh:** All "zero-dependency" language removed from `.squad/agents/kaylee/charter.md`. 
  - "How I Work" section now explicitly lists production CLI stack: Ink, Chalk, Ora, Commander, js-yaml, @inquirer/prompts
  - Voice section reinforced: Loves clean code, excited about elegant solutions, follows squad-conventions skill to the letter, uses production CLI stack — no hand-rolled modules
- **Why:** Post-dependency pivot, all stale zero-dep docs have been cleaned across `.squad/` and `docs/`
- **Impact:** Your charter is now fully aligned with current architecture. Reference it with confidence.
