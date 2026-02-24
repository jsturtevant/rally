# Rally Testing Strategy

**Version:** 0.1.0  
**Author:** Jayne (Tester)  
**Date:** 2026-02-22  
**Status:** Living Document

---

## 1. Test Framework & Philosophy

Rally uses **node:test** (Node.js built-in test runner) and **node:assert/strict** for all unit and integration tests. No external test frameworks (Jest, Mocha, etc.) are used. This aligns with Rally's dependency philosophy: curated, production-quality dependencies for application code; zero extra dependencies for testing infrastructure.

### Core Principles

1. **Error paths before happy paths.** Every test suite starts with error cases. If something can fail, test the failure first.
2. **Assume every input is wrong.** Test invalid inputs, missing arguments, malformed data, corrupted state.
3. **Exit codes matter.** Tests verify stderr output AND exit codes. Success is `0`, everything else is non-zero.
4. **Isolation.** Every test runs in a clean environment. No shared state. No pollution of `~/rally/` or user directories.
5. **No mocking libraries.** Use `node:test`'s built-in `mock` module for all mocking needs.

### Test Framework Stack

| Component | Tool | Purpose |
|-----------|------|---------|
| Test runner | `node:test` | Built-in Node.js test runner (Node 18+) |
| Assertions | `node:assert/strict` | Strict equality, deep equality, throws checks |
| Mocking | `node:test` mock module | Mock `fs`, `child_process`, environment |
| UI testing | `ink-testing-library` | Render Ink components, query output, simulate input |
| Fixtures | `fs.mkdtempSync()` | Temporary directories for git operations |

---

## 2. Test File Convention

Tests mirror the module structure of `lib/`:

```
lib/setup.js        → test/setup.test.js
lib/onboard.js      → test/onboard.test.js
lib/dispatch.js     → test/dispatch.test.js
lib/dashboard.js    → test/dashboard.test.js
lib/config.js       → test/config.test.js
lib/symlink.js      → test/symlink.test.js
lib/exclude.js      → test/exclude.test.js
lib/worktree.js     → test/worktree.test.js
lib/github.js       → test/github.test.js
lib/ui/components/StatusMessage.jsx → test/ui/StatusMessage.test.js
```

**File naming:** `{module}.test.js` for all test files. Must use `.js` extension (not `.mjs`) — package.json has `"type": "module"` so ESM is the default.

**Import syntax:** All tests use ESM imports:
```javascript
import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from '../lib/setup.js';
```

---

## 3. Running Tests

### Run all tests
```bash
npm test
```

This runs three steps:

1. **JSX pre-build** — `node test/build-jsx.mjs` compiles `.jsx` UI components to `.js` via esbuild so tests can import them without a custom loader.
2. **Non-UI tests** — `node --test ./test/*.test.js` runs all unit/integration tests.
3. **UI tests** — `node --test --test-force-exit ./test/ui/*.test.js` runs Ink component tests (requires the pre-built `.js` files from step 1).

### Run a single test file
```bash
node --test test/setup.test.js
```

### Run with coverage (Node 20+)
```bash
node --test --experimental-test-coverage ./test/*.test.js
```

### Watch mode (Node 20+)
```bash
node --test --watch ./test/*.test.js
```

### CI Integration
All tests run on every PR via GitHub Actions. Workflow file: `.github/workflows/test.yml`

---

## 4. Mocking Strategy

### 4.1 Mocking Git & GitHub CLI (`child_process`)

Rally shells out to `git`, `gh`, and `npx` for external operations. Tests mock `execSync` and `execFileSync` from `child_process` using `node:test`'s mock module.

**Pattern:**
```javascript
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

test('dispatch: fetch issue metadata', (t) => {
  // Mock gh CLI output
  mock.method(execSync, 'execSync', (cmd, opts) => {
    if (cmd.startsWith('gh issue view')) {
      return JSON.stringify({
        number: 42,
        title: 'Add user authentication',
        body: 'We need auth',
        labels: ['enhancement']
      });
    }
    throw new Error(`Unexpected command: ${cmd}`);
  });

  // Test code that calls gh
  const issue = fetchIssue(42);
  assert.equal(issue.number, 42);
  assert.equal(issue.title, 'Add user authentication');
});
```

**Why not spawn/exec?** Rally uses `execSync` for simplicity — all git/gh operations are synchronous. Tests mock the sync variants only.

**Command validation:** Mocks should assert on the exact command string to catch regressions in CLI arguments.

### 4.2 Mocking Filesystem (`fs`)

Config read/write, symlink creation, and exclude file updates all use `fs` operations. Tests mock `fs` methods to avoid filesystem side effects.

**Pattern:**
```javascript
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readConfig } from '../lib/config.js';

test('config: read missing config file', (t) => {
  // Mock fs.readFileSync to throw ENOENT
  mock.method(fs, 'readFileSync', (path) => {
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  });

  assert.throws(
    () => readConfig(),
    { code: 'ENOENT' }
  );
});

test('config: parse valid YAML', (t) => {
  const mockYaml = 'teamDir: /home/user/rally/team\nversion: 0.1.0\n';
  
  mock.method(fs, 'readFileSync', () => mockYaml);

  const config = readConfig();
  assert.equal(config.teamDir, '/home/user/rally/team');
  assert.equal(config.version, '0.1.0');
});
```

**Symlink testing:** Mock `fs.symlinkSync()` to verify symlink creation without creating real symlinks. Capture arguments to assert on target paths.

**Exclude file testing:** Mock `fs.appendFileSync()` to verify `.git/info/exclude` entries without writing to real files.

### 4.3 Mocking Environment Variables

Tests for TTY detection, `HOME` directory, and platform-specific behavior mock `process.env` and `process.platform`.

**Pattern:**
```javascript
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

test('setup: default config location uses HOME', (t) => {
  const originalHome = process.env.HOME;
  process.env.HOME = '/tmp/fake-home';
  
  t.after(() => {
    process.env.HOME = originalHome; // Cleanup
  });

  const configPath = getDefaultConfigPath();
  assert.equal(configPath, '/tmp/fake-home/.rally/config.yaml');
});

test('symlink: Windows platform detection', (t) => {
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', {
    value: 'win32',
    writable: true
  });
  
  t.after(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true
    });
  });

  assert.throws(
    () => createSymlink('/source', '/target'),
    /Windows Developer Mode/
  );
});
```

**TTY mocking:** Mock `process.stdout.isTTY` to test graceful degradation for piped output.

---

## 5. Fixture Patterns

### 5.1 Temporary Directories for Git Operations

Tests that need real git repositories use `fs.mkdtempSync()` to create isolated temp directories. Always clean up in `t.after()`.

**Pattern:**
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

test('worktree: create and remove', (t) => {
  // Create temp directory for test repo
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-test-'));
  
  t.after(() => {
    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Initialize a real git repo
  execSync('git init', { cwd: tmpDir });
  execSync('git config user.name "Test"', { cwd: tmpDir });
  execSync('git config user.email "test@example.com"', { cwd: tmpDir });
  execSync('git commit --allow-empty -m "Initial commit"', { cwd: tmpDir });

  // Test worktree creation
  const worktreePath = path.join(tmpDir, '.worktrees', 'rally-42');
  createWorktree(tmpDir, 'rally/42-test', worktreePath);

  assert.ok(fs.existsSync(worktreePath));
});
```

**When to use real git:** Integration tests that validate end-to-end git operations (worktree creation, branch management, exclude file behavior) should use real git in temp directories.

**When to mock git:** Unit tests for individual functions that parse git output or construct git commands should mock `execSync`.

### 5.2 Sample YAML Configs

Config tests need sample YAML fixtures. Store these as inline strings in test files, not separate fixture files.

**Pattern:**
```javascript
test('config: parse projects.yaml', (t) => {
  const sampleYaml = `
projects:
  - name: my-app
    path: /home/user/projects/my-app
    team: shared
    teamDir: /home/user/rally/team
    onboarded: "2026-02-21T10:00:00Z"
  - name: cool-project
    path: /home/user/rally/projects/cool-project
    team: project
    teamDir: /home/user/rally/teams/cool-project
    onboarded: "2026-02-21T11:00:00Z"
`;

  mock.method(fs, 'readFileSync', () => sampleYaml);

  const projects = readProjects();
  assert.equal(projects.length, 2);
  assert.equal(projects[0].name, 'my-app');
  assert.equal(projects[0].team, 'shared');
  assert.equal(projects[1].team, 'project');
});
```

**Invalid YAML:** Test malformed YAML, missing required keys, wrong types.

### 5.3 Mock Git Repositories

For tests that need to simulate onboarded repos (with symlinks and exclude entries), create minimal directory structures in temp directories.

**Pattern:**
```javascript
test('onboard: symlink creation', (t) => {
  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-repo-'));
  const tmpTeam = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-team-'));
  
  t.after(() => {
    fs.rmSync(tmpRepo, { recursive: true, force: true });
    fs.rmSync(tmpTeam, { recursive: true, force: true });
  });

  // Create .git directory structure
  fs.mkdirSync(path.join(tmpRepo, '.git', 'info'), { recursive: true });
  
  // Create team files
  fs.mkdirSync(path.join(tmpTeam, '.squad'), { recursive: true });
  fs.writeFileSync(path.join(tmpTeam, '.squad', 'team.md'), '# Team');

  // Test onboard
  onboardRepo(tmpRepo, tmpTeam);

  // Assert symlink exists
  const symlinkPath = path.join(tmpRepo, '.squad');
  assert.ok(fs.existsSync(symlinkPath));
  assert.ok(fs.lstatSync(symlinkPath).isSymbolicLink());
  
  // Assert exclude entry added
  const excludeFile = path.join(tmpRepo, '.git', 'info', 'exclude');
  const excludeContent = fs.readFileSync(excludeFile, 'utf8');
  assert.ok(excludeContent.includes('.squad'));
});
```

---

## 6. Error Handling Catalog

Every command has error paths that must be tested. Below is the comprehensive catalog of error scenarios, expected error messages, exit codes, and test approaches.

### Exit Code Convention

| Exit Code | Meaning |
|-----------|---------|
| `0` | Success |
| `1` | Generic error (default) |
| `2` | Missing prerequisite (git, gh, config) |
| `3` | Authentication failure |
| `4` | Not found (issue, PR, repo, file) |
| `5` | Collision (worktree exists, branch exists) |
| `6` | Invalid input (bad issue number, malformed URL) |
| `7` | Permission denied (filesystem, symlink) |

### 6.1 `rally setup` Errors

| Error Condition | Expected Message | Exit Code | Test Approach |
|----------------|------------------|-----------|---------------|
| Squad not installed | `✗ Squad not found. Install with: npx github:bradygaster/squad` | `2` | Mock `execSync` to throw when running `npx` |
| No write permission to target directory | `✗ Cannot write to <path>: permission denied` | `7` | Mock `fs.mkdirSync` to throw `EACCES` |
| `HOME` env not set | `✗ HOME environment variable not set` | `2` | Delete `process.env.HOME` |
| Target directory already exists (idempotent) | `  Team directory already exists — skipping` | `0` | Run setup twice, second run exits 0 |
| Partial failure (squad init fails mid-way) | `✗ Squad initialization failed: <error>` | `1` | Mock `execSync` to throw on `npx` |
| Config write fails | `✗ Failed to write config: <error>` | `1` | Mock `fs.writeFileSync` to throw |

### 6.2 `rally onboard` Errors

| Error Condition | Expected Message | Exit Code | Test Approach |
|----------------|------------------|-----------|---------------|
| Not a git repo (when no argument given) | `✗ Not a git repository. Run from inside a repo or provide a GitHub URL.` | `2` | Mock `fs.existsSync` to return false for `.git/` |
| Setup not run (no config.yaml) | `✗ No team directory found. Run: rally setup` | `2` | Mock `readConfig()` to throw `ENOENT` |
| Symlink target missing | `✗ Team directory missing: <path>. Run: rally setup` | `4` | Mock `fs.existsSync` to return false for teamDir |
| Clone fails (invalid URL) | `✗ Failed to clone <url>: <git error>` | `1` | Mock `execSync` to throw on `git clone` |
| Clone fails (auth required) | `✗ Authentication failed for <url>. Run: gh auth login` | `3` | Mock `execSync` to throw 128 on `git clone` |
| Invalid GitHub URL/shorthand | `✗ Not a valid GitHub URL or owner/repo shorthand: <input>` | `6` | Pass malformed URL to onboard |
| Symlink creation fails (Windows without Developer Mode) | `✗ Windows symlinks require Developer Mode. See: https://...` | `7` | Mock `fs.symlinkSync` to throw `EPERM` |
| Symlink creation fails (permission denied) | `✗ Cannot create symlink: permission denied` | `7` | Mock `fs.symlinkSync` to throw `EACCES` |
| Exclude file write fails | `✗ Cannot update .git/info/exclude: <error>` | `1` | Mock `fs.appendFileSync` to throw |
| Projects.yaml write fails | `✗ Failed to register project: <error>` | `1` | Mock `fs.writeFileSync` to throw |
| Prompt timeout (non-interactive) | `✗ Team selection timed out` | `1` | Mock `@inquirer/prompts` to throw timeout |
| Ctrl-C during prompt | `✗ Onboard cancelled by user` | `1` | Mock prompt to throw abort signal |

### 6.3 `rally dispatch issue` Errors

| Error Condition | Expected Message | Exit Code | Test Approach |
|----------------|------------------|-----------|---------------|
| Issue not found | `✗ Issue #<N> not found. Check the issue number and repo.` | `4` | Mock `gh issue view` to exit non-zero |
| Repo not onboarded | `✗ Repo not onboarded. Run: rally onboard` | `2` | Mock `readProjects()` to return empty list |
| Multiple projects, no --repo flag | `✗ Multiple projects onboarded. Specify with --repo owner/repo` | `6` | Mock `readProjects()` to return 2+ projects, omit `--repo` |
| Worktree already exists | `✗ Worktree for issue #<N> already exists at <path>` | `5` | Mock `fs.existsSync` to return true for worktree path |
| Branch already exists | `✗ Branch rally/<N>-<slug> already exists` | `5` | Mock `git branch` to show existing branch |
| `gh` CLI not installed | `✗ GitHub CLI (gh) not found. Install from: https://cli.github.com` | `2` | Mock `execSync` to throw `ENOENT` for `gh` |
| Not authenticated with GitHub | `✗ Not authenticated with GitHub. Run: gh auth login` | `3` | Mock `gh auth status` to exit non-zero |
| Auth token expired | `✗ GitHub authentication expired. Run: gh auth login` | `3` | Mock `gh` to exit 128 (auth error) |
| Worktree creation fails | `✗ Failed to create worktree: <git error>` | `1` | Mock `git worktree add` to throw |
| Issue deleted after fetch | `✗ Issue #<N> no longer exists` | `4` | Mock `gh issue view` to succeed, then fail on second call |
| Squad init in worktree fails | `✗ Squad initialization failed in worktree: <error>` | `1` | Mock `execSync` for `npx` to throw |
| Copilot CLI invocation fails | `✗ Copilot CLI failed: <error>` | `1` | Mock `npx copilot` to exit non-zero |
| active.yaml write fails (corruption) | `✗ Failed to update active dispatches: <error>` | `1` | Mock `fs.writeFileSync` to throw |
| Uncommitted changes in main repo | `✗ Uncommitted changes in <repo>. Commit or stash before dispatching.` | `1` | Mock `git status --porcelain` to return output |

### 6.4 `rally dispatch pr` Errors

| Error Condition | Expected Message | Exit Code | Test Approach |
|----------------|------------------|-----------|---------------|
| PR not found | `✗ PR #<N> not found.` | `4` | Mock `gh pr view` to exit non-zero |
| PR already merged | `✗ PR #<N> is already merged.` | `1` | Mock `gh pr view` to return `state: MERGED` |
| PR closed | `✗ PR #<N> is closed.` | `1` | Mock `gh pr view` to return `state: CLOSED` |
| Head branch deleted | `✗ Head branch for PR #<N> no longer exists` | `4` | Mock `git branch -r` to not include head branch |
| (All errors from dispatch issue also apply) | | | |

### 6.5 `rally dashboard` Errors

| Error Condition | Expected Message | Exit Code | Test Approach |
|----------------|------------------|-----------|---------------|
| active.yaml missing | `  No active dispatches` | `0` | Mock `readActive()` to throw `ENOENT`, catch and return empty |
| active.yaml corrupted (invalid YAML) | `✗ Corrupted active.yaml: <parse error>` | `1` | Mock `fs.readFileSync` to return invalid YAML |
| Stale worktree (listed but deleted) | `⚠ Worktree missing: <path>` | `0` | Mock `fs.existsSync` to return false for worktree |
| Concurrent access (race condition) | `✗ Failed to read active dispatches: <error>` | `1` | Not easily testable — document in manual QA |
| active.yaml empty | `  No active dispatches` | `0` | Mock `fs.readFileSync` to return `dispatches: []` |

### 6.6 `rally dashboard clean` Errors

| Error Condition | Expected Message | Exit Code | Test Approach |
|----------------|------------------|-----------|---------------|
| Worktree removal fails (in use) | `✗ Cannot remove worktree <path>: <git error>` | `1` | Mock `git worktree remove` to throw |
| Confirmation required (interactive) | `? Remove <N> done dispatches and their worktrees? (y/N)` | `1` (if N) | Mock prompt to return false |
| active.yaml write fails after cleanup | `✗ Failed to update active dispatches: <error>` | `1` | Mock `fs.writeFileSync` to throw |

---

## 7. Edge Cases (20+ Identified)

Edge cases are scenarios that aren't necessarily errors but require careful handling to avoid bugs or data loss.

### 7.1 Idempotency

| Edge Case | Expected Behavior | Test Approach |
|-----------|-------------------|---------------|
| Run `rally setup` twice | Second run detects existing directory, skips creation, exits 0 | Run setup twice, assert both exit 0 |
| Run `rally onboard` twice on same repo | Detects existing symlinks, skips if pointing to correct target, exits 0 | Run onboard twice, assert both exit 0 |
| Symlink exists but points to wrong target | Warn + error: `✗ Symlink exists but points to wrong target: <actual> (expected: <expected>)` | Create symlink to wrong path, run onboard |
| Dispatch same issue twice | Error: `✗ Worktree for issue #<N> already exists` | Run dispatch twice, assert second exits 5 |

### 7.2 Collision Scenarios

| Edge Case | Expected Behavior | Test Approach |
|-----------|-------------------|---------------|
| Multiple projects with same name | Use project path as disambiguator in active.yaml (`id: <path>-<issue>`) | Onboard two projects named "app", dispatch to both |
| Branch name collision (`rally/42-...` already exists) | Error: `✗ Branch rally/<N>-<slug> already exists` | Create branch manually, run dispatch |
| Worktree path collision (`.worktrees/rally-42/` exists) | Error: `✗ Worktree for issue #<N> already exists` | Create directory manually, run dispatch |
| Issue number collision across repos | Each repo's worktrees are isolated — no collision | Dispatch issue #42 to two different repos, assert both succeed |

### 7.3 Multi-Project Workflows

| Edge Case | Expected Behavior | Test Approach |
|-----------|-------------------|---------------|
| No projects onboarded | Error: `✗ No projects onboarded. Run: rally onboard` | Delete projects.yaml, run dispatch |
| One project onboarded, dispatch without --repo | Infer repo from projects.yaml, succeed | Onboard one project, dispatch without --repo |
| Two projects onboarded, cwd inside one | Infer repo from cwd, succeed | Onboard two projects, `cd` into one, dispatch |
| Two projects onboarded, cwd outside both | Error: `✗ Multiple projects onboarded. Specify with --repo` | Onboard two projects, `cd /tmp`, dispatch |
| Dashboard with dispatches from multiple projects | Show all dispatches, grouped/sorted by project | Dispatch to two projects, assert dashboard shows both |

### 7.4 Config & State Validation

| Edge Case | Expected Behavior | Test Approach |
|-----------|-------------------|---------------|
| Malformed YAML (syntax error) | Error: `✗ Corrupted <file>.yaml: <parse error>` | Write invalid YAML, run command |
| Missing required config key (`teamDir` missing) | Error: `✗ Invalid config: missing required key 'teamDir'` | Write config with missing key, run command |
| Empty projects.yaml | Treat as zero projects onboarded | Write `projects: []`, assert "No projects onboarded" |
| Empty active.yaml | Treat as zero active dispatches | Write `dispatches: []`, assert "No active dispatches" |
| Relative path in config (`teamDir: ./team`) | Resolve to absolute path | Write relative path, assert resolved path used |
| `~` in config path (`teamDir: ~/team`) | Expand `~` to `HOME` | Write `~/team`, assert expands to `/home/user/team` |

### 7.5 Platform Differences

| Edge Case | Expected Behavior | Test Approach |
|-----------|-------------------|---------------|
| Windows without Developer Mode | Error: `✗ Windows symlinks require Developer Mode` | Mock platform to win32, symlinkSync to throw EPERM |
| Windows path separators (`C:\Users\...`) | Normalize to forward slashes internally, display as-is | Mock platform, assert `path.join()` used everywhere |
| CRLF vs LF in exclude files | Always write LF (`\n`), git handles platform conversion | Write exclude with LF, assert no CRLF inserted |
| macOS symlink case-sensitivity | Respect case in symlink targets | Create symlinks with mixed case, assert preserved |
| Linux vs macOS `HOME` directory (`/home/user` vs `/Users/user`) | Use `process.env.HOME`, never hardcode | Mock `HOME`, assert config path respects it |

### 7.6 Concurrent Access Patterns

| Edge Case | Expected Behavior | Test Approach |
|-----------|-------------------|---------------|
| Two `rally dispatch` commands at once | active.yaml race condition — document limitation, no locking in v1 | Manual QA / out of scope for unit tests |
| `rally dashboard` while `rally dispatch` is writing active.yaml | Read may fail or see partial state — graceful degradation | Manual QA / out of scope for unit tests |
| Worktree removal while user has files open | Git worktree removal fails — propagate error to user | Mock `git worktree remove` to throw, assert error propagated |

### 7.7 GitHub API Edge Cases

| Edge Case | Expected Behavior | Test Approach |
|-----------|-------------------|---------------|
| Issue has no labels | `labels: []` in metadata, no error | Mock `gh issue view` with empty labels, assert no crash |
| Issue body is empty | `body: ""`, no error | Mock empty body, assert dispatch succeeds |
| Issue title contains special chars (`/`, `\`, `:`) | Sanitize for branch slug (replace with `-`) | Mock title with special chars, assert branch name sanitized |
| PR has no files changed | `changedFiles: []`, warn but succeed | Mock PR with no files, assert dispatch succeeds with warning |
| PR diff is huge (1000+ files) | Include file count in context.md, don't include full diff | Mock huge PR, assert context.md has file count only |

### 7.8 Symlink & Exclude Edge Cases

| Edge Case | Expected Behavior | Test Approach |
|-----------|-------------------|---------------|
| Symlink target doesn't exist | Error: `✗ Symlink target not found: <path>` | Delete teamDir, run onboard |
| Exclude file missing (new repo) | Create `.git/info/exclude` if missing | Delete exclude file, run onboard, assert file created |
| Exclude file has existing entries | Append Rally entries, don't overwrite | Write exclude with existing entries, assert preserved + new entries |
| Symlink name collision (file exists with same name) | Error: `✗ Cannot create symlink: file exists at <path>` | Create file named `.squad`, run onboard |
| Symlink depth (nested symlinks) | Only one level of symlinks created — no recursive symlinks | Assert no symlink-to-symlink chains |

### 7.9 Worktree Health & Cleanup

| Edge Case | Expected Behavior | Test Approach |
|-----------|-------------------|---------------|
| Dashboard shows stale worktree (deleted manually) | Warn: `⚠ Worktree missing: <path>` | Delete worktree dir, run dashboard, assert warning |
| `rally dashboard clean` with in-progress dispatch | Prompt: `⚠ <N> dispatches are still in progress. Remove anyway? (y/N)` | Mock active.yaml with in-progress, run clean, assert prompt |
| Worktree has uncommitted changes | `git worktree remove` fails, propagate error | Manually create uncommitted changes in worktree, run clean |
| Branch deleted but worktree exists | Git worktree health check fails, warn in dashboard | Delete branch, run dashboard, assert warning |
| Worktree exists but not in active.yaml | Dashboard doesn't show it (active.yaml is source of truth) | Create worktree manually, run dashboard, assert not shown |

### 7.10 Dispatch Context & Squad Invocation

| Edge Case | Expected Behavior | Test Approach |
|-----------|-------------------|---------------|
| dispatch-context.md write fails | Error: `✗ Failed to write dispatch context: <error>` | Mock `fs.writeFileSync` to throw |
| Copilot CLI not installed | Error: `✗ Copilot CLI not found. Install from: https://github.com/github/copilot-cli` | Mock `npx copilot` to throw `ENOENT` |
| Copilot CLI exits non-zero | Error: `✗ Copilot CLI failed with exit code <N>` | Mock `npx copilot` to exit non-zero |
| Copilot CLI timeout (hangs) | Timeout after 5 minutes, kill process, error | Manual QA / integration test only |

---

## 8. Coverage Goals

**Minimum coverage:** 80%  
**Priority:** Error paths over happy paths

### Coverage Targets by Module

| Module | Target | Priority Areas |
|--------|--------|----------------|
| `lib/config.js` | 90%+ | YAML parsing, missing keys, malformed files |
| `lib/symlink.js` | 95%+ | Platform detection, permission errors, collision |
| `lib/exclude.js` | 90%+ | File append, existing entries, missing file |
| `lib/worktree.js` | 85%+ | Git command errors, path collisions, cleanup |
| `lib/github.js` | 80%+ | Auth errors, not found, parse errors |
| `lib/dispatch.js` | 80%+ | Repo resolution, worktree setup, error paths |
| `lib/setup.js` | 85%+ | Idempotency, permission errors |
| `lib/onboard.js` | 85%+ | URL parsing, clone errors, symlink creation |
| `lib/dashboard.js` | 70%+ | active.yaml parsing, stale worktrees |
| `lib/ui/components/*` | 70%+ | Ink rendering, TTY degradation |

### Measuring Coverage (Node 20+)

```bash
node --test --experimental-test-coverage ./test/*.test.js
```

Output shows line, branch, and function coverage per file.

---

## 9. CI Integration

### GitHub Actions Workflow

**File:** `.github/workflows/test.yml`

```yaml
name: Test

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npm test
      - name: Check coverage
        run: node --test --experimental-test-coverage ./test/*.test.js
```

### CI Requirements

1. **All tests must pass.** Zero tolerance for failing tests on PR branches.
2. **Coverage must be ≥80%.** PRs that drop coverage below 80% are blocked.
3. **No lint errors.** If a linter is added, it must pass in CI.
4. **Platform:** Tests run on Linux (Ubuntu) in CI. Windows/macOS testing is manual QA.

### Manual QA Checklist (Pre-Release)

Some edge cases aren't automatable. Manual QA checklist:

- [ ] Run full workflow on Windows (symlink error behavior)
- [ ] Run full workflow on macOS (symlink case-sensitivity)
- [ ] Test with multiple terminals (Windows Terminal, iTerm2, default Terminal.app)
- [ ] Test piped output (`rally dashboard | cat`)
- [ ] Test concurrent dispatch (race condition on active.yaml)
- [ ] Test Ctrl-C during long-running operations (Squad invocation)
- [ ] Test with no TTY (CI environment simulation)
- [ ] Test with `NO_COLOR=1` (color stripping)
- [ ] Test with `FORCE_COLOR=1` on non-TTY (color forcing)

---

## 10. Ink Component Testing

Rally's UI components are built with **Ink** (React for the terminal). Testing Ink components requires **ink-testing-library**, which provides utilities to render components, query output, and simulate user input.

### 10.1 Basic Pattern

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import StatusMessage from '../lib/ui/components/StatusMessage.js';

test('StatusMessage: success renders with checkmark', () => {
  const { lastFrame } = render(<StatusMessage type="success">Setup complete</StatusMessage>);
  
  assert.ok(lastFrame().includes('✓'));
  assert.ok(lastFrame().includes('Setup complete'));
});

test('StatusMessage: error renders with X', () => {
  const { lastFrame } = render(<StatusMessage type="error">Setup failed</StatusMessage>);
  
  assert.ok(lastFrame().includes('✗'));
  assert.ok(lastFrame().includes('Setup failed'));
});
```

### 10.2 Testing Interactive Components

For components that accept user input (dashboard keyboard navigation, prompts), use `stdin` to simulate keypresses.

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import Dashboard from '../lib/ui/Dashboard.js';

test('Dashboard: arrow keys navigate dispatches', async () => {
  const mockDispatches = [
    { id: 'app-42', issue: 42, branch: 'rally/42-test', status: 'planning' },
    { id: 'app-51', issue: 51, branch: 'rally/51-test', status: 'implementing' }
  ];

  const { lastFrame, stdin } = render(<Dashboard dispatches={mockDispatches} />);
  
  // Initial render shows first dispatch selected
  assert.ok(lastFrame().includes('▸ my-app     #42'));
  
  // Simulate down arrow key
  stdin.write('\x1B[B'); // ANSI down arrow
  await new Promise(resolve => setTimeout(resolve, 100)); // Wait for re-render
  
  // Second dispatch should now be selected
  assert.ok(lastFrame().includes('▸ my-app     #51'));
});
```

### 10.3 Testing TTY Degradation

Ink components should gracefully degrade when `stdout` is not a TTY (piped output). Test both TTY and non-TTY modes.

```javascript
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import Dashboard from '../lib/ui/Dashboard.js';

test('Dashboard: TTY mode renders full UI', () => {
  // Mock process.stdout.isTTY = true
  const originalIsTTY = process.stdout.isTTY;
  process.stdout.isTTY = true;
  
  const { lastFrame } = render(<Dashboard dispatches={[]} />);
  
  // Should include borders and colors
  assert.ok(lastFrame().includes('┌'));
  assert.ok(lastFrame().includes('Rally Dashboard'));
  
  process.stdout.isTTY = originalIsTTY;
});

test('Dashboard: non-TTY mode renders plain text', () => {
  const originalIsTTY = process.stdout.isTTY;
  process.stdout.isTTY = false;
  
  const { lastFrame } = render(<Dashboard dispatches={[]} />);
  
  // Should NOT include borders
  assert.ok(!lastFrame().includes('┌'));
  // Should include plain text table
  assert.ok(lastFrame().includes('Rally Dashboard'));
  
  process.stdout.isTTY = originalIsTTY;
});
```

### 10.4 Testing Ink Components: Key Utilities

| Utility | Purpose |
|---------|---------|
| `render(component)` | Render an Ink component, returns `{ lastFrame, stdin, stdout, unmount }` |
| `lastFrame()` | Get the last rendered output as a string |
| `stdin.write(input)` | Simulate user input (keyboard events) |
| `unmount()` | Unmount the component (cleanup) |

**Assertion pattern:** Query `lastFrame()` for expected text, colors (ANSI codes), and layout.

**Color assertions:** Chalk strips colors in non-TTY. If testing color output, mock `process.stdout.isTTY = true`.

---

## 11. Test Development Workflow

### 11.1 TDD: Error Cases First

For every new command or module:

1. **Write error case tests first.** List all failure modes, then write tests for each.
2. **Run tests (all fail).** Red phase.
3. **Implement minimal code to pass one test.** Green phase.
4. **Refactor.** Clean up implementation.
5. **Repeat** for next error case.
6. **Write happy path tests last.** Once error handling is solid, add success cases.

### 11.2 Test Naming Convention

Test names should be descriptive and scannable:

```javascript
// Good
test('dispatch: error when issue not found', () => { /* ... */ });
test('config: parse valid YAML with all keys', () => { /* ... */ });
test('symlink: Windows error without Developer Mode', () => { /* ... */ });

// Bad
test('test1', () => { /* ... */ });
test('dispatch works', () => { /* ... */ });
test('error', () => { /* ... */ });
```

**Format:** `<module>: <behavior>` or `<module>: <error condition>`

### 11.3 Test Organization

Group related tests using `describe()`:

```javascript
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

describe('dispatch issue', () => {
  describe('error cases', () => {
    test('issue not found', () => { /* ... */ });
    test('repo not onboarded', () => { /* ... */ });
    test('worktree already exists', () => { /* ... */ });
  });

  describe('success cases', () => {
    test('creates worktree and branch', () => { /* ... */ });
    test('writes dispatch context', () => { /* ... */ });
  });
});
```

---

## 12. Common Pitfalls & Gotchas

### 12.1 Async Test Cleanup

Always clean up resources in `t.after()`:

```javascript
test('worktree test', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-test-'));
  
  t.after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Test code...
});
```

**Why:** Tests that don't clean up pollute `/tmp` and can cause failures in subsequent test runs.

### 12.2 Mock Cleanup

Mocks created with `node:test` mock module are automatically cleaned up after the test. BUT: if you mutate global state (like `process.env` or `process.platform`), restore it manually.

```javascript
test('platform detection', (t) => {
  const originalPlatform = process.platform;
  
  Object.defineProperty(process, 'platform', { value: 'win32' });
  
  t.after(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  // Test code...
});
```

### 12.3 Ink Component State

Ink components with React state must be given time to re-render after state changes. Use `setTimeout()` or `await` for state updates.

```javascript
stdin.write('\x1B[B'); // Down arrow
await new Promise(resolve => setTimeout(resolve, 100)); // Wait for re-render
assert.ok(lastFrame().includes('expected text'));
```

### 12.4 Git Command Mocking

When mocking `execSync` for git commands, always include command validation to catch regressions:

```javascript
mock.method(execSync, 'execSync', (cmd, opts) => {
  if (cmd === 'git worktree add .worktrees/rally-42 -b rally/42-test') {
    return '';
  }
  throw new Error(`Unexpected git command: ${cmd}`);
});
```

**Why:** If implementation changes the git command args, the test will catch it.

---

## 13. Future Testing Enhancements

### 13.1 Integration Test Suite (Issue #29)

End-to-end integration tests that run the full workflow:

1. `rally setup`
2. `rally onboard <github-url>`
3. `rally dispatch issue 42`
4. Verify worktree, branch, symlinks, dispatch-context.md
5. `rally dashboard`
6. Verify dashboard shows dispatch
7. `rally dashboard clean`
8. Verify worktree removed

These tests require real git repos, real gh CLI calls (or comprehensive mocks), and longer run times. Keep separate from unit tests.

### 13.2 Property-Based Testing

For config parsing, YAML validation, and branch name sanitization, consider property-based testing (e.g., `fast-check`). Generate random inputs and assert invariants hold.

**Example:** Branch name sanitization should never produce a branch name with `/` at the start or end, or multiple consecutive `/`.

### 13.3 Performance Testing

For dashboard rendering with large active.yaml (100+ dispatches), add performance tests:

```javascript
test('dashboard: renders 100 dispatches in <1s', () => {
  const start = Date.now();
  const dispatches = Array.from({ length: 100 }, (_, i) => ({
    id: `app-${i}`,
    issue: i,
    branch: `rally/${i}-test`,
    status: 'planning'
  }));
  
  render(<Dashboard dispatches={dispatches} />);
  
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 1000, `Dashboard render took ${elapsed}ms (expected <1000ms)`);
});
```

---

## 14. Summary

Rally's testing strategy is skeptical, rigorous, and error-first. Every command has a comprehensive catalog of error cases, edge cases, and platform-specific behaviors. Tests use `node:test` and `node:assert/strict` for simplicity and zero external dependencies. Mocking uses `node:test`'s built-in mock module. Fixtures use temp directories for git operations and inline YAML for config tests. Ink components use `ink-testing-library` for rendering and interaction testing.

**Coverage goal:** 80%+ across all modules, with error paths prioritized over happy paths.

**CI integration:** Tests run on every PR. All tests must pass. Coverage must not drop below 80%.

**Philosophy:** Test the unhappy path first. Assume every input is wrong. Verify exit codes and stderr, not just stdout. Break things on purpose so they don't break by accident.

---

## Dependency Injection Pattern

Rally functions accept injectable dependencies via underscore-prefixed options so tests can substitute real shell commands and prompts:

| Parameter | Default | Used by |
|-----------|---------|---------|
| `_exec` | `execFileSync` | `dispatch`, `dispatch-issue`, `dispatch-pr`, `copilot` |
| `_clone` | internal clone fn | `onboard` |

Tests pass stubs for these parameters to avoid real git/gh/npx invocations:

```javascript
await dispatchIssue({
  number: 42,
  _exec: mock.fn(() => JSON.stringify({ title: 'Fix bug' })),
});
```

This avoids mocking global modules and keeps tests isolated.

---

**Last Updated:** 2026-02-22  
**Owner:** Jayne (Tester)  
**Status:** Living Document — update as new error cases and edge cases are discovered
