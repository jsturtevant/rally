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
