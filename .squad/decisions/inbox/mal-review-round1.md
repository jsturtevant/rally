# Code Review — Round 1

**By:** Mal (Lead)  
**Date:** 2026-02-23  
**Scope:** Full codebase  
**Status:** Round 1 of 5

---

## Critical

### C-1: `dispatch issue` and `dispatch pr` commands not wired into CLI

- **File:** `bin/rally.js`
- **Lines:** 1–92
- **Issue:** The CLI entry point registers `setup`, `onboard`, `status`, `dashboard`, and `dashboard clean` commands — but **never registers `dispatch issue` or `dispatch pr`**. The core dispatch functionality (`lib/dispatch-issue.js`, `lib/dispatch-pr.js`, `lib/dispatch.js`) is fully implemented and tested but **completely unreachable from the CLI**. Users cannot dispatch anything.
- **Fix:** Add `dispatch` as a command group with `issue` and `pr` subcommands. Each should accept `<number>` argument and `--repo <owner/repo>` option, call `resolveRepo()`, then delegate to `dispatchIssue()` / `dispatchPr()`. This is a ship-blocking bug.

### C-2: `readActive()` can return `null` when `active.yaml` exists but is empty

- **File:** `lib/config.js`
- **Lines:** 57–68
- **Issue:** `yaml.load()` returns `undefined` for an empty file. `readActive()` returns that `undefined` (not `{ dispatches: [] }`). Then `active.js:55` does `data.dispatches.find(...)` on `undefined` → crash. Same problem exists in `readConfig()` and `readProjects()` — `readProjects()` only returns `{ projects: [] }` when the file is **missing**, not when it's empty.
- **Fix:** In `readActive()`, after `yaml.load()`, return `result || { dispatches: [] }`. Apply same null-coalescing pattern to `readProjects()`. `readConfig()` returning null is intentional (indicates "not set up"), so leave it. Precedent: `onboard.js:137` already defensively does `readProjects() || { projects: [] }` because it knows this is broken.

---

## Important

### I-1: `github.js` — entire module is dead code

- **File:** `lib/github.js`
- **Lines:** 1–85
- **Issue:** `getIssue()`, `getPr()`, `createPr()`, and `getRepoDefaultBranch()` are exported but **never imported anywhere** in the codebase. `dispatch-issue.js` and `dispatch-pr.js` each inline their own `gh` CLI calls instead of using these functions. This is 85 lines of untested, unused code.
- **Fix:** Delete `lib/github.js` entirely, or refactor `dispatch-issue.js` and `dispatch-pr.js` to use it (preferred — reduces duplication). If deleting, also remove any test file for it.

### I-2: `tools.js` — `assertTools()` / `checkTools()` never called

- **File:** `lib/tools.js`
- **Lines:** 1–44
- **Issue:** `assertTools()` is defined to validate required CLI tools (`git`, `gh`, `npx`) but is **never called** from `bin/rally.js` or any command handler. Missing tools cause cryptic `ENOENT` errors deep in the call stack instead of a clear upfront message.
- **Fix:** Call `assertTools()` at the top of `bin/rally.js` (before `program.parse()`) or as a pre-action hook on the `dispatch` and `onboard` commands.

### I-3: `config.js writeActive()` is redundant with `active.js writeActiveAtomic()`

- **File:** `lib/config.js`
- **Lines:** 70–78
- **Issue:** `writeActive()` in `config.js` does a non-atomic write (`writeFileSync` directly). `active.js` has `writeActiveAtomic()` that does temp-file + rename. The non-atomic `writeActive()` is exported and used in test setup, but any production code calling it would bypass the atomic write guarantee.
- **Fix:** Either remove `writeActive()` from `config.js` and have tests use `writeActiveAtomic()` (or write YAML files directly), or make `writeActive()` delegate to the atomic version. Having two write paths for the same file is a data-loss footgun.

### I-4: `dispatch-issue.js` — no cleanup on partial failure

- **File:** `lib/dispatch-issue.js`
- **Lines:** 110–157
- **Issue:** The TODO on line 39 acknowledges this: if worktree creation succeeds but context writing or `addDispatch()` fails, the worktree is orphaned. The PR dispatch has the same issue. A failed `addDispatch()` (e.g., duplicate id from re-dispatch) leaves a worktree with no tracking record.
- **Fix:** Wrap steps 4-8 in try-catch. On failure, attempt `removeWorktree()` to clean up. File as an issue if not fixing immediately.

### I-5: `dispatch-pr.js` — `git fetch` / `git reset --hard` not injected for testing

- **File:** `lib/dispatch-pr.js`
- **Lines:** 130–131
- **Issue:** These git commands use the injected `_exec` which works for test mocking, but the mock `createExecWithPr` in tests only intercepts `gh pr view` — it delegates everything else to real `execFileSync`. This means the fetch/reset commands hit the real repo in tests, which works but makes tests fragile and slow. More critically, if the `git fetch` fails (e.g., network issue), the error is not caught and the worktree is orphaned.
- **Fix:** Wrap the fetch/reset in try-catch with worktree cleanup on failure. This is the same partial-failure issue as I-4.

### I-6: `validateOnboarded()` matches by repo name only, ignoring owner

- **File:** `lib/config.js`
- **Lines:** 85–92
- **Issue:** `validateOnboarded('alice/myapp')` and `validateOnboarded('bob/myapp')` would both match a project named `myapp`. The `projects.yaml` entries store `name` as basename only. If someone onboards two forks with the same repo name from different owners, validation becomes ambiguous.
- **Fix:** Store and match on full `owner/repo` or at least document that repo names must be unique across owners. Low risk today (single-user tool), but worth noting.

### I-7: `dispatch-issue.js` — repo format not validated

- **File:** `lib/dispatch-issue.js`
- **Lines:** 60–66
- **Issue:** `dispatchIssue()` validates `issueNumber`, `repo`, and `repoPath` are truthy, but never validates `repo` format (should be `owner/repo`). The `dispatchPr()` function does validate format (lines 90-93). Inconsistent.
- **Fix:** Add the same `repo.split('/')` length check that `dispatchPr()` uses, or extract to a shared validator.

---

## Moderate

### M-1: `symlink.js` — `validateSymlink()` and `checkSymlinkSupport()` unused in production

- **File:** `lib/symlink.js`
- **Lines:** 32–89
- **Issue:** `validateSymlink()` is exported but never called outside tests. `checkSymlinkSupport()` runs a Windows symlink capability test but is never called from `setup` or `onboard`. On Windows, users would get a raw `EPERM` error instead of the friendly "Enable Developer Mode" message.
- **Fix:** Call `checkSymlinkSupport()` early in `setup` or `onboard` on Windows. Either use `validateSymlink()` somewhere or remove it.

### M-2: `worktree.js` — `worktreeExists()` unused in production

- **File:** `lib/worktree.js`
- **Lines:** 104–108
- **Issue:** Only used in `worktree.test.js`. `dispatch-issue.js` and `dispatch-pr.js` use `existsSync(worktreePath)` instead of `worktreeExists()`. The `existsSync` check only verifies the directory exists, not that git considers it a worktree — a manually-created directory at the path would be treated as an existing worktree.
- **Fix:** Either use `worktreeExists()` in the dispatch modules (more correct) or remove it if the simpler `existsSync` check is intentional.

### M-3: `onboard.js` — `symlink.js` target validation gap

- **File:** `lib/onboard.js`
- **Lines:** 148–152
- **Issue:** Symlink targets are constructed as `join(teamDir, '.squad')` etc., but there's no check that these targets actually exist. If the team dir exists but `.squad/` inside it doesn't (partial setup), `createSymlink()` will throw `"Symlink target does not exist"` — a confusing error for the user.
- **Fix:** Validate that all symlink targets exist before attempting to create symlinks, with a clearer error message: "Team directory is incomplete. Run: rally setup"

### M-4: `config.js` — `readProjects()` missing null guard on return value

- **File:** `lib/config.js`
- **Lines:** 34–45
- **Issue:** When `projects.yaml` exists but contains only whitespace or comments, `yaml.load()` returns `undefined`. The caller gets `undefined` instead of `{ projects: [] }`. Multiple callers already work around this: `onboard.js:137`, `dispatch.js:91`, `dashboard-clean.js:16`. The fix belongs in `readProjects()` itself.
- **Fix:** Change return to `yaml.load(...) || { projects: [] }`.

### M-5: `active.js` — `readActive()` returns stale data on concurrent access

- **File:** `lib/active.js`
- **Lines:** 55, 82, 101
- **Issue:** Every mutation (add/update/remove) reads from disk, modifies in memory, writes back. If two dispatch processes run concurrently, they will read→modify→write with a race window. The atomic write prevents corruption, but the last writer wins and can silently drop the other's changes.
- **Fix:** File-level locking (e.g., `proper-lockfile`) or accept the limitation and document it. For a single-user CLI tool, this is acceptable but worth noting.

### M-6: Version hardcoded in two places

- **File:** `bin/rally.js:13` and `package.json:3`
- **Issue:** Version `0.1.0` is hardcoded in `rally.js` line 13 (`.version('0.1.0')`) and `package.json`. They can drift. Also hardcoded in `setup.js:68` (`version: '0.1.0'` written to config.yaml).
- **Fix:** Read version from `package.json` at runtime: `import { createRequire } from 'node:module'; const pkg = createRequire(import.meta.url)('../package.json');` and use `pkg.version`. Or use a simpler approach with `readFileSync` + `JSON.parse`.

### M-7: No test for `lib/github.js`

- **File:** `lib/github.js`
- **Lines:** 1–85
- **Issue:** The module has zero test coverage. Every function calls `execFileSync('gh', ...)` with no injectable exec parameter, making it untestable without hitting the real `gh` CLI.
- **Fix:** If keeping the module (see I-1), add `_exec` injection parameter like the other modules use. If deleting it, this is moot.

### M-8: `dashboard-clean.js` swallows worktree removal errors silently

- **File:** `lib/dashboard-clean.js`
- **Lines:** 84–88
- **Issue:** When `_removeWt()` throws (e.g., permission denied, worktree locked), the error is silently caught and cleaning continues. The user sees "Cleaned dispatch-1" with no indication the worktree directory still exists on disk.
- **Fix:** At minimum, log a warning that the worktree directory may still exist. The spinner message could include "(worktree dir may remain)".

### M-9: `bin/rally.js` — `dispatch` and `pr` commands not registered

- **File:** `bin/rally.js`
- **Lines:** 1–92
- **Issue:** This is the command-surface gap. All dispatch subcommands (issue, pr) are implemented in lib but not exposed through Commander. PRD specifies `rally dispatch issue <N>` and `rally dispatch pr <N>`.
- **Fix:** Same as C-1, listed here as context.

---

## Minor

### m-1: Inconsistent test pattern — `test()` vs `describe()`/`it()`

- **File:** Multiple test files
- **Issue:** Some test files use `test()` at top level (`active.test.js`, `config.test.js`), others use `describe()`/`it()` (`errors.test.js`, `worktree.test.js`), and others mix both (`dispatch-issue.test.js` uses `describe()`/`test()`). All work with `node:test` but the inconsistency makes the test suite feel unpolished.
- **Fix:** Pick one pattern and standardize. Recommendation: `describe()` for grouping + `test()` for individual tests (already the most common pattern).

### m-2: `worktree.test.js` uses `execFileSync('mkdir', ...)` and `execFileSync('touch', ...)`

- **File:** `test/worktree.test.js`
- **Lines:** 25, 28
- **Issue:** Uses shell commands (`mkdir -p`, `touch`) instead of Node.js `fs` APIs. Won't work on Windows. Other test files correctly use `mkdirSync` and `writeFileSync`.
- **Fix:** Replace with `mkdirSync(repoPath, { recursive: true })` and `writeFileSync(join(repoPath, 'README.md'), '')`.

### m-3: `copilot.js` — `spawn` imported but only `_spawn` injection used

- **File:** `lib/copilot.js`
- **Line:** 1
- **Issue:** `spawn` is imported from `node:child_process` on line 1 but the function uses `opts._spawn || spawn` — the import is used as the default fallback. This is fine, just noting that the import serves solely as default injection, which is the intended pattern.
- **Fix:** No fix needed; this is consistent with the codebase pattern.

### m-4: `config.test.js` — repetitive try/finally env cleanup

- **File:** `test/config.test.js`
- **Lines:** Throughout
- **Issue:** Every test has the same try/finally block for `RALLY_HOME` cleanup. Other test files use `beforeEach`/`afterEach` for this. `config.test.js` is the only file that doesn't.
- **Fix:** Refactor to use `beforeEach`/`afterEach` like the other test files.

### m-5: `status.test.js` uses `__dirname` but it's only used for `binPath`

- **File:** `test/status.test.js`
- **Line:** 11
- **Issue:** `import { fileURLToPath } from 'node:url'` and `const __dirname = dirname(fileURLToPath(import.meta.url))` — this is correct for ESM, but it's the only test file that does this. Other test files that need the bin path use relative paths from `process.cwd()`.
- **Fix:** Not a bug, just noting the inconsistency. Fine to leave.

### m-6: Missing `.gitkeep` explanation

- **File:** `lib/.gitkeep`
- **Issue:** The `lib/` directory contains a `.gitkeep` file which is unnecessary since the directory has many other files. Likely a leftover from initial project scaffolding.
- **Fix:** Delete `lib/.gitkeep`.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 2     |
| Important | 7    |
| Moderate | 9     |
| Minor    | 6     |

**Top priorities for next session:**
1. **C-1:** Wire `dispatch issue` and `dispatch pr` into `bin/rally.js` — without this, the tool can't do its primary job
2. **C-2:** Fix `readActive()` empty-file crash — data loss/crash risk
3. **I-1:** Resolve `github.js` dead code (delete or integrate)
4. **I-2:** Wire `assertTools()` into the CLI startup
