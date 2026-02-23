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
- See `.squad/decisions.md` → "Decision: Config file format changed from JSON to YAML"

### 2026-02-22 — Onboard Expansion (§3.2) & Dispatch Subcommands (§3.3–3.4)

**From Mal (Lead):**
- **Onboard expansion:** Now accepts GitHub URLs (`https://github.com/owner/repo` or `owner/repo`), clones into configurable `projectsDir` (default: `~/.rally/projects/`). User selects team type at onboard: shared (`~/.rally/team/`) or project-specific (`~/.rally/teams/<project>/`). Flag: `--team <shared|new>`. `projects.yaml` schema expanded to track `team` and `teamDir`.
- **Dispatch subcommands:** Explicit subcommands `rally dispatch issue <number>` and `rally dispatch pr <number>` (was implicit + `--pr` flag). Both accept `--repo <owner/repo>` with fallback inference logic. Sections §3.3, §3.4, §4.2 updated in PRD.
- **State layout:** `~/.rally/` gains `teams/` (project-specific) and `projects/` (cloned repos).
- **See:** `.squad/decisions.md` → "Onboard Command Expansion" and "Dispatch uses explicit subcommands"

**What this means for you:**
- Review `docs/PRD.md` §3.2, §3.3, §3.4, §4.1, §4.2 before implementing
- `lib/setup.js` must create `projectsDir` (default: `~/.rally/projects/`) and `teams/` directory
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

### 2026-02-22 — GitHub Issues Creation Complete

**Task:** Created all 29 implementation issues on jsturtevant/rally.

**What was done:**
1. **15 labels created** with color assignments per specification:
   - Core categories: core, setup, cli, ui, testing, docs, git, github, debug, utilities
   - Phase labels: phase:1-foundation through phase:5-polish

2. **5 milestones created:**
   - Phase 1: Foundation
   - Phase 2: Core Commands
   - Phase 3: Dispatch
   - Phase 4: Dashboard
   - Phase 5: Polish

3. **29 issues created in sequential order** (#1 through #29):
   - **Phase 1 (8 issues):** Scaffolding, utilities (config, symlink, exclude, worktree, github modules), CLI setup, test infrastructure
   - **Phase 2 (5 issues):** setup, onboard (local + GitHub URLs + team selection), status command
   - **Phase 3 (6 issues):** dispatch core, issue mode, PR mode, context templates, Copilot CLI invocation, active.yaml tracking
   - **Phase 4 (6 issues):** UI components (StatusMessage, DispatchBox, DispatchTable), dashboard main view, keyboard navigation, clean command, TTY graceful degradation
   - **Phase 5 (4 issues):** Error handling, edge cases/idempotency, documentation, end-to-end tests

**Key details:**
- Each issue includes acceptance criteria, owner assignment, size estimate (S/M/L), and dependency notes in body
- All issues labeled with appropriate categories and phase
- Created sequentially to ensure numeric order #1–#29
- Process: bash scripts (3 batches) using `gh issue create` CLI for reliability

**Owner assignments honored from specification:**
- Kaylee: Core command implementation (issues #1-4, 7, 9-10, 12-17, 20-24)
- Wash: Git/GitHub integration (issues #5-6, #11, #18)
- Jayne: Testing & error handling (issues #8, #25-27, #29)
- Mal: Documentation (#28)

**Files modified:** None (GitHub-only task). All state in jsturtevant/rally repo.

### 2026-02-22 — Team Notification: Project Scaffold Complete

**From Scribe (cross-agent update):**

Decision inbox merged into `decisions.md`. Scaffold phase complete.

**What Happened:**
1. ✓ Mal (Lead): Updated PRD blockers, created design checklist skill
2. ✓ Jayne (Tester): Wrote docs/TESTING.md and error catalog
3. ✓ Kaylee (Core Dev): Scaffolded project (package.json, bin/rally.js, smoke test)

All decisions documented and merged. PRD design phase is complete with all blockers resolved. Ready for implementation.

**Your Next Work:**
- Phase 1 & Phase 3 implementation:
  - #5: symlink.js (Windows detection, cross-platform support)
  - #6: exclude.js (.git/info/exclude writer)
  - #11: github.js (gh CLI wrapper for issues/PRs)
  - #18: Copilot CLI invocation (dispatch.js integration)

See GitHub issues for full specs. Blockers resolved—proceed with implementation.

### 2026-02-22 — Phase 1 CI & Core Utilities Implementation (Issues #5, #6, CI)

**Task:** Implement CI workflow + worktree.js + github.js with comprehensive tests.

**What Was Built:**

1. **GitHub Actions CI workflow** (`.github/workflows/ci.yml`):
   - Runs on push to main and all PRs
   - Tests across Node.js 18, 20, 22 (matrix strategy)
   - Uses standard GHA actions (checkout@v4, setup-node@v4)
   - Created alongside existing squad-ci.yml (not modified per directive)

2. **lib/worktree.js** (Issue #5 — Git Worktree Management):
   - `createWorktree(repoPath, worktreePath, branchName)` — creates worktree with new branch
   - `removeWorktree(repoPath, worktreePath)` — removes worktree with --force
   - `listWorktrees(repoPath)` — parses `git worktree list --porcelain`, returns array of `{path, branch, head}`
   - `worktreeExists(repoPath, worktreePath)` — boolean check for worktree existence
   - All functions use `execFileSync` (no shell injection), `path.resolve()` for absolute paths
   - User-friendly error messages with full context

3. **lib/github.js** (Issue #6 — GitHub CLI Wrapper):
   - `checkGhInstalled()` — verifies gh CLI on PATH, throws with install instructions
   - `checkGhAuth()` — verifies `gh auth status`, throws with auth instructions
   - `getIssue(number, repo)` — fetches issue JSON (title, body, labels, assignees)
   - `getPr(number, repo)` — fetches PR JSON (title, body, headRefName, baseRefName, files)
   - `createPr(title, body, base, head, repo)` — creates PR, returns URL
   - `getRepoDefaultBranch(repo)` — gets default branch via jq query
   - All functions use `execFileSync` for safety, parse JSON with error handling

4. **test/worktree.test.js** (8 tests):
   - Real temp git repos with `git init` + initial commit
   - Tests: create, remove, list, exists, duplicate branch error, non-git-repo error, relative path resolution
   - Full cleanup with `beforeEach`/`afterEach` hooks

5. **test/github.test.js** (8 tests):
   - Tests JSON parsing logic (can't mock execFileSync in node:test reliably)
   - Tests argument construction, error message detection, output parsing
   - Validates error handling for not-found issues/PRs, invalid JSON
   - Note: Full integration tests require real gh CLI (tested in CI)

**Test Results:**
- All 47 tests pass (including existing config, exclude, symlink, smoke tests)
- Worktree tests use real git repos in temp directories
- GitHub tests validate logic without actual gh calls (CI will test real gh integration)

**Key Decisions:**
- **ESM throughout** — all imports use ES modules per package.json "type": "module"
- **execFileSync over execSync** — no shell injection risk, explicit args array
- **Absolute paths** — `path.resolve()` on all paths for worktree operations
- **User-friendly errors** — all throws include context (path, number, repo, instructions)
- **Porcelain parsing** — `git worktree list --porcelain` for stable, machine-readable output
- **JSON error detection** — parse gh CLI errors by message content for specific not-found cases

**What This Enables:**
- Dispatch command (#14-17) can now create/remove worktrees reliably
- GitHub issue/PR fetching ready for dispatch context template (#16)
- CI validates all PRs automatically (user directive: "CI runs on every PR")
- Safe, cross-platform git and gh CLI invocation patterns established

### 2026-02-22 — Phase 2 Retrospective & Action Items for Phase 3

**From Mal (Lead):**

**Phase 2 was a success.** All 5 issues (#9–#13) closed, all 5 PRs (#30–#34) merged. Code quality improved, 52 test cases, zero post-merge bugs.

**What went well:**
- ✓ Feature branches used throughout (5 agents, 5 worktrees, zero direct commits to main)
- ✓ Code review effective (8 review cycles, all comments addressed before merge)
- ✓ Acceptance criteria became binding in review process (real bugs caught: Node 18 compat, path traversal, partial state)
- ✓ CI pipeline validation on every PR
- ✓ Idempotency maintained

**Process gaps for Phase 3 (your work — PR integration + dashboard):**

1. **Copilot review must be mandatory**
   - Phase 2 had Copilot on some PRs but not all (#30, #31 missing @copilot)
   - Action: Add `@copilot` reviewer to ALL Phase 3 PRs from day 1
   - If Copilot generates comments, address them like human review

2. **Interactive behavior needs end-to-end testing**
   - PR #34 bug (team selection unreachable) caught in code review, not before
   - Your dashboard command will be heavily interactive (Ink UI, keyboard nav, state machine)
   - Action: Test your dashboard command end-to-end with real keyboard input before review
   - Unit tests aren't sufficient for interactive behavior

3. **Edge case review must be systematic**
   - Phase 2 found path traversal + partial state bugs via luck (lucky reviews), not by design
   - For dashboard, common edge cases: terminal resize mid-render, rapid quit presses, piped output (should fallback to plain table, not alternate buffer), worktree state inconsistency, Squad dir missing
   - Action: Review checklist in merge PRs will include edge cases — prepare for this

4. **Dashboard alternate buffer edge cases**
   - PRD §5 specifies `\x1b[?1049h/l` for alternate screen buffer
   - Test cases: terminal resize while dashboard running, rapid `q` quit presses, output piped (should not use buffer)
   - Mal will create edge case checklist for Phase 4 planning, but start thinking about this now

5. **Preserve Phase 2 code patterns**
   - Keep dependency injection (`_exec`, `_select`, `_input` parameters) for testability
   - Keep idempotency (re-run commands = same result)
   - Keep Node 18+ compatibility (no `import.meta.dirname`)
   - Keep `execFileSync` with array args (safety)
   - Keep defensive parsing (try/catch, existence checks, defaults)

**Next step for you:** Review Phase 2 retro in `.squad/decisions.md` → "Retrospective: Phase 2 Implementation" section. Understand what went well and where the gaps are. You're implementing dispatch integration and dashboard — they will face the same process gates and quality standards.

### 2026-02-22T171200Z: PR Review Skill Finalized

**Directive:** A new PR review skill exists at `.squad/skills/pr-review-process/SKILL.md`. You must read this before opening any PR in Phase 3.

**Key changes from Phase 2:**
- Mal (Lead) now conducts mandatory review in addition to Copilot's automated review
- All comments from both reviewers must be addressed (no exceptions — hard policy)
- If feedback is out-of-scope, Mal opens a GitHub issue and optionally assigns @copilot
- Merge gate is three-fold: CI green + Copilot approved + Mal approved + all comments addressed
- Your revision workflow: if Mal requests changes, don't self-revise — a different agent will pick it up

**Action:** Read `.squad/skills/pr-review-process/SKILL.md` before Phase 3 PRs.

### 2026-02-22 — Issue #19: active.yaml Dispatch Tracking (Phase 3)

**Task:** Implement CRUD operations for dispatch records in active.yaml.

**What Was Built:**

1. **lib/active.js** — Dispatch record management:
   - `addDispatch(record)` — adds with full validation (required fields, type enum, status enum, duplicate id check)
   - `updateDispatchStatus(id, status)` — updates status with validation
   - `removeDispatch(id)` — removes by id
   - `getActiveDispatches()` — returns all dispatches
   - `VALID_STATUSES` — exported enum: planning, implementing, reviewing, done, cleaned
   - Atomic writes: `writeFileSync` to `.active.yaml.tmp`, then `renameSync` to `active.yaml`

2. **test/active.test.js** — 19 tests covering all acceptance criteria

**Key Decisions:**
- Reuses `readActive()` and `getConfigDir()` from `lib/config.js` for consistency
- Atomic writes use temp file + rename (POSIX atomic on same filesystem)
- Dispatch record fields: id, repo, number, type, branch, worktreePath, status, created, session_id
- Validation throws descriptive errors for invalid input

**PR:** #36 on branch `rally/19-active-tracking`

### 2026-02-22T1725 — Phase 3 Wave 1: Cross-Agent Update

**From Scribe (cross-agent propagation):**

**Wave 1 parallel results (your peers):**

1. **Kaylee (Core Dev):** Implemented `lib/dispatch.js` with `resolveRepo()` and core dispatch routing. 22 tests passing. PR #35 on `rally/14-dispatch-core`. Your `lib/active.js` will be consumed by dispatch workflows in Wave 2.

2. **Jayne (Tester):** Wrote 35 anticipatory test stubs for Issues #15 and #17 — `test/dispatch-issue.test.js` (14 tests) and `test/dispatch-context.test.js` (21 tests). Tests validate active.yaml tracking integration with your module.

**Your PR #36 status:** Awaiting dual review (Copilot + Mal).

**Your atomic writes decision** has been merged into `.squad/decisions.md`. All agents now know `lib/active.js` owns dispatch CRUD exclusively.

### 2026-02-23 — E2E CI Setup & Test Issue Created

**Task:** Create E2E test issue and update CI workflow for end-to-end tests.

**What Was Done:**

1. **E2E test issue created:** jsturtevant/rally#54 — "[E2E Test] Dummy issue for automated testing"
   - Label `e2e-test` created (green, #0E8A16) and applied
   - Issue body instructs not to close manually — it's a permanent CI fixture

2. **CI workflow updated** (`.github/workflows/ci.yml`):
   - Added git identity config step (`github-actions[bot]`) for worktree operations
   - Added `npm run test:e2e` step after `npm test`
   - `GH_TOKEN` set via `${{ secrets.GITHUB_TOKEN }}` for gh CLI auth
   - Existing unit test step unchanged

3. **Branch:** `rally/e2e-ci` — committed and pushed. No PR yet (Jayne adds test files first).

**Key Details:**
- E2E test issue number: **#54** — Jayne needs this for test fixtures
- `test:e2e` script already defined in package.json: runs `test/e2e/*.test.js`
- Node matrix kept at [20, 22] (unchanged)

### 2026-02-23 — E2E CI Integration Complete

**Role:** DevOps / CI Infrastructure

**Outcome:** E2E tests integrated into GitHub Actions workflow. All 9 PRs passed CI.

**Work:**

1. **E2E Test Issue & CI Setup** (pre-code-review)
   - Created permanent E2E test issue #54 with label `e2e-test`
   - Updated `.github/workflows/ci.yml` to run `npm run test:e2e` step
   - Added git identity config (`github-actions[bot]`) for worktree operations in CI
   - Wired `GH_TOKEN` via `secrets.GITHUB_TOKEN` for gh CLI auth in CI environment

2. **PR #55 Merge:** E2E tests integrated and passing in CI
   - All 14 E2E tests passing on every CI run
   - Worktree cleanup reliable (git worktree remove + git branch -D)
   - No timeouts; 30–60s per E2E test

3. **Round 1–5 PR Support:** CI passing on all 9 merged PRs
   - All unit tests (272) passing
   - All E2E tests (14) passing
   - All integration tests (9) passing
   - No flakes; no hanging tests

4. **Branch Cleanup:** Deleted 19 merged remote branches after code review completion

**CI Workflow Additions:**
```yaml
- name: Setup git identity
  run: |
    git config --global user.name "github-actions[bot]"
    git config --global user.email "41898282+github-actions[bot]@users.noreply.github.com"

- name: E2E Tests
  run: npm run test:e2e
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Key Details:**
- Node matrix: [20, 22] (unchanged)
- E2E test issue #54 marked with `e2e-test` label (permanent fixture)
- RALLY_HOME seeded in tests; no permission issues
- CI environment handles GH_TOKEN for gh CLI

**Status:** CI fully operational. Five-round code review all tests passing. Ready for feature development.
