# Project Context

- **Owner:** James Sturtevant
- **Project:** Rally — a CLI tool that dispatches Squad teams to GitHub issues and PR reviews via git worktrees
- **Stack:** Node.js with curated npm packages (Ink, Chalk, Ora, Commander, js-yaml, @inquirer/prompts) + node:test for testing
- **Created:** 2026-02-21

## Project Description

Rally is a command line tool that works with Squad. Key commands:
- **setup** — Sets up Squad outside of a repo
- **onboard** — Onboards a new team to a repo without committing the files
- **dispatch** — Takes a GitHub issue, creates a worktree, adds the Squad, has them plan, iterate, add tests, and do code reviews
- **PR review** — Similar dispatch flow for PR reviews
- **dashboard** — Shows all active projects with worktrees and active teams

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-02-21 — PRD Draft & Architecture

- **All implementation begins with** `docs/PRD.md` — comprehensive spec covering 5 commands with CLI specs, error cases, state models, and open questions.
- **State model:** Three JSON files under `~/.rally/` — `config.json`, `projects.json`, `active.json`. Simple, zero-dep, file-based.
- **Core technique:** Symlink + `.git/info/exclude` (from Tamir Dresher's pattern). Foundation for `onboard` command.
- **Worktree location:** `.worktrees/rally-<N>/` with branch naming `rally/<N>-<slug>`.
- **Module structure:** `bin/rally.js` entry + `lib/` modules per command + shared utilities.
- **Key decisions:** Three-file state, worktrees inside repo, module-per-command. Open questions logged in PRD §8.
- **Target user clarification (2026-02-21):** Solo developers on shared/OSS repos, NOT teams adopting Squad together. Individual using Squad where rest of team doesn't — e.g., open source projects or large shared repos where committing `.squad/` is inappropriate.
- **No CI/CD for Rally (2026-02-21):** Zero CI/CD integration. No GitHub Actions, no pipeline triggers, no automated invocation. This is a manual CLI tool.


### 2026-02-21 22:47 — Config format: YAML not JSON
- User directive: all Rally config files use YAML, not JSON
- **UPDATE (2026-02-22):** `js-yaml` package now used (dependency pivot). No hand-rolled YAML parser needed.
- See `.squad/decisions.md` → "Decision: Config file format changed from JSON to YAML"

### 2026-02-22 — Onboard Expansion (§3.2) & Dispatch Subcommands (§3.3–3.4)

**From Mal (Lead):**
- **Onboard expansion:** Now accepts GitHub URLs (`https://github.com/owner/repo` or `owner/repo`), clones into configurable `projectsDir` (default: `~/.rally/projects/`). User selects team type at onboard: shared (`~/.rally/team/`) or project-specific (`~/.rally/teams/<project>/`). Flag: `--team <shared|new>`. `projects.yaml` schema expanded to track `team` and `teamDir`.
- **Dispatch subcommands:** Explicit subcommands `rally dispatch issue <number>` and `rally dispatch pr <number>` (was implicit + `--pr` flag). Both accept `--repo <owner/repo>` with fallback inference logic. Sections §3.3, §3.4, §4.2 updated in PRD.
- **State layout:** `~/.rally/` gains `teams/` (project-specific) and `projects/` (cloned repos).
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

### 2026-02-22 01:13 — PRD Decomposition Complete: 29 Work Items Across 5 Phases

**From Mal (Lead) → Scribe (merged to decisions.md):**

**Status:** PRD design complete. All blockers resolved. Work decomposition finalized. **Ready for implementation.**

**29 GitHub Issues Created (#1–#29):**
- **Phase 1: Foundation (8 issues #1–#8)** — Project scaffold, config.js YAML module, symlink.js (cross-platform), exclude.js (.git/info/exclude), worktree.js (git operations), github.js (gh CLI), bin/rally.js (CLI entry with Commander), test infrastructure
- **Phase 2: Core Commands (5 issues #9–#13)** — setup command, onboard (local repos), onboard (GitHub URLs + clone), team selection prompt, status debug command
- **Phase 3: Dispatch (6 issues #14–#19)** — dispatch.js core module, dispatch issue workflow, dispatch PR workflow, dispatch-context.md template writer, Copilot CLI invocation, active.yaml dispatch tracking
- **Phase 4: Dashboard (6 issues #20–#25)** — StatusMessage & DispatchBox UI components (Ink), DispatchTable component, dashboard main view, keyboard navigation, dashboard clean command, TTY graceful degradation
- **Phase 5: Polish (4 issues #26–#29)** — Comprehensive error handling, edge cases & idempotency, user documentation, E2E integration tests

**Ownership for Kaylee:** 17 issues (core implementation across all phases)

**Parallelization Strategy:**
- **Phase 1 utilities can run in parallel:** config, symlink, exclude, worktree, github modules are independent
- **Phase 2 depends on Phase 1:** setup and onboard independent once utilities exist
- **Phase 3 depends on Phase 1–2:** dispatch depends on onboard + worktree + github utils
- **Phase 4 depends on Phase 3:** dashboard depends on dispatch (needs active.yaml)

**All 3 Critical Blockers Now Resolved:**
1. ✓ **Squad invocation:** Automated Copilot CLI invocation (not instructions-only)
2. ✓ **Windows symlinks:** Hard error with Developer Mode message (no fallback in v1)
3. ✓ **dispatch-context.md:** Simple markdown template with issue/PR details, files changed, instructions

**What This Means for You:**
- Begin with Phase 1 foundation modules (all 8 can be developed in parallel)
- Review `docs/PRD.md` §4.3 (module structure) and §5 (Ink/Chalk/Ora/Commander architecture) before starting
- Use Ink for terminal rendering—no raw ANSI codes in app code
- GitHub issues #1–#29 are ready for sprint planning on jsturtevant/rally
- See `.squad/decisions.md` → "Decision: PRD Decomposition into 29 Work Items" for full details

**Next Action:** After blockers confirmed in PRD update, begin Phase 1 implementation (target: parallel development across utilities)

### 2026-02-22 — Team Notification: Project Scaffold Complete

**From Scribe (cross-agent update):**

Decision inbox merged into `decisions.md`. Scaffold phase complete.

**What Happened:**
1. ✓ Mal (Lead): Updated PRD blockers, created design checklist skill
2. ✓ Jayne (Tester): Wrote docs/TESTING.md and error catalog
3. ✓ Kaylee (Core Dev): Scaffolded project (package.json, bin/rally.js, smoke test)

All decisions documented and merged. You (Kaylee) are unblocked to begin Phase 1 foundation modules. All utilities can be developed in parallel:
- config.js, symlink.js, exclude.js, worktree.js, github.js, CLI entry (bin/rally.js with Commander)

See GitHub issues #1–#8 (Phase 1) for detailed specs. All blockers resolved—ready to implement.
