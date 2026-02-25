# Project Context

- **Owner:** James Sturtevant
- **Project:** Rally — a CLI tool that dispatches Squad teams to GitHub issues and PR reviews via git worktrees
- **Stack:** Node.js with curated npm packages (Ink, Chalk, Ora, Commander, js-yaml, @inquirer/prompts) + node:test for testing
- **Created:** 2026-02-21

## Core Context

This history has been summarized. Earlier entries have been condensed into key learnings and decisions below. See the Learnings section for detailed context from ongoing work.

---

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

### 2026-02-22 — Phase 1 Foundation Modules Complete (Issues #2, #3, #4)

**Status:** Three utility modules built with comprehensive tests. All tests passing (39/39).

**Modules Implemented:**

1. **lib/config.js** — Config read/write for `~/.rally/*.yaml` files using js-yaml
   - `getConfigDir()` — returns `~/.rally/` (respects `RALLY_HOME` env var)
   - `readConfig()`, `writeConfig()` — config.yaml operations
   - `readProjects()`, `writeProjects()` — projects.yaml operations
   - `readActive()`, `writeActive()` — active.yaml operations
   - All functions create directories if missing, return defaults for missing files

2. **lib/symlink.js** — Cross-platform symlink creation and validation
   - `createSymlink(target, linkPath)` — creates symlink with Windows junction support
   - `validateSymlink(linkPath)` — checks if symlink exists and points to valid target
   - `removeSymlink(linkPath)` — removes symlink if exists
   - `checkSymlinkSupport()` — tests OS symlink support (throws on Windows without Developer Mode)
   - Idempotent operations — skip if symlink already correct

3. **lib/exclude.js** — `.git/info/exclude` management
   - `addExcludes(gitDir, entries)` — adds entries with "# Rally — Squad symlinks" header
   - `removeExcludes(gitDir, entries)` — removes Rally entries and header
   - `hasExcludes(gitDir, entries)` — checks if all entries present
   - `getExcludeEntries()` — returns standard Rally exclude list
   - Idempotent operations — skip duplicate entries

**Test Coverage:**
- test/config.test.js — 10 tests (env vars, roundtrips, defaults, invalid YAML)
- test/symlink.test.js — 9 tests (create, validate, remove, broken links, idempotency)
- test/exclude.test.js — 10 tests (add, remove, check, missing dirs, partial entries)

**Key Learnings:**
- js-yaml handles all YAML parsing/serialization — zero issues with config roundtrips
- Windows symlink handling via 'junction' type works smoothly in cross-platform code
- path.join() everywhere for Windows compatibility (as per charter)
- Temp directories (fs.mkdtempSync) in tests ensure isolation — clean up with rmSync
- Idempotent operations are critical — all utilities skip no-op calls gracefully

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

### 2026-02-22 — Setup Command Implemented (Issue #9, PR #31)

**Status:** `lib/setup.js` implemented with 11 tests, all 58 tests passing (47 existing + 11 new).

**What was built:**
- `lib/setup.js` — Creates `~/.rally/team/` and `~/.rally/projects/`, runs `npx github:bradygaster/squad` in team dir, writes `config.yaml`
- `bin/rally.js` — Wired `rally setup` as a Commander subcommand with `--dir` option
- `test/setup.test.js` — 11 tests covering all 4 acceptance criteria + 3 error cases

**Key design decisions:**
- Used dependency injection (`_exec` option) for `execFileSync` to make Squad init testable without actually running npx
- Idempotency: checks `existsSync()` for team dir, projects dir, and `.squad/` before creating/running
- Ora spinner for Squad init, Chalk green checkmarks for success, plain text for skip messages
- Error cases: ENOENT for missing npx, generic message for Squad init failures, fs errors propagate naturally
- `execFileSync('npx', ...)` directly instead of `findNpx()` + path resolution — simpler and `execFileSync` resolves via PATH natively

**Branch:** `rally/9-setup` → PR #31 on jsturtevant/rally

### 2026-02-22 — Status Command Implemented (Issue #13, PR #30)

- **lib/status.js** — `getStatus()` gathers config paths (with existence checks), teamDir, projectsDir, onboarded projects, and active dispatches into a structured object. `formatStatus()` renders human-readable output with ✓/✗ markers.
- **bin/rally.js** — Wired `status` as Commander subcommand with `--json` flag. JSON output uses `JSON.stringify(status, null, 2)`.
- **test/status.test.js** — 12 tests: config paths shown + existence detection, directories from config, empty/populated projects, empty/populated dispatches, CLI `--json` parsing, CLI text section headers, formatStatus edge cases.
- **Pattern:** `withTempHome()` helper wraps `RALLY_HOME` env var and temp dir lifecycle for clean test isolation — reusable in future test files.
- **All 59 tests pass** (47 existing + 12 new).

### 2026-02-22 — Phase 2 Retrospective & Action Items for Phase 3

**From Mal (Lead):**

**Phase 2 was a success.** All 5 issues (#9–#13) closed, all 5 PRs (#30–#34) merged. Code quality improved, 52 test cases, zero post-merge bugs.

**What went well:**
- ✓ Feature branches used throughout (5 agents, 5 worktrees, zero direct commits to main)
- ✓ Code review effective (8 review cycles, all comments addressed before merge)
- ✓ Acceptance criteria became binding in review process (real bugs caught: Node 18 compat, path traversal, partial state)
- ✓ Dependency injection patterns kept code testable (`_exec`, `_select`, `_input` hooks)
- ✓ Idempotency maintained across all commands

**Process gaps for Phase 3 (your work — dispatch):**

1. **Copilot review must be mandatory**
   - Phase 2 had Copilot on some PRs but not all (#30, #31 missing @copilot)
   - Action: Add `@copilot` reviewer to ALL Phase 3 PRs from day 1
   - If Copilot generates comments, address them like human review

2. **Interactive behavior needs end-to-end testing**
   - PR #34 bug (team selection unreachable) caught in code review, not before
   - Dispatch is heavily interactive (Ink UI, prompts, state transitions)
   - Action: Test your dispatch command end-to-end with a real TTY before review, not just unit tests
   - Mal will create `.squad/skills/interactive-testing/SKILL.md` documenting this

3. **Edge case review must be systematic**
   - Phase 2 found path traversal + partial state bugs via luck (lucky reviews), not by design
   - For dispatch, common edge cases: aborted invocation, network errors (git clone fails, gh API fails, Copilot timeout), worktree conflicts, Squad state corruption, partial merge
   - Action: Review checklist in merge PRs will include edge cases — prepare for this

4. **Dispatch context format spec before you start**
   - Blocker resolutions specify: "simple markdown template. Include issue/PR number, title, labels, creation date, description, files changed, instructions"
   - Action: Wait for Mal to write `.squad/decisions/inbox/phase3-dispatch-context-spec.md`, get James sign-off before you code dispatch invocation
   - This prevents rework

5. **Squad invocation safety**
   - PRD §9.1 resolved: "Automated CLI invocation. Rally launches Copilot CLI automatically with appropriate prompt"
   - Action: Before implementing dispatch invocation, test with Wash: does `npx @github-copilot/cli chat < dispatch-context.md` work? What error cases exist?
   - Avoid discovering this mid-implementation

6. **Preserve Phase 2 code patterns**
   - Keep dependency injection (`_exec`, `_select`, `_input` parameters) for testability
   - Keep idempotency (re-run dispatch = no change)
   - Keep Node 18+ compatibility (no `import.meta.dirname`)
   - Keep `execFileSync` with array args (safety against injection)

**Next step for you:** Review Phase 2 retro in `.squad/decisions.md` → "Retrospective: Phase 2 Implementation" section. Understand what went well and where the gaps are. You're building dispatch — it will be scrutinized for these same patterns and process gates.

### 2026-02-22T171200Z: PR Review Skill Finalized

**Directive:** A new PR review skill exists at `.squad/skills/pr-review-process/SKILL.md`. You must read this before opening any PR in Phase 3.

**Key changes from Phase 2:**
- Mal (Lead) now conducts mandatory review in addition to Copilot's automated review
- All comments from both reviewers must be addressed (no exceptions — hard policy)
- If feedback is out-of-scope, Mal opens a GitHub issue and optionally assigns @copilot
- Merge gate is three-fold: CI green + Copilot approved + Mal approved + all comments addressed
- Your revision workflow: if Mal requests changes, don't self-revise — a different agent will pick it up

**Action:** Read `.squad/skills/pr-review-process/SKILL.md` before Phase 3 PRs.

### 2026-02-22T1725 — Phase 3 Wave 1: Cross-Agent Update

**From Scribe (cross-agent propagation):**

**Wave 1 parallel results (your peers):**

1. **Wash (Integration Dev):** Implemented `lib/active.js` — dispatch record CRUD with atomic writes (temp + rename). 19 tests passing. PR #36 on `rally/19-active-tracking`. **Key decision:** active.yaml uses atomic writes; `lib/active.js` owns all dispatch CRUD — do not bypass with raw `writeActive()` from config.js.

2. **Jayne (Tester):** Wrote 35 anticipatory test stubs for Issues #15 and #17 — `test/dispatch-issue.test.js` (14 tests) and `test/dispatch-context.test.js` (21 tests). Tests expect your dispatch modules to exist. Edge cases discovered: slug generation needs truncation, worktree collision needs dual check, Copilot CLI invocation method TBD.

**Your PR #35 status:** Awaiting dual review (Copilot + Mal).

**Next:** Wave 2 will implement Issues #15, #16, #17 using your dispatch.js core + Wash's active.js.

### 2026-02-23 — Dashboard Testing & Non-TTY Rendering

**Bug fixes for rally/25-non-tty branch:**
- **Dashboard test hang:** Dashboard component tests (`test/ui/Dashboard.test.js`) were hanging because `useEffect` with `setInterval` (auto-refresh) and `useInput` (keyboard navigation) keep Node process alive. Fix: capture `unmount()` from `render()`, call in `afterEach`, and pass `refreshInterval: 0` to disable timer during tests.
- **renderPlainDashboard missing:** Function was exported from `lib/ui/index.js` and tested in `test/ui/non-tty.test.js` but never implemented. Created function in `lib/ui/Dashboard.jsx` that returns plain text (no ANSI codes) with table layout matching test expectations.
- **Testing pattern:** When Ink components use hooks like `useInput` or `useEffect` with timers/listeners, tests MUST call `unmount()` or Node won't exit. Use `refreshInterval: 0` or `null` to disable timers in tests.
- **Key files:** `lib/ui/Dashboard.jsx`, `test/ui/Dashboard.test.js`, `test/ui/non-tty.test.js`

### 2026-02-23 — Test Infrastructure Fixes (CI hang + JSX loader)

- **CI hang root cause:** `test/onboard-url.test.js` "clone failure" test ran `git clone` against GitHub. In CI (no credentials), git prompts for username interactively, hanging forever. Fix: `GIT_TERMINAL_PROMPT=0` in the `npm test` script forces git to fail fast instead of prompting.
- **JSX loader replaced with pre-build:** Removed `--loader ./test/jsx-loader.mjs` from test script. Created `test/build-jsx.mjs` that uses esbuild `transformSync` to compile all `.jsx` → `.js` files once before tests run. Eliminates per-child-process esbuild re-initialization overhead.
- **Import migration:** All imports of `.jsx` files (in `lib/ui/index.js`, `bin/rally.js`, `test/ui/Dashboard.test.js`, `test/ui/non-tty.test.js`) changed to `.js` to reference compiled output.
- **Compiled files gitignored:** `lib/ui/Dashboard.js`, `lib/ui/components/*.js` added to `.gitignore` as build artifacts.
- **`--test-force-exit` added** for UI tests to prevent Ink event loop handles from keeping Node alive after tests complete.
- **Ink import overhead:** `ink` module takes ~27s to import on WSL2 due to ESM dependency graph resolution over 9P filesystem. On native Linux (CI), this is < 1 second. Not a code issue — WSL2 filesystem performance limitation.

### 2026-02-23 — Injectable `_clone` in onboard() (rally/25-non-tty)

- **Problem:** `test/onboard-url.test.js` "clone failure" test called real `git clone` against GitHub. In CI (no credentials, non-TTY), git hangs on credential prompt even with `GIT_TERMINAL_PROMPT=0` (still a network call).
- **Fix:** Added `_clone` injectable parameter to `onboard()` in `lib/onboard.js`, following the established `_exec`/`_select`/`_input` pattern. Default behavior unchanged (calls `execFileSync('git', ['clone', ...])`). Test now passes a mock `_clone` that throws, eliminating all network access.
- **Pattern reinforced:** Every external side effect in onboard/setup/dispatch should be injectable for testing. The underscore-prefix convention (`_clone`, `_exec`, `_select`, `_input`) is the project standard for test hooks.
- **Other clone tests unaffected:** Tests at lines 156, 176, 191 use local bare repos (`createBareRepo()`) — no network calls, no changes needed.



### 2026-02-23 — Phase 4–5 Retrospective: Quality Discipline & Process Enforcement

**From Mal (Lead) → Scribe (merged to decisions.md):**

**Retrospective findings:** Phase 4–5 shipped features (7 issues closed, 6 PRs merged, Dashboard + Polish complete) but quality degraded. CI hung for 55 minutes. PR #49 merged with 3 unresolved Copilot review comments. E2E tests are fake (use mocks, don't invoke CLI binary).

**4 Root Causes Identified:**
1. **RC-1: No Review Gate Enforced** — Branch protection not configured. PR #49 merged despite unresolved comments. Review policy is paper only.
2. **RC-2: No Test Isolation Standards** — Some tests clean up Ink renders, others don't. No enforce pattern. Band-aid (`--test-force-exit`) masked root causes.
3. **RC-3: Fake E2E Tests** — `test/e2e.test.js` uses mocked `_exec`, doesn't invoke `bin/rally.js`. This is integration testing, gives false confidence in CLI.
4. **RC-4: Speed Over Process** — Velocity prioritized; review gates bypassed. Agents' code committed without inspection. No accountability mechanism.

**8 Action Items (in order of priority):**
1. **P0:** Enable GitHub branch protection on `main` (require approval + Copilot review complete + CI pass) — James
2. **P0:** Fix `DispatchTable.test.js` — add `afterEach(() => cleanup())` — Next agent on tests
3. **P1:** Fix 3 documentation errors (README commands, TESTING.md step count) — Next agent on docs
4. **P1:** Rename `test/e2e.test.js` → `test/integration.test.js` — Next agent on tests
5. **P1:** Create 3–5 real E2E tests that invoke `bin/rally.js` via `execFileSync` — Next agent on tests
6. **P1:** Update `docs/TESTING.md` with cleanup requirements and CI-safe patterns — Jayne
7. **P2:** Add merge checklist to PR review skill (require zero unresolved comments) — Mal
8. **P1:** Audit all `test/ui/*.test.js` for missing cleanup — Next agent on tests

**Key Learning:** Branch protection is the highest-leverage fix. Makes review gate structural (impossible to bypass), not behavioral. Everything else is hygiene.

**For You (Kaylee):** When you open Phase 6 PRs, expect stricter review gates. Copilot comments are mandatory to address. Unresolved comments block merge. This is structural now, not advisory.

**See:** `.squad/decisions.md` → "Decision: Retrospective Findings — Phase 4–5 Sprint (Dashboard + Polish)"

### 2026-02-23 — Code Review Fixes (rally/retro-actions)

**From Mal's code review — 9 findings fixed:**

1. **bin/rally.js** — `dashboard clean` catch block now uses `handleError(err)` like every other command (was `console.error` + `process.exit(1)`)
2. **lib/tools.js** — Replaced `which` (Unix-only) with `tool --version` for cross-platform tool detection
3. **lib/config.js** — Added `{ schema: yaml.DEFAULT_SCHEMA }` to all three `yaml.load()` calls to document safe-parsing intent
4. **lib/dispatch-pr.js** — Worktree collision now returns `{ existing: true }` instead of throwing, matching `dispatch-issue.js` behavior
5. **lib/onboard.js** — Replaced `join(linkPath, '..')` with `dirname(linkPath)` — clearer intent
6. **test/github.test.js** — Deleted entirely (placeholder tests that tested JSON.parse, not the github module)
7. **test/smoke.test.js** — Changed `execSync` to `execFileSync` for consistency with codebase
8. **lib/ui/ compiled files** — Already properly gitignored and untracked; no changes needed
9. **Tests updated** — `dispatch-pr.test.js` and `edge-cases.test.js` updated to match new behavior (72/72 pass)

**Key learning:** When changing behavior (e.g., throw → return early), always grep for tests that assert the old behavior. Three tests broke here — all expected.


### 2026-02-23 — Seven-PR Code Fix Cycle Complete

**Role:** Core Developer / Primary Implementation

**Outcome:** Shipped 7 PRs fixing 20 of 26 audit findings.

**PRs Merged:**
1. **PR #67:** Wire dispatch issue/pr CLI subcommands (C-1)
   - Added `dispatch` command group with `issue` and `pr` subcommands
   - Accept `<number>` and `--repo <owner/repo>` option
   - Route to `dispatchIssue()` / `dispatchPr()`

2. **PR #68:** Add null guards to readActive() / readProjects() (C-2, M-4)
   - `readActive()` returns `{ dispatches: [] }` on empty file (was undefined crash)
   - `readProjects()` returns `{ projects: [] }` on empty file
   - Nullish coalescing pattern applied consistently

3. **PR #69:** Delete dead code
   - Removed `lib/github.js` (85 LOC, zero callers)
   - Removed `lib/.gitkeep` (redundant)

4. **PR #70:** Tool validation + worktree cleanup (I-2, M-1, M-2)
   - Call `assertTools()` on bin/rally.js startup (validates git, gh, npx)
   - Refactor all worktree cleanup to use `git worktree remove --force` before rmSync (prevents EIO)

5. **PR #80:** NaN validation + CORE_SCHEMA (I-3, M-6 partial)
   - Add isNaN check in numeric calculations
   - Standardize CORE_SCHEMA usage for config version tracking

6. **PR #89:** Status query fix + atomic writes (I-4, M-5, I-3)
   - Fix status command to respect --repo flag (was returning all projects)
   - Refactor `writeActive()` → use atomic write (temp + rename)
   - Add try-catch around dispatch steps 4-8 with `removeWorktree()` on failure (I-4 cleanup)

7. **PR #95:** Symlink edge cases + extract atomicWrite (I-5 partial, M-3)
   - Handle symlink EEXIST gracefully (target exists, target missing, partial teams)
   - Extract shared `atomicWrite()` utility (reduces duplication in active.js, config.js)
   - Consolidate fetch error handling (catch + removeWorktree on both issue and PR paths)

**Impact:**
- Dispatch commands now accessible via CLI
- All crash vectors from empty/undefined configs removed
- Error handling consistent (handleError, exit codes)
- Worktree cleanup reliable across edge cases
- All writes to active.yaml now atomic

**Testing:** All 9 PRs include test updates. Suite grew from 280→321 tests.

**Key Learnings:**
1. Atomic writes prevent data loss under concurrent access — worth the small perf cost
2. Partial failure cleanup (worktree created, then fetch fails) is tricky — test it
3. Empty YAML files are a blind spot — always null-coalesce after yaml.load()

**Status:** Five-round code review complete. All critical and important findings fixed. Codebase clean.

### 2026-02-23 — Dashboard Folder Column + VS Code Launch (Issue #129, PR #130)

**Role:** Core Developer

**Outcome:** Shipped folder column and VS Code integration to dashboard.

**Changes:**
- Added **Folder** column to `DispatchTable.jsx` showing `worktreePath` field (was already in data, just not displayed)
- Changed Enter key handler in `Dashboard.jsx` to spawn VS Code at worktree path instead of `console.log()`
- Updated plain text dashboard (`renderPlainDashboard()`) to include folder column
- VS Code launches detached (`detached: true`, `stdio: 'ignore'`, `child.unref()`) to avoid blocking CLI
- Added `_spawn` prop for dependency injection (follows project's DI pattern with `_exec`, etc.)

**Key Technical Details:**
- Used `spawn` from `node:child_process` (not `exec` or `execSync`) — allows detach + unref
- `onSelect` callback override preserved — if provided, calls that instead of spawning VS Code
- All `.jsx` files compiled to `.js` via `test/build-jsx.mjs` (esbuild) before tests run

**Testing:** All 33 tests pass. No new tests needed (behavior change only, no new code paths).

**Key Learning:** The dispatch data already had `worktreePath` all along — just needed to wire it through the table columns and change the action handler. Clean separation between data model and presentation made this a 10-minute change.

**Files Changed:**
- `lib/ui/components/DispatchTable.jsx` — added Folder column definition + row mapping
- `lib/ui/Dashboard.jsx` — imported spawn, added `_spawn` prop, changed Enter handler
- `lib/ui/dashboard-data.js` — added folder column to plain text output

### 2026-02-23 — Dispatch Remove Command (Issue #131, PR #132)

**Role:** Core Developer

**Outcome:** Shipped `rally dispatch remove <number>` subcommand.

**Changes:**
- `lib/dispatch-remove.js` — New module: finds dispatch by number in active.yaml, removes worktree (gracefully), removes dispatch record. Accepts `--repo` for disambiguation. Follows `dashboard-clean.js` patterns (DI, Ora, Chalk).
- `bin/rally.js` — Wired `dispatch remove` subcommand with `<number>` argument and `--repo` option. Added help text example.
- `test/dispatch-remove.test.js` — 6 tests: remove by number, unknown number, disambiguate with --repo, ambiguous without --repo, missing worktree, missing project path.

**Key Learning:** The `findProjectPath()` helper is duplicated between `dashboard-clean.js` and `dispatch-remove.js` — both resolve a repo name to a local path via projects.yaml. Could be extracted to a shared utility in the future.

### 2026-02-23 — Copilot Log Redirection (#135)

**Issue:** Copilot CLI stdout/stderr was bleeding into user terminal due to `stdio: 'inherit'`

**Solution implemented:**
- Modified `lib/copilot.js` → `launchCopilot()` now accepts `logPath` parameter and redirects stdout/stderr to log file using `fs.openSync()` with `stdio: ['ignore', fd, fd]`
- Updated `lib/dispatch-core.js` → `setupDispatchWorktree()` computes log path as `join(worktreePath, '.copilot-output.log')` and passes to `launchCopilot()`
- Extended `lib/active.js` → `addDispatch()` now persists optional `logPath` field in dispatch records
- Created `lib/dispatch-log.js` → new `dispatchLog(number, opts)` command finds dispatch by number, reads log file, outputs to terminal
- Added `rally dispatch log <number> [--repo] [--follow]` command to `bin/rally.js`
- `--follow` flag accepted but shows "not yet implemented" message (placeholder for future tail -f feature)

**Testing:**
- Updated `test/copilot.test.js` with new logPath parameter tests (fs.openSync/closeSync injection)
- Created `test/dispatch-log.test.js` with 7 test cases (happy path, missing logPath, missing file, disambiguation, --follow stub)
- All tests pass (69 tests across copilot, dispatch-log, active, dispatch-issue, dispatch-remove)

**Key patterns:**
- DI pattern: Injectable `_fs` parameter with `openSync` and `closeSync` for testing
- Log file location: `.copilot-output.log` in worktree root (alongside `.squad` symlink)
- Return value extension: `launchCopilot()` now returns `{ sessionId, process, logPath }` (was just sessionId/process)
- File descriptor management: fd opened, passed to spawn, immediately closed (child inherits open fd)

**Files modified:**
- `lib/copilot.js` — log redirection logic
- `lib/dispatch-core.js` — log path computation and pass-through
- `lib/active.js` — logPath field support
- `bin/rally.js` — new `dispatch log` command
- `test/copilot.test.js` — updated tests
- `lib/dispatch-log.js` — new command implementation
- `test/dispatch-log.test.js` — new test suite

### Issue #136 — Dispatch Status Refresh (PID-based)

- **Problem:** After `rally dispatch issue` launches Copilot as a detached process, the dispatch status stays stuck at "planning" forever because `child.unref()` means the parent exits before Copilot finishes — no exit event fires.
- **Solution:** PID-based status refresh. `refreshDispatchStatuses()` checks if the stored PID is still alive via `process.kill(pid, 0)`. If the PID is gone, status moves to "done".
- **Integration points:** Called automatically in dashboard data loading (`getDashboardData`), `rally status`, and available as manual `rally dispatch refresh` subcommand.
- **DI pattern:** `_getActiveDispatches`, `_updateDispatchStatus`, `_isProcessRunning` — all injectable for testing.
- **Key insight:** `child.unref()` + detached means Node won't keep the event loop alive for the child process. Process exit events are unreliable in this scenario. PID polling on next user interaction is the correct pattern.
- **Files:**
  - `lib/dispatch-refresh.js` — new module with `refreshDispatchStatuses()` and `isProcessRunning()`
  - `test/dispatch-refresh.test.js` — 9 tests covering all scenarios
  - `bin/rally.js` — wired `dispatch refresh` subcommand + refresh in `rally status`
  - `lib/ui/dashboard-data.js` — calls refresh before loading dashboard data

### Read-Only Copilot Dispatch (#139)

- **Pattern:** `gh copilot` reads `.github/copilot-instructions.md` from the repo root. Writing a policy file there before launch is the most reliable way to restrict Copilot's behavior — no PATH shadowing or wrapper scripts needed.
- **Architecture:** `lib/copilot-instructions.js` centralizes the policy content via `getCopilotInstructions()`. Both `dispatch-core.js` (writes to worktree `.github/`) and `setup.js` (writes to squad dir as reference) use it.
- **Placement in dispatch-core.js:** `writeCopilotInstructions()` runs after `postSymlinkFn` but before `checkCopilotAvailable`/`launchCopilot`, ensuring the instructions are in place before Copilot starts.
- **setup.js policy file:** Written to `{teamDir}/.squad/dispatch-policy.md` during `rally setup` — idempotent, skips if already exists. Serves as a customizable reference.
- **Key files:**
  - `lib/copilot-instructions.js` — policy content + writer
  - `lib/dispatch-core.js` — calls `writeCopilotInstructions` in `setupDispatchWorktree`
  - `lib/setup.js` — writes `dispatch-policy.md` during onboarding
  - `test/copilot-instructions.test.js` — 14 tests

### 2026-07-24 — Dashboard: Arrow Selection Indicator (#144 → PR #147)

- **Change:** Replaced inverse-video row highlighting in `DispatchTable.jsx` with a leading `❯` arrow indicator (cyan, 2-char column). Selected rows are bold only, no longer inverse. Header gets a matching spacer column for alignment.
- **Build system note:** `.js` files compiled from `.jsx` are gitignored — only edit the `.jsx` source. The `test/build-jsx.mjs` script handles compilation before tests.
- **Test updates:** Two selection tests in `test/ui/DispatchTable.test.js` updated to assert on `❯` presence/absence instead of inverse styling differences.
- **Convention:** Arrow indicator (`❯`) matches inquirer/fzf patterns — standard CLI selection UX.

### Dashboard Action Menu (PR #148, Issue #143)

- **Feature:** Pressing Enter on a dispatch now shows an interactive action menu (Open in VS Code, View dispatch logs, Back) instead of immediately spawning VS Code.
- **New component:** `lib/ui/components/ActionMenu.jsx` — standalone menu component with `useInput` for keyboard navigation.
- **Dashboard state:** Added `actionDispatch` and `actionIndex` state to `Dashboard.jsx`. The action menu replaces the dispatch list view when active; Back/Esc returns to the list.
- **Dependency injection:** Dashboard accepts `_dispatchLog` prop for testability (same pattern as `_spawn`).
- **Ink testing insight:** `ink-testing-library` requires `await new Promise(r => setTimeout(r, 100))` between `stdin.write()` and `lastFrame()` for React state updates to propagate. Synchronous reads after stdin writes see stale state.
- **Build system:** `ActionMenu.jsx` added to `test/build-jsx.mjs` compile list and `ActionMenu.js` added to `.gitignore`.

### 2026 — Dashboard Keyboard Shortcuts (#145, PR #149)

- **Feature:** Added single-key shortcuts `v` (open VS Code) and `l` (view logs) from the dispatch list, bypassing the action menu for common actions.
- **Guard logic:** Shortcuts only fire when `actionDispatch` is null (not in action menu) and `count > 0`. The `l` shortcut additionally checks `logPath` existence before calling `viewLogs`.
- **ActionMenu labels:** Updated to show shortcut hints — `(v) Open in VS Code`, `(l) View dispatch logs` — so users discover shortcuts from the menu too.
- **Help text pattern:** Dashboard footer now reads `↑/↓ navigate · Enter actions · v open · l logs · r refresh · q quit`.
- **Tests:** 3 new tests covering `v` spawn, `l` with logPath, `l` without logPath (no-op). All 43 UI tests pass.

### 2026 — Move Clean to Dispatch, Add Branch Deletion (#146, PR #150)

- **Command move:** `rally dashboard clean` → `rally dispatch clean`. Clean is a dispatch lifecycle operation, not a dashboard concern.
- **Branch deletion:** Clean now runs `git branch -D` on each dispatch's branch, matching the pattern from `dispatch-remove.js`. Previously branches were preserved.
- **Status filter:** Clean now targets dispatches with status `done` OR `cleaned` (was only `done`).
- **File rename:** `lib/dashboard-clean.js` → `lib/dispatch-clean.js`, `test/dashboard-clean.test.js` → `test/dispatch-clean.test.js`.
- **Dashboard 'd' shortcut:** Added `d` key shortcut in dashboard to remove the selected dispatch (calls `dispatchRemove`). Help text updated to include `d delete`.
- **Injectable `_exec`:** `dispatchClean` accepts `_exec` param for testing branch deletion without real git repos, following the same DI pattern as `dispatchRemove`.
- **Tests:** 12 unit tests (was 9) — added tests for "cleaned" status, branch deletion, and branch deletion failure resilience. All 390 tests pass.

### 2026 — README Documentation Update (Issue #152, PR #153)

- **Title redesign:** Changed from plain "# Rally" to linked title "# [Rally](https://bradygaster.github.io/squad/) your <sub>Squad</sub>" with "your" as a subscript (semantic styling for visual hierarchy)
- **Added "Why Rally?" section:** Brief 3-sentence explanation of the problem Rally solves — automation of the Squad workflow, elimination of ~15 manual steps, and keeping shared repos clean. Content sourced from PRD §1.
- **Complete command documentation:** Discovered and documented all 9 dispatch subcommands. README was missing `remove`, `log`, `clean`, and `refresh` subcommands. All options now current with latest `rally --help` output.
- **Added "Future Work" section:** Extracted planned features from PRD (v1+ enhancements): smart worktree cleanup, team templates, PR creation automation, advanced team configuration, team snapshots/exports. Presented as brief bullet list.
- **Process:** Ran all help commands (`rally --help`, `rally dispatch --help`, `rally dispatch {issue,pr,remove,log,clean,refresh} --help`, etc.) to sync documentation with actual CLI state. No tool/dependency changes needed — just docs.
- **Branch & PR:** Created `docs/update-readme` branch, committed with Copilot co-author trailer, pushed, and opened PR #153 referencing issue #152.

### 2026-02-24 — Deny-tool enforcement for read-only dispatch (#151 → PR #156)

- **Replaced file-based approach:** Removed `copilot-instructions.md` file writing from PR #141. Per James's feedback, we can't modify user files in worktrees.
- **CLI enforcement:** Added `--deny-tool` flags to `launchCopilot()` blocking `git push`, `git commit`, `gh pr/issue/repo/api`, and `github-mcp-server`.
- **Prompt-based policy:** Read-only policy text now prepended to the Copilot prompt via `-p` instead of written to `.github/copilot-instructions.md`.
- **`--allow-all-tools`:** Added so read tools work without prompting (deny flags take precedence).
- **Exports:** `DENY_TOOLS` constant and `getReadOnlyPolicy()` exported from `lib/copilot.js` for testability.
- **Deleted:** `lib/copilot-instructions.js`, `test/copilot-instructions.test.js`, dispatch-policy.md writing from setup.js.
- **Test results:** 396 tests, 0 failures.
- **Key learning:** `--deny-tool` flags are the proper CLI-level enforcement mechanism for restricting Copilot tool access. They take precedence over `--allow-all-tools`.

### Issue #164 — Dispatch Connect: Status Transition & Copilot Stats

**Sub-task 1: Change "done" to "ready for review" on copilot exit**
- `lib/dispatch-refresh.js`: Auto-transition target changed from `'done'` to `'reviewing'`. Removed `reviewing` from the status filter since it's now the terminal auto-status (only `planning` and `implementing` get auto-transitioned).
- `lib/ui/components/DispatchTable.jsx`: Added `STATUS_LABELS` map so `reviewing` displays as `🟡 ready for review` instead of `🟡 reviewing`.
- `lib/dispatch-clean.js`: Added `reviewing` to the default clean filter alongside `done` and `cleaned`.
- `lib/ui/dashboard-data.js`: `computeSummary` now counts `reviewing` in the `done` bucket.

**Sub-task 2: Parse and display copilot output stats**
- Created `lib/copilot-stats.js` with `parseCopilotStats(logContent)` and `formatStatsSummary(stats)`.
- `parseCopilotStats` returns structured object with `premiumRequests` (number), `apiTime` (string), `sessionTime` (string), `codeChanges` ({additions, deletions}), `models` (array). Returns `null` if no stats found.
- Time value validation: only accepts values matching `/^\d+[hms]/` to reject garbled input.
- `lib/dispatch-log.js`: Shows stats summary line before raw log output.
- `lib/ui/dashboard-data.js`: `enrichWithStats()` reads log files and populates `changes` field on dispatches.
- `lib/ui/components/DispatchTable.jsx`: Added "Changes" column showing `+N -N` from stats.
- Column widths adjusted: Project 18, Branch 22, Folder 30, Status 20, Changes 10 — fits within Ink's default rendering.

**Key patterns:**
- `STATUS_LABELS` map in DispatchTable for human-friendly status display names.
- `enrichWithStats()` in dashboard-data.js reads log files best-effort (try/catch, skips missing files).
- Time format validation prevents garbled regex matches from leaking into parsed stats.

**Files modified:**
- `lib/dispatch-refresh.js`, `lib/dispatch-clean.js`, `lib/dispatch-log.js`
- `lib/copilot-stats.js` (new), `test/copilot-stats.test.js` (new)
- `lib/ui/components/DispatchTable.jsx`, `lib/ui/dashboard-data.js`
- `test/dispatch-refresh.test.js`, `test/integration.test.js`

**Test results:** 415 pass, 0 failures from changes (2 pre-existing timeout issues in e2e).

### 2025-07-25 — Issue #321: Copilot Status Display Fix

**Problem:** PR dispatches were created with `initialStatus: 'reviewing'`, so the dashboard showed "ready for review" immediately — even while copilot was still actively working on the review.

**Fix:**
- Changed `dispatch-pr.js` initial status from `'reviewing'` to `'implementing'`. Now the refresh logic (`refreshDispatchStatuses`) handles the transition to `'reviewing'` only after the copilot process exits and log goes idle.
- Changed `DispatchTable.jsx` label for `implementing` from "working" to "copilot working" to match user expectation.
- Added `docs/STATUS-FLOW.md` documenting the full status lifecycle with transition diagram.

**Key insight:** The status model was already correct for issue dispatches (start at `planning`, auto-transition to `reviewing`). PR dispatches were the exception — they skipped the working phase entirely.

**Files changed:**
- `lib/dispatch-pr.js` (initialStatus fix)
- `lib/ui/components/DispatchTable.jsx` (label change)
- `docs/STATUS-FLOW.md` (new documentation)
- `test/dispatch-pr.test.js`, `test/integration.test.js` (test updates)

**Test results:** 724 pass, 0 failures.

### 2026 — Decompose onboard() monolith (#292)

- **Refactored `lib/onboard.js`:** Decomposed the 200+ line `onboard()` function into 5 focused private helpers:
  - `cloneOrValidateExisting(parsed, options)` — clone logic + existing directory validation
  - `resolveGitDir(projectPath)` — git repo verification + git dir resolution
  - `resolveFullRepoName(parsed, projectPath)` — owner/repo from parsed URL or git remote
  - `setupSymlinks(projectPath, teamDir)` — symlink creation with idempotency checks
  - `registerProject({...})` — exclude management + projects.yaml registration
- **Replaced inline regex** in repo name resolution with the already-imported `parseGitHubRemoteUrl()` — eliminates duplication
- **Pure refactor:** All 82 tests pass unmodified
- **Exported API unchanged:** `onboard()` and `onboardRemove()` signatures identical
- **Helpers are private (not exported)** — kept in the same file since they're small and tightly coupled to the onboard flow

### 2026-XX-XX — Dashboard Issue/PR Pickers (#278)

- **New components:** `ProjectBrowser.jsx` (project list + "Add Project") and `ProjectItemPicker.jsx` (issues/PRs for a project) added to `lib/ui/components/`
 dispatch flow. Uses same exit-and-run pattern as `onAttachSession`.
- **DI pattern preserved:** Both components accept injectable `_listOnboardedRepos`, `_fetchIssues`, `_fetchPrs` for testing. Dashboard passes these through.
- **rally.js wiring:** After dashboard exit, `pendingDispatch` triggers `dispatchIssue` or `dispatchPr`; `pendingAddProject` prints onboard instructions.
- **Build system:** New JSX files added to `test/build-jsx.mjs` and `.gitignore` (compiled .js output is gitignored).
- **Pre-existing test hang:** Some UI tests hang when run together (not from these changes). Dashboard.test.js passes individually.
