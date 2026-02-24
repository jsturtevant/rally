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

### 2026-02-22 — PRD Review: Testability, Edge Cases, Error Handling (COMPLETE)

**Status:** PRD Review cycle complete. 5 critical blockers identified. PRD architecturally sound.

**Blocker Status & Resolutions:**

1. **YAML parser conflict** ✓ RESOLVED — Dependency Pivot decision approved. `js-yaml` is now used. See `.squad/decisions.md` → "Decision: Dependency Pivot".

2. **Windows symlink strategy** — 🔴 BLOCKER. Awaiting Mal decision sync. Options: hard error with instructions, junctions, copy, or `--no-symlink` flag.

3. **Squad invocation mechanism** — 🔴 BLOCKER. Awaiting Mal decision. Options: A (instructions), B (CLI), C (VS Code).

4. **Dispatch status lifecycle** — 🔴 BLOCKER. Awaiting Mal decision. Need: transition rules, who updates status, when.

5. **dispatch-context.md format** — 🔴 BLOCKER. Awaiting Mal decision. Recommended schema: markdown + YAML front-matter.

**Other Key Findings:**
- 12 error-handling gaps across all commands (setup, onboard, dispatch, dashboard, cleanup, exit codes)
- 20+ edge cases (idempotency, collisions, multi-project, config validation, concurrency)
- Test framework not spec'd: test harness choice, mocking strategy, fixtures, integration tests

**Team Action Items:**
1. **Mal (Lead):** Resolve 5 blockers ASAP (schedule decision sync with team)
2. **Jayne (Tester):** Await blocker resolution, then:
   - Write comprehensive test suite (unit + integration)
   - Create `docs/TESTING.md` with mocking strategy, fixtures, Ink component testing patterns
   - Add error catalog section to PRD with exit codes and error message specs
3. **Kaylee/Wash:** Await blocker resolution before full implementation

**Detailed findings:** See `.squad/decisions.md` → "PRD Review Findings" and prior inbox review file.

### 2026-02-22 — PRD Review: Testability, Edge Cases, Error Handling

**Executive summary:** 5 blocking issues, 7 error-handling gaps, 25+ edge case gaps, test framework needs clarification.

**Key findings:**

**BLOCKERS (resolve before implementation):**
1. **YAML parser conflict:** PRD lists `js-yaml` in §5.0 but decisions.md says "zero-dependency, hand-rolled parser". Contradiction.
2. **Windows symlink strategy undefined:** §9.7 open question. No fallback strategy (junctions? copies? error?) defined.
3. **Squad invocation mechanism:** §9.1 open question. After dispatch, how is Squad invoked? Instructions-only? CLI? VS Code?
4. **Dispatch status lifecycle incomplete:** No rules for status transitions (planning→implementing→reviewing→done→cleaned). Who updates status? When?
5. **dispatch-context.md format undefined:** §9.4 open question. What fields? YAML/markdown? For PRs: full diff or file list only?

**Critical error-handling gaps:**
- Setup: missing errors for `npx` not found, `git` not on PATH, home dir read-only, partial squad init failures
- Onboard: partial failures (clone fails mid-way, symlink+exclude succeed partially), corrupted YAML, repo-not-git, prompt timeout/Ctrl-C
- Dispatch: uncommitted changes handling, branch/worktree collisions, auth expiry, issue deleted after fetch, squad init failure, corrupted active.yaml
- Dashboard: empty active.yaml case, stale worktrees, concurrent access/race conditions on active.yaml
- Cleanup: behavior during in-progress dispatch, confirmation requirement, branch cleanup

**Edge cases missing from spec:**
- Re-onboarding same repo with different team selection
- Dispatch same issue twice (error? re-use worktree? create rally-42-2?)
- Multiple projects onboarded + cwd ambiguity
- Symlink target validation
- Concurrent dispatch commands (race condition on active.yaml)
- GitHub URL → clone target directory naming (.git suffix? repo name only?)
- Worktree health checks in dashboard (stale entries?)
- Idempotency rules (re-symlink if target changed? Skip? Error?)

**Config/State validation gaps:**
- Malformed YAML (syntax errors, invalid UTF-8)
- Missing required config keys (projectsDir default? version usage?)
- Empty projects.yaml, active.yaml
- Path normalization (relative vs absolute, ~ expansion)
- Windows path separators, line endings (CRLF vs LF)

**Test framework not spec'd:**
- How to test Ink components + @inquirer/prompts? Use `ink-testing-library`?
- Mock child_process for git/gh/npx calls?
- Fixture strategy (temp dir? Avoid ~/.rally/ pollution?)
- Integration tests for full workflow (setup→onboard→dispatch)?

**Recommendations:**
1. Resolve blocker #1 (YAML deps) — clarify with Mal if js-yaml is allowed or hand-rolled required
2. File PR with updated PRD sections: dispatch status lifecycle rules, Squad invocation spec, dispatch-context.md schema
3. Add Windows symlink detection/fallback to decisions.md
4. Create test infrastructure doc (mocking strategy, fixtures, Ink component testing)
5. Add comprehensive error catalog to PRD with exit codes (0=success, 1=generic, distinct codes for auth/not-found/etc)


### 2026-02-21 — PRD Draft & Architecture

- **All implementation begins with** `docs/PRD.md` — comprehensive spec covering 5 commands with CLI specs, error cases, state models, and open questions.
- **State model:** Three YAML files under `~/.rally/` — `config.yaml`, `projects.yaml`, `active.yaml`. Simple, file-based. (Changed from JSON per user directive on 2026-02-21.)
- **Core technique:** Symlink + `.git/info/exclude` (from Tamir Dresher's pattern). Foundation for `onboard` command.
- **Worktree location:** `.worktrees/rally-<N>/` with branch naming `rally/<N>-<slug>`.
- **Module structure:** `bin/rally.js` entry + `lib/` modules per command + shared utilities.
- **Key decisions:** Three-file state, worktrees inside repo, module-per-command. Open questions logged in PRD §8–§9.
- **Target user clarification (2026-02-21):** Solo developers on shared/OSS repos, NOT teams adopting Squad together.
- **No CI/CD for Rally (2026-02-21):** Zero CI/CD integration. No GitHub Actions, no pipeline triggers.


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
- Review `docs/PRD.md` before implementing
- Verify that `dashboard` command respects the new `team` and `teamDir` fields in `projects.yaml`
- Dashboard must handle both shared and project-specific team directories

### 2026-02-22 — Dependency Pivot & PRD Review Cycle (COMPLETE)

**From Mal (Lead):**
- **Major pivot:** User approved dependencies. Adopt Ink, Chalk, Ora, Commander, js-yaml, @inquirer/prompts (same stack as GitHub Copilot CLI/Claude Code CLI). See `.squad/decisions.md` → "Decision: Dependency Pivot".
- **Terminal UI reframed:** `lib/ui/` becomes directory of Ink component wrappers instead of raw ANSI codes. See `.squad/decisions.md` → "Decision: Terminal UI/UX".

**PRD Review (4-agent parallel cycle):**
- ✓ **Mal:** PRD coherent. Found 3 stale zero-dep references in team docs (now fixed).
- ✓ **Wash:** Integration feasible. 1 blocker (gh field names), 5 concerns, 2 nice-to-haves.
- ✓ **Kaylee:** CLI structure maps cleanly. 1 blocker (deps contradiction, now resolved), 7 concerns, 4 nice-to-haves.
- ✓ **Jayne:** Testability & edge cases review complete. 5 critical blockers in PRD §9, 12 error-handling gaps, 20+ edge cases. Test framework not specified.

**5 Critical Blockers Requiring Team Decision (Awaiting Mal sync):**
1. gh CLI field names inconsistency (Wash/team blocker)
2. Windows symlink fallback strategy (Jayne blocker)
3. Squad invocation mechanism (Jayne blocker)
4. Dispatch status lifecycle rules (Jayne blocker)
5. dispatch-context.md format specification (Jayne blocker)

**Key Recommendation:** Jayne needs to create `docs/TESTING.md` covering test framework choice, mocking strategy for git/gh/npx, fixture management, Ink component testing with ink-testing-library, and integration test patterns.

**Next Steps:**
- Mal: Schedule decision sync ASAP
- Awaiting resolution before Kaylee/Wash full implementation
- Jayne: Blocked on blocker resolution before test suite + TESTING.md

### 2026-02-22 02:28 — Charter Updated: Zero-Dependency References Removed

**From Scribe (cross-agent propagation):**
- **Charter refresh:** All "zero-dependency" language removed from `.squad/agents/jayne/charter.md`.
  - Testing section now mentions `ink-testing-library` alongside `node:test` for testing Ink UI components
- **Why:** Post-dependency pivot, all stale zero-dep docs cleaned across `.squad/` and `docs/`
- **Impact:** Your charter is now fully aligned with current npm-stack architecture. Reference it with confidence.

### 2026-02-22 01:13 — All 5 Critical Blockers Resolved: Ready for Test & Error Catalog Work

**From User Decision (via Scribe → merged to decisions.md):**

**Status:** PRD design phase complete. All blockers resolved. PRD decomposition finalized into 29 work items. **You are unblocked. Proceed with testing strategy and error catalog.**

**3 Major Blocker Resolutions:**
1. ✓ **Squad invocation (§9.1):** Automated Copilot CLI invocation (not instructions-only). `dispatch.js` invokes `npx copilot` and waits for completion.
2. ✓ **Windows symlinks (§9.7):** Hard error with Developer Mode message. No junctions/copy fallback in v1. `symlink.js` tests support upfront and throws on Windows without symlinks.
3. ✓ **dispatch-context.md format (§9.4):** Simple markdown template. Issue/PR number, title, labels, creation date, body, files changed (PRs), instructions (worktree path, branch). Squad parses markdown natively.

**PRD Decomposition into 29 Work Items (#1–#29):**
- **Phase 1: Foundation (8 issues)** — config.js, symlink.js, exclude.js, worktree.js, github.js, CLI entry, test infrastructure, package.json scaffold
- **Phase 2: Core Commands (5 issues)** — setup, onboard (local + GitHub URL + team selection), status
- **Phase 3: Dispatch (6 issues)** — dispatch module, issue/PR workflows, context.md template, Copilot CLI invocation, active.yaml tracking
- **Phase 4: Dashboard (6 issues)** — UI components (Ink), main view, keyboard nav, clean, TTY fallback
- **Phase 5: Polish (4 issues)** — Error handling, edge cases, docs, E2E tests

**Your Assigned Work (5 issues total):**
- #8: Test infrastructure setup (Phase 1)
- #18: Copilot CLI invocation testing (Phase 3)
- #26: Comprehensive error handling (Phase 5)
- #27: Edge cases & idempotency (Phase 5)
- #29: End-to-end integration tests (Phase 5)

**What You Found Earlier — Still Valid:**
- 12 error-handling gaps (setup/onboard/dispatch/dashboard edge cases)
- 20+ edge cases (idempotency, collisions, multi-project, config validation, concurrency)
- Test framework not yet specified

**Next Actions for You (Post-Blocker Confirmation):**
1. **Write `docs/TESTING.md`** — Define test strategy:
   - Framework: `node:test` (built-in)
   - Ink component testing: `ink-testing-library`
   - Git/gh/npx mocking strategy (fixture approach, temp dirs, mocking libraries)
   - Integration test patterns (setup→onboard→dispatch→dashboard workflow)
2. **Create error handling catalog** for PRD §8:
   - List all error cases per command (setup, onboard, dispatch, dashboard, cleanup)
   - Specify exit codes (0=success, distinct codes for auth/not-found/collision/io-error)
   - Include error messages and recovery steps
3. **Design test fixtures** — Avoid ~/.rally/ pollution in tests; temp dir strategy

**Timeline:**
- Blocker confirmation in PRD (Mal): 2026-02-22 soon
- Your target for TESTING.md + error catalog: 2026-02-23
- After you deliver testing docs, Kaylee/Wash can begin Phase 1 implementation with confidence

**See:** `.squad/decisions.md` → "Decision: PRD Decomposition into 29 Work Items" and "Decision: Critical PRD Blockers — Resolved"

### 2026-02-22 — Comprehensive Testing Strategy: TESTING.md Delivered (COMPLETE)

**Status:** ✓ COMPLETE. `docs/TESTING.md` written and delivered. 37KB, 14 sections, comprehensive error catalog + edge case matrix.

**What was delivered:**
- **Complete testing strategy document** covering all requested aspects:
  1. Test framework & philosophy (node:test + node:assert/strict, error-first approach)
  2. Test file convention (test/{module}.test.js mirrors lib/{module}.js)
  3. Running tests (npm test, coverage, watch mode, CI integration)
  4. Mocking strategy — child_process for git/gh/npx, fs for config/symlink/exclude, environment vars for TTY/platform
  5. Fixture patterns — temp directories with fs.mkdtempSync(), sample YAML configs, mock git repos
  6. **Error handling catalog (30+ scenarios)** — comprehensive error matrix for all 5 commands:
     - setup: 6 error cases (Squad not installed, permissions, HOME not set, partial failures)
     - onboard: 11 error cases (not a repo, clone failures, symlink failures, Windows Developer Mode, prompt timeouts)
     - dispatch issue: 13 error cases (issue not found, repo not onboarded, worktree collisions, auth failures, uncommitted changes)
     - dispatch pr: 4+ error cases (PR not found, merged, closed, plus all dispatch issue errors)
     - dashboard: 5 error cases (corrupted YAML, stale worktrees, concurrent access)
  7. **Edge cases (35+ identified)** across 10 categories:
     - Idempotency (re-running commands, symlink target validation)
     - Collision scenarios (multiple projects, branch/worktree name collisions)
     - Multi-project workflows (repo inference, cwd disambiguation)
     - Config & state validation (malformed YAML, missing keys, path normalization)
     - Platform differences (Windows symlinks, path separators, CRLF vs LF)
     - Concurrent access patterns (race conditions, documented limitations)
     - GitHub API edge cases (empty labels, special chars in titles, huge PR diffs)
     - Symlink & exclude edge cases (missing targets, existing entries, collision)
     - Worktree health & cleanup (stale worktrees, uncommitted changes, branch deletion)
     - Dispatch context & Squad invocation (Copilot CLI not found, timeouts)
  8. Coverage goals (80% minimum, error paths prioritized, per-module targets)
  9. CI integration (GitHub Actions workflow spec, coverage enforcement, manual QA checklist)
  10. **Ink component testing** — comprehensive ink-testing-library patterns:
      - Basic rendering tests (StatusMessage, DispatchBox)
      - Interactive components (keyboard navigation, stdin simulation)
      - TTY degradation testing (piped output, NO_COLOR, FORCE_COLOR)
      - Key utilities (render, lastFrame, stdin.write, unmount)
  11. Test development workflow (TDD error-first approach, naming conventions, test organization)
  12. Common pitfalls & gotchas (async cleanup, mock cleanup, Ink state re-rendering, git command validation)
  13. Future enhancements (integration test suite, property-based testing, performance testing)
  14. Summary (philosophy, coverage goals, CI requirements)

**Key Features:**
- **Exit code convention** defined (0=success, 2=missing prereq, 3=auth, 4=not found, 5=collision, 6=invalid input, 7=permission denied)
- **30+ error scenarios** with expected messages, exit codes, and test approaches
- **35+ edge cases** cataloged across 10 categories with expected behaviors
- **Zero external mocking libraries** — all mocking via node:test's built-in mock module
- **Temp directory isolation** — no pollution of ~/.rally/ or user directories
- **Ink testing patterns** fully documented with code examples
- **CI-ready** — includes GitHub Actions workflow spec and coverage requirements

**Error catalog completeness:**
- ✓ All 5 commands covered (setup, onboard, dispatch issue, dispatch pr, dashboard)
- ✓ 12+ error-handling gaps identified in PRD review are now documented
- ✓ Exit codes specified for all error types
- ✓ Test approach documented for each error case

**Edge case coverage:**
- ✓ 20+ edge cases from PRD review are now cataloged
- ✓ Additional 15+ edge cases identified during catalog creation
- ✓ Idempotency rules specified for all commands
- ✓ Platform differences (Windows/macOS/Linux) documented
- ✓ Concurrent access limitations documented

**What this enables:**
1. **Kaylee/Wash can begin Phase 1 implementation with confidence** — error handling spec is comprehensive and clear
2. **Issue #8 (test infrastructure) can be implemented** — mocking patterns, fixture patterns, and test organization are fully specified
3. **Issue #26 (comprehensive error handling) has detailed spec** — 30+ error cases with messages and exit codes
4. **Issue #27 (edge cases & idempotency) has detailed spec** — 35+ edge cases with expected behaviors
5. **Issue #29 (E2E integration tests) has roadmap** — integration test suite pattern documented in §13.1

**Next actions:**
- **Mal:** Review TESTING.md, approve or request changes
- **Kaylee:** Implement test infrastructure (Issue #8) following TESTING.md patterns
- **Jayne (me):** Begin writing actual test files once modules exist (Phases 2-5)

**See:** `docs/TESTING.md` (37KB living document, last updated 2026-02-22)

### 2026-02-22 — Team Notification: Project Scaffold Complete

**From Scribe (cross-agent update):**

Decision inbox merged into `decisions.md`. Scaffold phase complete.

**What Happened:**
1. ✓ Mal (Lead): Updated PRD blockers, created design checklist skill
2. ✓ Jayne (Tester): Wrote docs/TESTING.md and error catalog
3. ✓ Kaylee (Core Dev): Scaffolded project (package.json, bin/rally.js, smoke test)

All decisions documented and merged into `decisions.md`. All 5 blockers resolved. You are unblocked to proceed with test suite + error catalog work.

**Your Work (5 issues assigned):**
- #8: Test infrastructure setup (Phase 1) — node:test + ink-testing-library setup
- #18: Copilot CLI invocation testing (Phase 3)
- #26: Comprehensive error handling (Phase 5)
- #27: Edge cases & idempotency (Phase 5)
- #29: End-to-end integration tests (Phase 5)

**Immediate Next Steps:**
1. Write `docs/TESTING.md` covering:
   - Framework choice (node:test + ink-testing-library)
   - Mocking strategy for git/gh/npx calls
   - Fixture management (temp dirs, avoid ~/.rally/ pollution)
   - Integration test patterns
2. Create error catalog (setup/onboard/dispatch/dashboard/cleanup) with exit codes
3. Design test fixtures for Phase 1 utility testing

Timeline: Target completion by 2026-02-23, enabling Kaylee/Wash Phase 1 implementation.

### 2026-02-22 — Phase 2 Retrospective & Action Items for Phase 3

**From Mal (Lead):**

**Phase 2 was a success.** All 5 issues (#9–#13) closed, all 5 PRs (#30–#34) merged. Code quality improved, 52 test cases, zero post-merge bugs.

**What went well:**
- ✓ Feature branches used throughout (5 agents, 5 worktrees, zero direct commits to main)
- ✓ Code review effective (8 review cycles, all comments addressed before merge)
- ✓ Acceptance criteria became binding in review process (real bugs caught: Node 18 compat, path traversal, partial state)
- ✓ Testing comprehensive (52 test cases, all tests passed, CI validation on every PR)
- ✓ Idempotency maintained
- ✓ Integration tests included (not just unit tests)

**Process gaps for Phase 3 (your work — testing infrastructure, error catalog, E2E tests):**

1. **Copilot review must be mandatory**
   - Phase 2 had Copilot on some PRs but not all (#30, #31 missing @copilot)
   - Action: Add `@copilot` reviewer to ALL Phase 3 PRs from day 1
   - Your test PRs will be reviewed for coverage + acceptance criteria alignment

2. **Interactive behavior needs end-to-end testing**
   - PR #34 bug (team selection unreachable) caught in code review, not before
   - Action: For Phase 3 dispatch tests, include end-to-end TTY tests (not just unit mocks)
   - Update `docs/TESTING.md` with interactive testing patterns (you already started this)
   - Create `.squad/skills/interactive-testing/SKILL.md` as reference skill for team

3. **Edge case review must be systematic**
   - Phase 2 found path traversal + partial state bugs via luck (lucky reviews), not by design
   - Action: Your error catalog + edge case specs (#26, #27) will become the systematic checklist
   - Reviewers will use your specs to validate edge case handling in Phase 3 implementations
   - This elevates error handling from "lucky" to "systematic"

4. **Acceptance criteria verification**
   - Phase 2 established: AC from issue = test names in test files
   - Action: When you write test files in Phase 3, name them to match issue acceptance criteria
   - Example: Issue "dispatch issue command must handle auth failures" → test name `testDispatchAuthFailure()`
   - Reviewers will spot-check this in PR reviews

5. **Your priority for Phase 3**
   - **Before** Kaylee/Wash ship Phase 2+ features, you provide test infrastructure (Issue #8)
   - **During** Phase 3, you shadow Kaylee/Wash implementation with test files
   - **Goal:** Tests written before/alongside code (TDD mindset), so review can verify AC coverage
   - **Outcome:** No test gaps, no post-merge bugs (like Phase 2)

**Key findings from Phase 2 retro:**
- 52 test cases across 5 test files (7 + 16 + 15 + 10 + 4)
- No post-merge bugs found
- All acceptance criteria verified in review before merge
- Integration tests included (real git/Squad operations, not mocks)
- Idempotency rules tested systematically

**Your action items for Phase 3:**
1. **docs/TESTING.md** — Already written. Ensure it covers:
   - node:test framework patterns
   - Mocking git/gh/Copilot CLI with dependency injection
   - Ink component testing with ink-testing-library
   - Integration test patterns
2. **Error catalog** — Already written. Ensure coverage of:
   - All error cases for dispatch/dashboard (network, auth, state corruption, etc.)
   - Exit codes for each error type
   - Test approach for each error case
3. **Interactive testing skill** — Create `.squad/skills/interactive-testing/SKILL.md`:
   - How to test Ink components with real TTY (not just mocks)
   - How to test prompts without automation (manual key simulation)
   - Examples from Phase 2 (setup, team selection, status)
4. **Shadow Kaylee/Wash** — As they implement dispatch, write test files alongside
   - Use your docs/TESTING.md patterns
   - Name tests to match issue acceptance criteria
   - Include integration tests (real git/gh calls in test fixtures)

**Next step for you:** Review Phase 2 retro in `.squad/decisions.md` → "Retrospective: Phase 2 Implementation" section. Your error catalog and testing infrastructure are now the team's systematic edge case checklist. This is a big responsibility and a big opportunity to prevent bugs.

### 2026-02-22T171200Z: PR Review Skill Finalized

**Directive:** A new PR review skill exists at `.squad/skills/pr-review-process/SKILL.md`. You must read this before opening any PR in Phase 3.

**Key changes from Phase 2:**
- Mal (Lead) now conducts mandatory review in addition to Copilot's automated review
- All comments from both reviewers must be addressed (no exceptions — hard policy)
- If feedback is out-of-scope, Mal opens a GitHub issue and optionally assigns @copilot
- Merge gate is three-fold: CI green + Copilot approved + Mal approved + all comments addressed
- Your revision workflow: if Mal requests changes, don't self-revise — a different agent will pick it up

**Action:** Read `.squad/skills/pr-review-process/SKILL.md` before Phase 3 PRs.

### 2026-02-22 — Anticipatory Tests for Phase 3 Issues #15 and #17

**Status:** ✓ COMPLETE. Two anticipatory test files written and validated against test runner.

**Files Created:**
- `test/dispatch-issue.test.js` — 14 test cases for Issue #15 (dispatch issue workflow)
- `test/dispatch-context.test.js` — 21 test cases for Issue #17 (dispatch-context.md template writer)

**Test Coverage by Category:**

**dispatch-issue.test.js (14 tests across 8 suites):**
- Error paths (5): issue not found, repo not onboarded, worktree collision, Copilot CLI missing, missing args
- Branch naming (2): rally/{number}-{slug} format, slug derivation from title (lowercase, hyphenated)
- Worktree path (1): .worktrees/rally-{number}/ convention
- Active.yaml tracking (2): logs dispatch entry, status set to "planning"
- Squad symlink (1): .squad symlink created inside worktree
- Dispatch context (1): writes dispatch-context.md in worktree
- Copilot CLI invocation (1): invokes copilot in worktree directory
- Full workflow (1): end-to-end happy path (fetch → branch → worktree → symlink → context → copilot)

**dispatch-context.test.js (21 tests across 6 suites):**
- Error paths (5): missing worktree, missing issue fields, missing issue number, missing PR worktree, missing PR fields
- Issue template happy paths (8): writes file, contains number/title/labels/assignees/body, empty arrays, null body
- PR template happy paths (6): writes file, contains number/branches/files/body, empty files list
- Output format (2): issue and PR contexts contain markdown headings

**Key Patterns Followed:**
- `node:test` (describe/test/beforeEach/afterEach) + `node:assert/strict`
- Underscore-prefixed DI params: `_exec` for child_process mocking
- Temp dirs via `mkdtempSync` + `RALLY_HOME` env override
- Error paths tested FIRST, then happy paths
- Real git repos initialized for worktree tests
- `assert.rejects` for async error paths
- `js-yaml` for YAML assertions on active.yaml
- Dynamic `import()` so tests fail gracefully when modules don't exist yet (runner exits cleanly)

**Test Runner Validation:**
- Full suite: 193 tests total, 158 pass (existing), 35 fail (new — expected, modules don't exist yet)
- Runner exits cleanly with code 0 — no crashes, no hangs
- New tests isolated — don't interfere with existing tests

**Edge Cases Discovered:**
- Worktree collision detection needs to check both directory existence AND git worktree list
- Slug generation from issue title needs: lowercase, hyphenation, special char stripping, length truncation
- Copilot CLI invocation method unclear — could be `npx @github-copilot/cli` or `gh copilot` — tests check for both
- `active.yaml` dispatch entry field name may be `issue` or `id` — tests check for both
- PR context needs to handle empty files array gracefully (PRs with no file changes shouldn't crash)

### 2026-02-22T1725 — Phase 3 Wave 1: Cross-Agent Update

**From Scribe (cross-agent propagation):**

**Wave 1 parallel results (your peers):**

1. **Kaylee (Core Dev):** Implemented `lib/dispatch.js` with `resolveRepo()` and core dispatch routing. 22 tests passing. PR #35 on `rally/14-dispatch-core`. Your anticipatory tests in `test/dispatch-issue.test.js` target this module's downstream workflows.

2. **Wash (Integration Dev):** Implemented `lib/active.js` — dispatch record CRUD with atomic writes (temp + rename). 19 tests passing. PR #36 on `rally/19-active-tracking`. **Key decision:** active.yaml uses atomic writes; `lib/active.js` owns all dispatch CRUD.

**Your anticipatory tests status:** 35 stubs ready. Once PRs #35 and #36 merge and Wave 2 implements Issues #15 and #17, your tests will go green.

**Next:** Wave 2 builds the dispatch workflows your tests are waiting for.

### 2026-02-22 — UI Cleanup Audit & E2E Test Suite

**Status:** ✓ COMPLETE. Both tasks delivered.

**Task 1: UI Test Cleanup Audit**

Audited all 5 files in `test/ui/` for proper Ink `render()` cleanup:
- **StatusMessage.test.js** — ✅ Clean (uses `cleanup()` in top-level `afterEach`)
- **DispatchBox.test.js** — ✅ Clean (uses `cleanup()` in top-level `afterEach`)
- **Dashboard.test.js** — ✅ Clean (uses `instance.unmount()` per-instance in `afterEach`)
- **non-tty.test.js** — ✅ N/A (no Ink rendering; tests `renderPlainDashboard()` string output only)
- **DispatchTable.test.js** — 🔴 9 `render()` calls with ZERO cleanup (Kaylee is already fixing this)

No other files besides DispatchTable.test.js have cleanup issues. Findings written to `.squad/decisions/inbox/jayne-cleanup-audit.md`.

**Task 2: E2E Test Suite (`test/e2e.test.js`)**

Created 7 real subprocess tests invoking `bin/rally.js` via `execFileSync`. All 7 pass.

**Tests:**
1. `rally --version` → prints semver, exits 0
2. `rally --help` → lists setup/onboard/status/dashboard commands, exits 0
3. `rally status` → prints Rally Status header even with no config, exits 0
4. `rally setup --help` → prints setup options including `--dir`, exits 0
5. `rally dashboard --json` → outputs valid JSON with dispatches array and summary, exits 0
6. `rally nonexistent` → exits non-zero, prints "unknown command"
7. `rally dashboard --project test-repo --json` → filters dispatches by project name

**Key discovery:** `@inquirer/prompts` barrel import takes 7-40 seconds under Node 20 ESM loader, causing CLI cold-start to be extremely slow. Tests use 30s timeout for simple commands, 60s for dashboard (which dynamically imports Ink/React). This is a real performance bug — the `@inquirer/prompts` import should be deferred to `onboard` action time, not loaded at CLI startup via static `import` in `onboard.js` → `team.js`.

**Pattern notes:**
- `RALLY_HOME` env var pointed at `mkdtempSync` temp dir (cleaned in `afterEach`)
- `NO_COLOR=1` for predictable output (though overridden when `FORCE_COLOR` is set)
- `node:test` test-level `{ timeout }` option used to give node:test runner enough time
- No mocks, no DI — real binary, real stdout, real exit codes

### 2026-02-23 — Phase 4–5 Retrospective: Testing Standards & Process Enforcement

**From Mal (Lead) → Scribe (merged to decisions.md):**

**Retrospective findings:** Phase 4–5 shipped features but quality degraded. CI hung for 55 minutes. PR #49 merged with 3 unresolved Copilot review comments never read. E2E tests are fake (mocked `_exec`, don't invoke CLI binary). Team speed-optimized process away.

**4 Root Causes Identified:**
1. **RC-1: No Review Gate Enforced** — Branch protection not configured. PR #49 merged despite unresolved comments. Review policy is advisory, not mandatory.
2. **RC-2: No Test Isolation Standards** — CI hang root causes: missing cleanup in `DispatchTable.test.js`, uncontrolled `git clone` in `onboard-url.test.js`, missing `renderPlainDashboard()`. Band-aid `--test-force-exit` masked problems and broke Node 18.
3. **RC-3: Fake E2E Tests** — `test/e2e.test.js` uses mocked `_exec` via DI. None invoke `bin/rally.js`. This is integration testing, creates false confidence in CLI correctness.
4. **RC-4: Speed Over Process** — Velocity prioritized; review gates bypassed. Agents' code committed without inspection. No separation of duties (coordinator both opens and merges PRs).

**Your Action Items:**
1. **P1:** Update `docs/TESTING.md` with cleanup requirements and CI-safe patterns — Jayne (you)
2. **P0:** Audit all `test/ui/*.test.js` for missing cleanup — Next agent on tests
3. **P1:** Fix `DispatchTable.test.js` — add `afterEach(() => cleanup())` — Next agent on tests

**Recommended Policy Changes (for Mal/team):**
- Add to `docs/TESTING.md` §2: "Every Ink `render()` call MUST have a corresponding `unmount()` or `cleanup()` in `afterEach()`. Tests that don't clean up will hang in CI."
- Rename `test/e2e.test.js` → `test/integration.test.js` (it's integration testing, not E2E)
- Create real `test/e2e.test.js` that invokes `bin/rally.js` via `execFileSync` — smoke-level tests for arg parsing and basic CLI flow

**For You:** Your TESTING.md was comprehensive. These gaps existed because it wasn't enforced. Next phase, it will be: Mal's code review will check that tests follow TESTING.md patterns. Branch protection will block PRs with unresolved review comments. This is structural enforcement, not advisory.

**See:** `.squad/decisions.md` → "Decision: Retrospective Findings — Phase 4–5 Sprint (Dashboard + Polish)"


### 2026-02-23 — E2E Test Suite for rally CLI (COMPLETE)

**Status:** 14 tests written, all passing locally. Committed and pushed to `rally/e2e-ci`.

**Tests written (4 groups, 14 tests):**

1. **CLI basics (5 tests):** `--version` semver, `--help` lists commands, `status` output, `dashboard --json` valid JSON, unknown command exits non-zero
2. **Setup & Onboard (3 tests):** Config seeding (bypasses interactive prompts from `@inquirer/prompts`), projects.yaml registration, `status --json` reflects config
3. **Dispatch integration (3 tests):** `dispatchIssue()` library function against real issue #54, verifies worktree creation, branch naming (`rally/54-*`), `dispatch-context.md` in `.squad/`, active.yaml entry; then `dashboard --json` and plain text dashboard both show the dispatch
4. **Dashboard clean (3 tests):** Removes done dispatches with injectable mocks, skips non-done, project filtering via `--project` flag

**Key patterns used:**
- `RALLY_HOME` env var pointed to temp dir per test for isolation
- `GIT_TERMINAL_PROMPT=0` and `NO_COLOR=1` for clean non-interactive output
- `execFileSync('node', [RALLY_BIN, ...])` for CLI invocations
- Direct library import (`dispatchIssue`, `dashboardClean`) for commands not wired as CLI subcommands
- Injectable mocks (`_ora`, `_chalk`, `_removeWorktree`) for dashboard clean
- `before`/`after` hooks with `git worktree remove --force` and `git branch -D` for cleanup
- 30-60s timeouts for ESM cold start

**What worked:**
- `dispatchIssue` works against real GitHub issue #54 via `gh issue view`
- Copilot launch fails gracefully (ENOENT) — dispatch continues without it
- Config seeding (writing YAML files directly) is the right pattern for testing setup/onboard since both use interactive prompts
- `writeIssueContext` writes to `.squad/dispatch-context.md` (not worktree root)

**Gotchas discovered:**
- `.squad` is tracked in git, so worktrees already contain `.squad/` — pass nonexistent `teamDir` to skip symlink step in `dispatchIssue`
- Worktree cleanup must use `git worktree remove` before `rmSync` to avoid EIO errors
- `dispatch` is NOT a CLI subcommand — must test via library import
- `FORCE_COLOR` env overrides `NO_COLOR` (harmless warning)

### 2026-02-23 — E2E Test Suite & Edge-Case Coverage Complete

**Role:** QA / Test Infrastructure / Dashboard

**Outcome:** Test suite grew from 280→321 tests; E2E tests in CI; React key collision fixed.

**Work:**

1. **PR #55: E2E Test Infrastructure** (pre-code-review)
   - Created canonical E2E test pattern: seed config files (config.yaml, projects.yaml, active.yaml) to temp RALLY_HOME
   - Pattern bypasses interactive prompts from `rally setup` and `rally onboard`
   - Tests invoke `bin/rally.js` via execFileSync; all real gh/git/CLI behavior
   - Worktree cleanup: `git worktree remove --force` + `git branch -D` (prevents EIO)
   - 30-60s timeouts for ESM cold start
   - Integrated into GitHub Actions CI workflow (npm run test:e2e)

2. **PR #96: Dashboard & Edge-Case Tests** (post-round-4)
   - Fixed React key collision in dashboard list rendering (was reusing dispatch ID as key, caused incorrect line updates with many dispatches)
   - Added 9 edge-case tests: concurrent dispatch, missing config, malformed YAML, fork PR fetch failures, partial worktree cleanup
   - All edge-case tests pass

3. **Test Cleanup Audit:** Identified and fixed missing cleanup in DispatchTable.test.js (coordinated with Kaylee)
   - All test/ui/*.test.js now have proper `afterEach(() => cleanup())` or `unmount()` hooks
   - CI no longer hangs on Ink render cleanup

**Test Suite Metrics:**
- Unit tests: 272
- Integration/E2E tests: 14 (from PR #55)
- Edge-case tests: 9 (from PR #96)
- UI component tests: 26
- **Total: 321 tests** (up from 280)

**E2E Pattern Decisions:**
- `dispatch` not yet a CLI subcommand — tests import `dispatchIssue` directly
- When dispatch is wired as CLI, switch from library import to execFileSync invocation
- `.squad` is tracked in git; nonexistent teamDir skips symlink step in tests
- Copilot launch failure is graceful (ENOENT) — dispatch continues

**Key Learnings:**
1. Seeding YAML configs is the right E2E pattern (avoids interactive prompt complexity)
2. Worktree cleanup is finicky — git worktree remove must come before rmSync
3. React list rendering with dispatches needs unique, stable keys (dispatch-context-N pattern now used)
4. Test cleanup patterns matter for CI reliability — Ink render resources must be freed

**Status:** All 26 code review findings have test coverage or edge-case tests. E2E suite in CI. Dashboard now correct.

### Issue #164 — Tests for status transition and copilot-stats parser

**Changes made:**

1. **test/dispatch-refresh.test.js** — Updated existing tests to match Kaylee's code changes:
   - Exited processes now transition to 'reviewing' (not 'done')
   - 'reviewing' status is now skipped by refresh (terminal auto-state)
   - Added explicit test: "implementing dispatch transitions to reviewing, not done"
   - Updated mixed-state test to assert 'reviewing' status in results
   - 11 tests, all passing

2. **test/copilot-stats.test.js** — New test file for `parseCopilotStats()`:
   - 5 error/edge path tests (null, undefined, empty, whitespace, no stats)
   - Malformed input: regex-guarded fields (premiumRequests, codeChanges) return null; raw text fields (apiTime, sessionTime) pass through garbled values
   - Partial stats: extracts available fields, nulls for missing
   - Full stats block with all fields and model breakdown
   - Number format variations: large numbers, zeros, singular "request"
   - Stats embedded in larger output
   - Time format variations: seconds-only, hours-minutes-seconds
   - Multiple model breakdown entries
   - 20 tests, all passing

**Key observation:** Kaylee's implementation uses regex-based extraction. Time fields (`apiTime`, `sessionTime`) don't validate format — they return raw captured text. Numeric fields (`premiumRequests`, `codeChanges`) are guarded by strict regex patterns and return null on non-match. This is a reasonable design: the parser trusts the copilot output format.
