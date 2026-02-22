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
