# Phase 2 Retrospective: Rally Setup, Onboard, and Status Commands

**Facilitated by:** Mal (Lead)  
**Phase:** Phase 2 (Issues #9–#13)  
**Review Date:** 2026-02-22  
**PRs Merged:** #30–#34  
**Status:** All 5 issues closed, all 5 PRs merged

---

## 1. What Happened — Facts Only

### PRs Delivered

All 5 Phase 2 features merged with code review and CI validation:

| PR | Title | Issue | Files | Tests | Merged | Status |
|----:|-------|-------|------:|------:|--------|--------|
| #30 | rally status command | #13 | 3 | 4 | 2026-02-22T03:27 | ✓ shipped |
| #31 | rally setup command | #9 | 3 | 7 | 2026-02-22T03:21 | ✓ shipped |
| #32 | rally onboard local repos | #10 | 4 | 16 | 2026-02-22T04:17 | ✓ shipped |
| #33 | GitHub URL cloning | #11 | 3 | 15 | 2026-02-22T04:44 | ✓ shipped |
| #34 | team selection prompt | #12 | 6 | 10 | 2026-02-22T04:55 | ✓ shipped |

**Total:** 19 files changed, 1,828 additions, 47 deletions. 11 test files, 52 test cases.

### Feature Branch Discipline

✓ **Phase 2 followed proper workflow:**
- All 5 PRs used feature branches: `rally/9-setup`, `rally/10-onboard`, `rally/11-url-onboard`, `rally/12-team-selection`, `rally/13-status`
- All commits on feature branches before PR, then merged to main
- Zero direct commits to main during Phase 2 (contrast with Phase 1's 5 direct commits)
- Git log shows clean merge structure: feature branch → PR merge → main advance

**This is a 180° improvement from Phase 1**, where all code bypassed PRs entirely.

### Code Review Process

**Mal review metrics:**
- PR #30: 1 review (requested changes on Node 18 compat, then approved)
- PR #31: 1 review (approved)
- PR #32: 2 reviews (approved, then re-approved after Copilot comments)
- PR #33: 2 reviews (suggested fixes, then re-approved)
- PR #34: 2 reviews (suggested fixes, then re-approved)

**Total:** 8 review cycles across 5 PRs. Average 1.6 reviews per PR. **All review comments addressed before merge.**

**Copilot review:**
- PR #32: Copilot generated 7 comments (worktree detection, defensive parsing, template symlinks). All addressed.
- PR #33: Copilot generated 13 comments (URL parsing edge cases). All addressed.
- PR #34: Copilot reviewed, no new comments (all concerns covered by human review).

**Review quality:** No post-merge bugs found. All acceptance criteria verified in review. Edge cases caught (Node 18 compat, path traversal, partial state).

### CI Pipeline

✓ **All 5 PRs had CI validation:**
- Node 18, 20, 22 compatibility checks on every PR
- Squad CI integration test included
- Zero CI failures on final merged commits
- 4/4 checks passing on each merge commit

### Testing Coverage

✓ **52 test cases written for Phase 2 features:**
- `setup.test.js`: 7 tests (directory creation, config format, Squad init, idempotency)
- `onboard.test.js`: 16 tests (symlinks, exclude, projects.yaml, local paths, idempotency)
- `onboard-url.test.js`: 15 tests (URL parsing, shorthand, clone integration, edge cases)
- `team.test.js`: 10 tests (team selection, interactive prompts, reuse, validation)
- `status.test.js`: 4 tests (JSON output, formatted text, config paths, dispatch registry)

**All tests use `node:test` framework per project constraints.** No external test framework added.

**Test modules also include integration tests** (not just unit):
- PR #32: 16 tests including symlink verification and `.git/info/exclude` validation
- PR #33: 5 tests include actual clone flow (git operations)
- PR #34: Tests cover interactive prompt reachability (key acceptance criterion)

### Acceptance Criteria Verification

All acceptance criteria from 5 issues were verified in code review before merge:

**Issue #9 (setup):**
- [x] Creates `~/.rally/team/` directory
- [x] Creates `~/.rally/projects/` directory
- [x] Runs `squad init` in team dir
- [x] Writes `config.yaml`

**Issue #10 (onboard local):**
- [x] Creates Squad symlinks (`.squad`, `.squad-templates`, `.github/agents/squad.agent.md`)
- [x] Adds exclude entries to `.git/info/exclude`
- [x] Registers project in `projects.yaml`
- [x] Idempotent on re-run

**Issue #11 (GitHub URLs):**
- [x] Accepts GitHub URLs (full HTTPS and shorthand `owner/repo`)
- [x] Clones to `~/.rally/projects/<repo>/`
- [x] Maintains clone idempotency (skips if exists)
- [x] Falls back to local path handling

**Issue #12 (team selection):**
- [x] Interactive prompt for shared vs project-specific team
- [x] `--team <name>` flag to bypass prompt
- [x] Creates/reuses team directories
- [x] Backward compatible (no flag = interactive prompt)

**Issue #13 (status):**
- [x] Shows all config paths (`~/.rally/config.yaml`, `~/.rally/projects/`, `~/.rally/teams/`)
- [x] Lists onboarded projects from `projects.yaml`
- [x] Lists active dispatches from `active.yaml`
- [x] `--json` flag outputs valid JSON

---

## 2. What Went Well

### Workflow Discipline Established

**Phase 1 was a complete process failure** (all code direct to main, zero PRs). **Phase 2 corrected this completely.** The new workflow from the Phase 1 retro worked as designed:

- Feature branches → PRs → Mal review → CI validation → merge
- Zero direct commits to main
- All review comments addressed before merge
- Issues properly closed by PR merge (GitHub auto-close)

**This validates the process fix.** The workflow is now a team standard.

### Code Quality Improved Over Phase 1

- **Security:** Path traversal defenses (regex character classes, explicit `includes('..')` checks), command injection prevention (`execFileSync` with array args), proper error handling
- **Dependency injection patterns:** `_exec`, `_select`, `_input` hooks make interactive flows testable without TTY mocking
- **Edge case coverage:** Windows path handling (symlink vs junction auto-detect), Node 18 compatibility (no `import.meta.dirname`), trailing slashes in URLs, partial state recovery
- **Integration testing:** Tests include actual git operations, Squad invocation, file system state verification

### Acceptance Criteria Became Binding

Review process enforced that **acceptance criteria had to be verified before merge.** This caught real issues:

- PR #30: Node 18 test failure caught in review → fixed before merge
- PR #33: Path traversal and trailing slash handling improved in code review → all edge cases covered
- PR #34: Interactive prompt unreachable + partial state bug caught in review → both fixed

**This didn't happen in Phase 1** (tests were written, but weren't part of the review gate).

### Good Code Practices Emerged

- **Consistent patterns:** All modules use `RALLY_HOME` env var for config dir (testability), `execFileSync` with array args (safety), pure functions where possible (symlink/exclude logic)
- **Defensive parsing:** Try/catch on file operations, existence checks before mutations, `||` operators for defaults
- **Idempotency:** All 5 commands are idempotent — re-running produces same result, no duplicates, no errors
- **Node 18+ compatibility:** No modern-only APIs (`import.meta.dirname` caught and fixed, no optional chaining on undefined, no nullish coalescing assumptions)

### Reviewer Diligence

Mal's reviews were **specific and actionable:**
- Cited test names when validating acceptance criteria
- Identified root causes (not just "this is broken") — e.g., Node 18 API differences, URL regex edge cases
- Provided fix recommendations with code examples
- Re-reviewed after fixes with explicit verification

This prevented comment hell and kept PR cycles short (1–2 rounds per PR).

---

## 3. What Didn't Go Well

### Interactive Prompts Broken Initially (PR #34)

**Issue:** Team selection prompt was unreachable in production. The `selectTeam()` function was gated behind `_select` (test-only hook), so plain `rally onboard` never triggered the interactive flow.

**Root cause:** Reviewer didn't catch the condition logic in first pass. Caught in second review → fixed → re-approved.

**Impact:** Not caught until review; would have failed user acceptance. **Process worked, but revealed that acceptance criteria can be subtle** (interactive behavior is harder to verify from code than file I/O).

### Partial State Bug Also in PR #34

**Issue:** If `squad init` failed after mkdir, the team dir existed but was incomplete (no `.squad/`). Retry with `--team` would skip init and leave broken symlinks.

**Root cause:** State cleanup not included in error paths.

**Fixed:** Added try/catch + rmSync on failure.

**Impact:** User-facing bug if Squad invocation failed. Caught in review → fixed before merge.

### Two Code Issues in PR #33 (Path Traversal + Trailing Slashes)

**Issue 1:** Repo names with `..` could slip through the regex and cause `path.join(projectsDir, '..')` to escape the projects directory.
**Issue 2:** `https://github.com/owner/repo/` with trailing slash fell through to local path handling.

Both easy one-line fixes, both caught in review, both fixed → re-approved.

**Root cause:** Edge cases not fully enumerated before coding. Reviewer's security mindset caught what the coder missed.

### @copilot Not Added as Reviewer

**Status:** Copilot generated 13 useful comments on PR #32 and #33, but was not added as a formal reviewer on #30 and #31. Mal's notes mention "GitHub Copilot was not added as a reviewer per team directive" in PR #30 review.

**Context:** Copilot CLI (`@copilot`) is the team's code reviewer tool. Seems like a process gap — was Copilot review supposed to be optional or was there a directive?

**Impact:** Medium. Copilot found real issues. But all issues were caught by Mal's human review anyway, so no quality loss.

### No Pre-Review Linting / Formatting Validation

**Observation:** No linting output in PR descriptions. No mention of ESLint, Prettier, or style validation. Assuming this is intentional (project is new, may not have linter setup yet), but worth noting.

### Test Framework Spec Issue Incomplete

All tests use `node:test` ✓, but `docs/TESTING.md` hasn't been written yet (was flagged in Phase 1 retro as unblocking item for Jayne). **Not blocking Phase 2, but creates knowledge gap.**

---

## 4. Action Items for Phase 3 (Dispatch Implementation)

### Process Improvements

1. **Copilot review as mandatory gate**
   - Phase 2 had Copilot comments on some PRs but not others
   - Add `@copilot` as reviewer on ALL Phase 3 PRs (dispatch, dashboard, error handling)
   - Establish: If Copilot generates comments, they must be addressed before merge (like human review)
   - Mal is responsible for ensuring this happens

2. **Interactive behavior validation checklist**
   - Issue #12 (team selection) wasn't fully tested in context until review
   - For Phase 3's dispatch command (which is heavily interactive), add a pre-review validation step: "Test this command end-to-end with a real TTY"
   - Create `.squad/skills/interactive-testing/SKILL.md` documenting how to test Ink components without automated tools

3. **Acceptance criteria as test list**
   - Phase 2 established good practice: AC = test names
   - Continue this in Phase 3
   - Mal should include "Acceptance Criteria Summary" section in merge reviews (like PR #31)

4. **Edge case review template**
   - PR #33 (path traversal) and PR #34 (partial state) showed that edge cases need a systematic review
   - Before Phase 3, create a checklist: what are the common edge cases for dispatch? (aborted invocation, network errors, worktree conflicts, Squad state corruption, partial merge)
   - Include in review template

### Code Patterns to Preserve

1. **Dependency injection for testing** (`_exec`, `_select`, `_input` parameters) — keep this pattern in dispatch and dashboard
2. **Idempotency** — all Phase 3 commands should be idempotent (re-run dispatch = no change, clean = safe to re-run)
3. **Node 18+ compatibility** — no `import.meta.dirname`, no modern-only APIs
4. **execFileSync with array args** — continue using this for CLI invocation safety

### Phase 3 Specific

1. **Dispatch context format** — write `.squad/decisions/inbox/phase3-dispatch-context-spec.md` before Kaylee starts (#15 feat: dispatch issue command)
   - Should specify `dispatch-context.md` format (already in PRD §9.4 as "simple markdown template")
   - Document what metadata goes in it, how Squad should parse it
   - Get James sign-off before coding

2. **Squad invocation safety** — test that Copilot CLI can be invoked with dispatch context
   - PRD §9.1 says "Automated CLI invocation. Rally launches Copilot CLI automatically with appropriate prompt"
   - Create a test plan: does `npx @github-copilot/cli chat --model gpt-4 < dispatch-context.md` work? What error cases exist?
   - Get Wash to validate against real CLI before Kaylee codes dispatch invocation

3. **Dashboard alternate screen buffer** — test on multiple terminals before shipping
   - PRD §5 specifies `\x1b[?1049h/l` for alternate screen buffer
   - Edge cases: terminal resize while dashboard running, rapid q (quit) presses, piped output (should not use buffer)
   - Phase 4 concern, but worth flagging now

4. **docs/TESTING.md** — Jayne should write this in Phase 3 (was blocked by blocker resolutions, now clear)
   - Document how to test interactive Ink components
   - Document how to test node:test with injected exec/prompt hooks
   - Include example test file (setup.test.js or team.test.js)

### Team Calibration

**For Coordinator / James:**

Phase 2 showed that **workflow instructions matter.** Phase 1 failed because agents weren't told to use feature branches. Phase 2 succeeded because the instructions were explicit (create feature branch, push, open PR, wait for review). The worktree + feature branch approach from the Phase 1 retro worked perfectly.

**Recommendation:** Continue this for Phase 3. Each agent gets:
1. A worktree + feature branch assignment (parallelism)
2. Explicit step-by-step workflow (branch → commit → push → PR → review wait → merge)
3. A feature owner (Kaylee for dispatch, Wash for PR integration, Jayne for tests)
4. A review gate (Mal + Copilot + CI)

**For Mal (future retros):**

Establish a standard retro question checklist:
- [ ] Did PRs use feature branches? (workflow discipline)
- [ ] Did review catch acceptance criteria issues? (quality gate)
- [ ] Did all tests pass? What was the coverage ratio? (test health)
- [ ] Did CI gate any merges? (automation trust)
- [ ] Did edge case review happen or was it lucky? (robustness)

This will help quantify improvement over time.

---

## Summary

**Phase 2 was a success.** The team corrected the Phase 1 process failure and delivered 5 solid features with proper reviews and tests. Feature branches worked, code review found real issues, and CI validated all merges. The new workflow is now established and should carry forward.

**Three process gaps worth fixing for Phase 3:**
1. Copilot review should be mandatory, not optional
2. Interactive behavior needs end-to-end testing, not just unit tests
3. Edge case review should be systematic, not lucky

**Code quality is good.** No post-merge bugs, all acceptance criteria met, idempotency maintained, and security-conscious error handling in place. The team is ready for the larger Phase 3 (dispatch) implementation.

**Recommended next step:** Resolve dispatch context format spec with James before Phase 3 kickoff (takes 15 min, prevents rework).
