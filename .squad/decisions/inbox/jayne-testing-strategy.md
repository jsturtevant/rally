# Decision: Comprehensive Testing Strategy Delivered

**By:** Jayne (Tester)  
**Date:** 2026-02-22  
**Status:** Delivered for Review

---

## Summary

Created `docs/TESTING.md` — a comprehensive 37KB testing strategy document covering Rally's test framework, mocking patterns, fixtures, error handling catalog, edge cases, coverage goals, CI integration, and Ink component testing.

## What Was Delivered

### Complete Testing Strategy (`docs/TESTING.md`)

**14 sections covering:**

1. **Test Framework & Philosophy**
   - node:test + node:assert/strict (zero external test frameworks)
   - Error-first approach: test unhappy paths before happy paths
   - Isolation: no pollution of ~/.rally/ or user directories
   - Exit codes verified alongside stderr output

2. **Test File Convention**
   - `test/{module}.test.js` mirrors `lib/{module}.js`
   - ESM imports (`import` syntax, .js extension)

3. **Running Tests**
   - `npm test` runs all tests
   - Coverage with `--experimental-test-coverage` (Node 20+)
   - Watch mode support
   - CI integration via GitHub Actions

4. **Mocking Strategy**
   - **child_process:** Mock `execSync` for git/gh/npx commands with command validation
   - **fs:** Mock filesystem operations for config/symlink/exclude tests
   - **Environment:** Mock `process.env`, `process.platform`, `process.stdout.isTTY`
   - **Zero external mocking libraries** — use node:test's built-in mock module only

5. **Fixture Patterns**
   - Temp directories via `fs.mkdtempSync()` for git operations
   - Inline YAML strings for config tests (no separate fixture files)
   - Mock git repos with minimal directory structures
   - Always clean up in `t.after()`

6. **Error Handling Catalog (30+ scenarios)**

   **Exit Code Convention Defined:**
   - 0 = Success
   - 2 = Missing prerequisite (git, gh, config)
   - 3 = Authentication failure
   - 4 = Not found (issue, PR, repo, file)
   - 5 = Collision (worktree/branch exists)
   - 6 = Invalid input
   - 7 = Permission denied

   **Error Matrix by Command:**
   - **setup:** 6 error cases (Squad not installed, permissions, HOME not set, partial failures, config write fails)
   - **onboard:** 11 error cases (not a repo, setup not run, clone failures, invalid URLs, symlink failures, Windows Developer Mode, permission denied, exclude write fails, prompt timeout/Ctrl-C)
   - **dispatch issue:** 13 error cases (issue not found, repo not onboarded, multiple projects ambiguity, worktree/branch collisions, gh CLI not installed, auth failures, auth expiry, worktree creation fails, issue deleted, Squad init fails, Copilot CLI fails, active.yaml corruption, uncommitted changes)
   - **dispatch pr:** 4+ error cases (PR not found, merged, closed, head branch deleted, plus all dispatch issue errors)
   - **dashboard:** 5 error cases (active.yaml missing/corrupted, stale worktrees, concurrent access, empty state)
   - **dashboard clean:** 3 error cases (worktree removal fails, confirmation required, active.yaml write fails)

   Each error includes: expected message, exit code, test approach

7. **Edge Cases (35+ identified)**

   Categorized across 10 areas:
   - **Idempotency:** Re-running setup/onboard, symlink target validation, dispatch collision
   - **Collisions:** Multiple projects with same name, branch/worktree name conflicts, issue number collision across repos
   - **Multi-project workflows:** Repo inference from cwd, --repo flag fallback, dashboard with multiple projects
   - **Config & state validation:** Malformed YAML, missing keys, empty files, relative/~ path expansion
   - **Platform differences:** Windows symlinks, path separators, CRLF vs LF, macOS case-sensitivity
   - **Concurrent access patterns:** Race conditions on active.yaml (documented limitation, no locking in v1)
   - **GitHub API edge cases:** Empty labels, empty body, special chars in titles, huge PR diffs
   - **Symlink & exclude edge cases:** Missing targets, existing entries preservation, name collisions, depth limits
   - **Worktree health & cleanup:** Stale worktrees, uncommitted changes, branch deletion, not in active.yaml
   - **Dispatch context & Squad invocation:** context.md write fails, Copilot CLI not found, exit non-zero, timeout

8. **Coverage Goals**
   - 80% minimum across all modules
   - Error paths prioritized over happy paths
   - Per-module targets (90%+ for config/symlink, 80%+ for dispatch/github, 70%+ for UI)

9. **CI Integration**
   - GitHub Actions workflow spec included
   - All tests must pass on every PR
   - Coverage must not drop below 80%
   - Manual QA checklist for platform-specific testing (Windows/macOS, TTY variations)

10. **Ink Component Testing**
    - Comprehensive ink-testing-library patterns
    - Basic rendering tests (StatusMessage, DispatchBox, DispatchTable)
    - Interactive components (keyboard navigation, stdin simulation)
    - TTY degradation testing (piped output, NO_COLOR, FORCE_COLOR)
    - Key utilities documented: render(), lastFrame(), stdin.write(), unmount()

11. **Test Development Workflow**
    - TDD: write error case tests first
    - Test naming convention: `<module>: <behavior>`
    - Test organization with describe() blocks

12. **Common Pitfalls & Gotchas**
    - Async test cleanup with t.after()
    - Mock cleanup (restore global state mutations)
    - Ink component state re-rendering delays
    - Git command validation in mocks

13. **Future Enhancements**
    - Integration test suite (Issue #29)
    - Property-based testing for config parsing
    - Performance testing for large active.yaml

14. **Summary**
    - Testing philosophy recap
    - Coverage goals enforcement
    - CI requirements

## Key Achievements

1. **All 12 error-handling gaps from PRD review are now documented** with expected messages, exit codes, and test approaches
2. **All 20+ edge cases from PRD review are now cataloged** with expected behaviors and test strategies
3. **Additional 15+ edge cases identified** during catalog creation (total: 35+)
4. **Exit code convention established** (7 distinct codes for different error types)
5. **Zero external mocking dependencies** — node:test mock module is sufficient
6. **Ink testing fully specified** — patterns for rendering, interaction, and TTY degradation
7. **CI-ready** — includes GitHub Actions workflow spec and coverage enforcement

## What This Enables

1. **Issue #8 (Test Infrastructure)** can be implemented following TESTING.md patterns
2. **Issue #26 (Comprehensive Error Handling)** has detailed spec with 30+ error cases
3. **Issue #27 (Edge Cases & Idempotency)** has detailed spec with 35+ edge cases
4. **Issue #29 (E2E Integration Tests)** has roadmap in §13.1
5. **Kaylee/Wash can begin Phase 1 implementation** with confidence — error handling is fully specified

## Next Steps

1. **Mal (Lead):** Review TESTING.md, approve or request changes
2. **Kaylee:** Implement test infrastructure (Issue #8) following TESTING.md patterns
3. **Jayne (me):** Begin writing actual test files once modules exist (Phases 2-5)
4. **Scribe:** Merge this decision into .squad/decisions.md

## Impact on Team

- **No breaking changes** — this is a new document, not a change to existing code
- **All agents:** Reference TESTING.md when writing tests
- **Kaylee/Wash:** Reference error catalog when implementing error handling
- **CI configuration:** Use GitHub Actions workflow spec in §9

---

**See:** `docs/TESTING.md` (37KB living document)  
**Assigned Issues:** #8 (test infrastructure), #18 (Copilot CLI testing), #26 (error handling), #27 (edge cases), #29 (E2E tests)
