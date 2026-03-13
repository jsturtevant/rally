# PRD: E2E Test Suite Rework

**Author:** Mal (Lead)
**Date:** 2026-03-10
**Status:** Draft

---

## 1. Current State

### 1.1 File Layout

```
test/e2e/
├── e2e.test.js                          ← "legacy" monolith (the ONLY file CI runs)
├── cli/                                 ← 4 PTY-based CLI tests (NOT run in CI)
│   ├── help.test.js
│   ├── onboard.test.js
│   ├── sessions.test.js
│   └── status.test.js
└── journeys/                            ← 18 PTY-based journey tests (NOT run in CI)
    ├── actions/     (7 files)
    ├── dispatch/    (1 file)
    ├── display/     (5 files)
    ├── lifecycle/   (2 files)
    └── navigation/  (3 files)
```

**Total:** 23 test files, ~71+ individual test cases.

### 1.2 Test Harness

Three shared modules in `test/harness/`:

| File | Purpose |
|------|---------|
| `terminal.js` | PTY spawn via `node-pty` + `@xterm/headless` + `canvas` for screenshots |
| `e2e-dispatch-fixture.js` | Isolated RALLY_HOME, real dispatch to issue #54, dashboard launcher |
| `snapshots.js` | Visual regression: pixelmatch PNG comparison with baseline/actual/diff workflow |

### 1.3 What's Tested

| Area | Coverage | Notes |
|------|----------|-------|
| `--help` / `--version` | ✅ Good | Both in `e2e.test.js` and `cli/help.test.js` (duplicated) |
| `status` / `status --json` | ✅ Good | Covered in both locations |
| `dashboard --json` | ✅ Good | Covered |
| `onboard` (with flags) | ⚠️ Partial | PTY tests exist but aren't run in CI |
| `dispatch issue` (library) | ✅ Good | Real GitHub integration in `e2e.test.js` |
| `dispatch issue` (UI journey) | ⚠️ Partial | Full journey in `journeys/dispatch/issue.test.js` — not in CI |
| `dispatch clean` | ✅ Good | Library-level test |
| `dispatch sessions` | ⚠️ Partial | PTY tests exist, not in CI |
| `dispatch pr` | ❌ Missing | No e2e coverage |
| `dispatch remove` | ⚠️ Partial | Journey test exists, not in CI |
| `dispatch continue` | ⚠️ Partial | Journey test exists, not in CI |
| `dispatch log` | ⚠️ Partial | Journey test exists, not in CI |
| `dispatch refresh` | ❌ Missing | No e2e coverage (only dashboard `r` key) |
| Dashboard keyboard nav | ⚠️ Partial | Journey tests exist, not in CI |
| Dashboard display/layout | ⚠️ Partial | Journey tests exist, not in CI |
| Visual regression | ⚠️ Built | Infrastructure exists (`snapshots.js`), baselines taken but not asserted in CI |

### 1.4 How Tests Run

**`npm run test:e2e`** executes:
```bash
node test/build-jsx.mjs && node --test ./test/e2e/*.test.js
```

**Critical problem:** The glob `./test/e2e/*.test.js` only matches `e2e.test.js`. The `cli/` and `journeys/` subdirectories — containing 22 of 23 test files — **are never executed in CI**.

**CI matrix:** Ubuntu + Windows × Node 20 + 22 (4 combinations). Runs `npm test` then `npm run test:e2e`.

---

## 2. Problems

### 2.1 🔴 22 of 23 Test Files Don't Run in CI

The `test:e2e` script glob `./test/e2e/*.test.js` does not recurse into subdirectories. The `cli/` and `journeys/` directories contain the bulk of the test suite (~65+ tests) that have never been validated in CI. This is the single most critical issue.

**Files affected:** All of `test/e2e/cli/*.test.js` and `test/e2e/journeys/**/*.test.js`.

### 2.2 🔴 Fake State Instead of Real Commands

16 of 23 test files manually create fake config state — writing `config.yaml`, `projects.yaml`, and `active.yaml` directly into temp directories instead of running real CLI commands. The shared `e2e-dispatch-fixture.js` provides `createIsolatedConfig()` but only 7 files use it. Each copy is 15-25 lines manufacturing state that the CLI itself should be creating.

**Impact:** Tests validate against hand-crafted config, not config produced by real commands. When the config schema changes (it has before — JSON→YAML), every copy must be updated independently, and the fake state may not match what the CLI actually produces.

**Worst offenders:**
- `journeys/dispatch/issue.test.js` — redefines config setup AND `cleanupWorktree()` that already exist in the fixture
- `journeys/navigation/selection.test.js` — 14 references to its own config setup variant
- `journeys/lifecycle/cancel.test.js` and `complete.test.js` — identical config setup in both

### 2.3 🟡 Two Competing Test Styles

The suite has two fundamentally different approaches that coexist without clear guidance:

1. **Library-level tests** (`e2e.test.js`): Import functions like `dispatchIssue()` directly, call them, assert on return values and filesystem state. Use `execFileSync` for CLI invocations.
2. **PTY/terminal tests** (`cli/` and `journeys/`): Spawn full processes via `node-pty`, render in `@xterm/headless`, assert on terminal frame text.

Both are valid but they test different things. The monolith `e2e.test.js` mixes both patterns — it uses `execFileSync` for some tests and direct library imports for others (dispatch, clean).

### 2.4 🟡 Weak Assertions

Many journey tests use overly permissive assertions that can pass even when the feature is broken:

```javascript
// test/e2e/journeys/actions/view-log.test.js
assert.ok(
  frame.includes('log') || frame.includes('Log') || 
  frame.includes('copilot') || frame.includes('Starting') || 
  frame.includes('Escape'),
  'Should show log content'
);
```

This assertion accepts any of 5 unrelated strings. Similar patterns appear in `continue.test.js`, `clean.test.js`, `sessions.test.js`, and `status.test.js`.

### 2.5 🟡 Hard-Coded Timing Delays

94 instances of `await new Promise(r => setTimeout(r, N))` across the journey tests. These are bare delays (200ms–5000ms) that are:
- Too short on slow CI runners (flaky)
- Too long for fast machines (slow)
- Not tied to any observable condition

Better pattern: use `waitFor()` which already exists in the harness.

### 2.6 🟡 Inconsistent Cleanup

Some tests use `afterEach` for cleanup, others use `after`. Some clean temp dirs, some don't. The `e2e.test.js` monolith modifies `process.env.RALLY_HOME` globally in `before()` hooks, creating risk of cross-test pollution if a test fails mid-setup.

### 2.7 ⚪ No `dispatch pr` Coverage

`dispatch pr` has zero e2e coverage. `dispatch refresh` (as a CLI command, not dashboard key) is also untested.

### 2.8 ⚪ Heavy Native Dependencies

The PTY harness requires `node-pty` and `canvas` (native compilation). These can fail on CI (especially Windows) and add ~30s to `npm install`. The `e2e.test.js` monolith avoids these deps entirely, which may explain why it was kept as the CI-run file.

---

## 3. Goals

### Must Have
1. **Tests are documentation.** Anyone should be able to open a `.md` file in `test/e2e/cli/` and immediately understand what command is being tested and what output is expected — no JavaScript knowledge required.
2. **No JavaScript in test files.** All test execution logic lives in a single `runner.js`. The `.md` files are pure data: command + expected output.
3. **All CLI-stdout tests run in CI.** Fix the glob issue (22 of 23 files not running) and wire the new markdown tests into the CI pipeline.
4. **Exact matching with line-wrap handling.** Expected output must match actual output line-for-line after whitespace normalization. Terminal line wrapping is automatically unwrapped. Trailing newlines are ignored.

### Should Have
5. **One runner, many test files.** Adding a new test = adding a `## \`command\`` heading to a markdown file. Zero boilerplate.
6. **Cover untested commands.** `dispatch pr`, `dispatch refresh` — should get markdown test cases.
7. **No pre-seeded config.** The runner creates an empty `RALLY_HOME` — tests that need project state run `rally onboard` first. No fake config files, no mocking.

### Nice to Have
8. **Test files double as command reference.** The `.md` files in `test/e2e/cli/` should be browsable on GitHub as informal CLI documentation.
9. **PTY/interactive tests stay as JS** (separate concern), but the markdown format covers the bulk of CLI-stdout testing.

---

## 3.5 Test Fixture Repository

E2E tests that exercise `dispatch issue` and `dispatch pr` need a real GitHub repo with known issues and PRs. Instead of using `jsturtevant/rally` itself (fragile, noisy), we maintain a dedicated fixture repo:

| Resource | Location |
|----------|----------|
| **Fixture repo** | `jsturtevant/rally-test-fixtures` (override owner with `RALLY_TEST_OWNER` env var) |
| **Issue #1** | `[E2E Test] Dispatch issue test` — single-dispatch testing |
| **Issue #2** | `[E2E Test] Second dispatch issue` — multi-dispatch testing |
| **PR #1** | `[E2E Test] Sample PR for review dispatch` — dispatch-pr testing |
| **Setup script** | `scripts/setup-test-fixtures.sh` |

The fixture repo serves **double duty**: it is both the dispatch target (issues/PRs for `dispatch issue` and `dispatch pr` tests) AND the onboard target for remote `rally onboard` tests (e.g., `rally onboard jsturtevant/rally-test-fixtures` and `rally onboard https://github.com/jsturtevant/rally-test-fixtures`).

The setup script is **idempotent** — it checks for existing resources before creating anything. Run it once before the first CI run or when bootstrapping a fork:

```bash
# Default owner (jsturtevant)
./scripts/setup-test-fixtures.sh

# Custom owner / fork
RALLY_TEST_OWNER=myorg ./scripts/setup-test-fixtures.sh
```

### 3.5.1 Onboard Test Strategy

Onboard tests require two distinct setups depending on the input form:

**Local path tests** (`rally onboard .`): The runner clones `jsturtevant/rally-test-fixtures` into a temp directory for each test file that declares `repo: local` in its frontmatter. Tests then run `rally onboard .` from inside that clone — testing the "I already have a repo cloned" flow. Requires network for the initial clone.

**Remote tests** (`rally onboard owner/repo`, `rally onboard https://github.com/owner/repo`): These use `jsturtevant/rally-test-fixtures` as the target. They are integration tests that require network access and a valid GitHub token. Mark these tests accordingly so CI can gate them behind a network-available flag.

---

## 4. Proposed Architecture: Markdown-Driven Tests

### 4.1 Core Concept

Tests are written as **markdown files** that are both human-readable documentation AND executable test specifications. A single JavaScript runner (`runner.js`) parses the markdown, extracts commands and expected output, executes the commands, and reports results.

**No test logic exists in the markdown files.** They are pure data.

### 4.2 Test Case Format

Each test case is a markdown heading + optional prose + an expected-output code block:

```markdown
## `rally --help`

Shows all available commands and global options.

\`\`\`expected
Usage: rally [options] [command]

Options:
  -V, --version       output the version number
  -h, --help          display help for command

Commands:
  onboard [options]   Onboard a repository
  dispatch            Dispatch work to a repository
  status [options]    Show dispatch status
  dashboard           Open the Rally dashboard
\`\`\`
```

**Rules:**

| Element | Meaning |
|---------|---------|
| `## \`command\`` heading | The exact CLI command to execute. Runner extracts text inside backticks. |
| Prose between heading and code block | Human-readable description. Ignored by runner. |
| `` ```expected `` code block | Expected stdout. Exact-matched against actual output after whitespace normalization and terminal line-wrap unwrapping. |

- Multiple test cases per file, grouped by feature.
- Files live in `test/e2e/cli/` with `.md` extension.
- A test case without an `` ```expected `` block is treated as "command should exit 0" (smoke test).

### 4.3 Directory Structure

```
test/e2e/
├── runner.js              ← Parses .md files, extracts commands, runs them, exact-compares output
├── cli/
│   ├── help.md            ← --help, --version
│   ├── onboard.md         ← onboard commands
│   ├── status.md          ← status, status --json
│   ├── dispatch.md        ← dispatch issue, dispatch clean, etc.
│   ├── dashboard.md       ← dashboard --json
│   ├── help.test.js       ← (existing PTY tests remain)
│   ├── onboard.test.js
│   ├── sessions.test.js
│   └── status.test.js
├── journeys/              ← (existing journey tests remain as .test.js for now)
│   ├── actions/
│   ├── dispatch/
│   ├── display/
│   ├── lifecycle/
│   └── navigation/
└── harness/               ← (shared test utilities)
```

The `.md` files are new markdown-driven tests. Existing `.test.js` files in `cli/` (PTY-based) and all `journeys/` tests remain as-is for now.

### 4.4 The Runner (`runner.js`)

The runner is the **only JavaScript file** involved in markdown-driven tests. It must:

1. **Discover** all `.md` files in `test/e2e/cli/`.
2. **Parse frontmatter** — each `.md` file may begin with a YAML frontmatter block declaring its repo setup:

   ```markdown
   ---
   repo: jsturtevant/rally-test-fixtures
   ---
   ```

   Supported `repo:` values:

   | `repo:` value | Runner behavior |
   |---------------|-----------------|
   | `local` | Clones `jsturtevant/rally-test-fixtures` into a temp directory via `gh repo clone`. Tests run with `cwd` set to that clone. Used for `rally onboard .` tests. |
   | `jsturtevant/rally-test-fixtures` (or any `owner/repo`) | Clones the fixture repo into a temp directory. Requires network. |
   | *(not specified)* | No repo setup — just creates a temp `RALLY_HOME` dir. For `--help`/`--version` tests. |

   The runner ALWAYS creates a temp directory to use as `RALLY_HOME` (to isolate from real config). No pre-seeding of any files — all config state is built by running real CLI commands within the test file.

   **No test logic lives in the markdown.** The frontmatter is declarative metadata; the runner owns all setup/teardown code.

3. **Execute tests sequentially, in order.** Tests within a markdown file run **sequentially, top to bottom**. This means earlier tests build state for later tests — the file reads like a script:
   - `## \`rally onboard .\`` runs first, onboards the project
   - `## \`rally status\`` runs second, sees the onboarded project
   - `## \`rally status --json\`` runs third, sees the same state

   This is the key insight: **tests are ordered steps, not independent units.** If a test needs an onboarded project, a prior test in the same file runs `rally onboard` — no fake config, no pre-seeding.

4. **Parse test cases** — extract `## \`command\`` headings and their following `` ```expected `` blocks.
5. **Setup** environment per the frontmatter `repo:` value (see above).
6. **Execute** each command via `execSync` **in order**, capturing stdout. Each test sees the state left by previous tests.
7. **Exact-compare** actual output against expected:
   - Normalize whitespace (collapse runs, trim lines).
   - Ignore trailing newlines.
   - Unwrap terminal-wrapped lines by joining consecutive actual lines that match expected.
   - Compare line-by-line after normalization — every expected line must match the corresponding actual line.
8. **Report** results using Node's built-in test runner (`node:test`) so it integrates with `node --test`.
9. **Cleanup** temp dirs after each file.

```javascript
// Pseudocode sketch of runner.js
import { describe, it } from 'node:test';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const mdFiles = readdirSync('test/e2e/cli').filter(f => f.endsWith('.md'));

for (const file of mdFiles) {
  const tests = parseMarkdown(readFileSync(`test/e2e/cli/${file}`, 'utf8'));

  describe(file, () => {
    for (const { command, expected } of tests) {
      it(command, () => {
        const actual = execSync(command, { env: { ...process.env, RALLY_HOME: tmpDir } });
        assertExactMatch(actual.toString(), expected);
      });
    }
  });
}
```

### 4.5 Exact Matching Spec

The `assertExactMatch(actual, expected)` function:

1. Apply variable substitutions (`$RALLY_HOME`, `$REPO_ROOT`, `$PROJECT_NAME`, `$HOME`) to expected.
2. Normalize path separators (backslashes → forward slashes) for cross-platform comparison.
3. Split both strings into lines, trim each line, collapse internal whitespace.
4. Remove empty lines from both sides.
5. Unwrap terminal-wrapped lines: greedily join 2–3 consecutive actual lines when they match the next expected line.
6. Compare line-by-line with strict equality. Extra actual lines, missing expected lines, and mismatches all fail.
7. On mismatch, report the divergent line number with both actual and expected text for easy debugging.

### 4.6 Test Script Integration

```jsonc
{
  "test:e2e": "node --test test/e2e/runner.js",
  "test:e2e:pty": "node --test ./test/e2e/cli/*.test.js ./test/e2e/journeys/**/*.test.js"
}
```

- `test:e2e` runs the markdown-driven tests (fast, no native deps, all platforms).
- `test:e2e:pty` runs the existing PTY/journey tests (needs `node-pty`, Ubuntu-only in CI).
- CI runs `test:e2e` on all matrix combos. `test:e2e:pty` on Ubuntu only.

---

## 5. Work Items

### Phase 0: Bootstrap Test Fixture Repo

| ID | Task | Dependencies | Est. |
|----|------|-------------|------|
| **E0** | **Run `scripts/setup-test-fixtures.sh`** — creates `jsturtevant/rally-test-fixtures` with 2 issues and 1 PR for dispatch e2e tests. Idempotent; safe to re-run. | None | S |

### Phase 1: Build the Markdown Test Runner

| ID | Task | Dependencies | Est. |
|----|------|-------------|------|
| **E1** | **✅ Implement `test/e2e/runner.js`** — markdown parser, command executor, exact matcher, `node:test` integration. | None | M |
| **E2** | **✅ Implement environment isolation in the runner.** Create temp `RALLY_HOME` for each test file. Handle `repo: local` (clone fixture repo into temp dir) and `repo: owner/repo` (no setup — rally clones it) per frontmatter. No config pre-seeding — tests build their own state by running real CLI commands. | None | S |
| **E3** | **✅ Implement exact matching.** Whitespace normalization, terminal line-wrap unwrapping, line-by-line exact comparison, clear diff output on failure. Variable substitution for dynamic values (`$RALLY_HOME`, `$HOME`, etc.). | None | S |

### Phase 2: First Markdown Test File (Proof of Concept)

| ID | Task | Dependencies | Est. |
|----|------|-------------|------|
| **E4** | **✅ Write `test/e2e/cli/help.md`** with test cases for `rally --help` and `rally --version`. Validate that `node --test test/e2e/runner.js` discovers and passes them. | E1 | S |
| **E5** | **✅ Write `test/e2e/cli/status.md`** — Tests `rally status` commands in a fresh environment with no onboarded projects. Validates basic CLI functionality without repo setup. | E1, E2 | S |

### Phase 3: Convert Existing CLI Tests to Markdown

| ID | Task | Dependencies | Est. |
|----|------|-------------|------|
| **E6** | **✅ Write `test/e2e/cli/onboard.md`** — help tests for onboard and onboard remove. **`test/e2e/cli/onboard-local.md`** — integration tests with `repo: local` (onboard + status verification). | E4 | S |
| **E7** | **Write `test/e2e/cli/dashboard.md`** — `dashboard --json` and related tests from `e2e.test.js`. | E4 | S |
| **E8** | **Write `test/e2e/cli/dispatch.md`** — convert dispatch tests from `e2e.test.js` (dispatch issue, dispatch clean, dispatch sessions). | E4, E2 | M |
| **E9** | **Retire `e2e.test.js` monolith.** Once all its CLI-stdout tests are covered by markdown files, remove it. Keep any library-level dispatch tests that need real GitHub API calls as separate integration tests. | E6, E7, E8 | S |

### Phase 4: Wire into CI

| ID | Task | Dependencies | Est. |
|----|------|-------------|------|
| **E10** | **✅ Fix the `test:e2e` script.** Runs both `test/e2e/runner.js` (markdown tests) and `./test/e2e/e2e.test.js` (existing monolith) until monolith is retired in E9. | E4 | S |
| **E11** | **Add `test:e2e:pty` script** for existing PTY/journey tests. Run on Ubuntu-only in CI. Fix the glob to actually discover `cli/*.test.js` and `journeys/**/*.test.js`. | None | S |
| **E12** | **✅ Update CI workflow** to run `test:e2e` (markdown + monolith tests, all platforms). PTY test wiring deferred. | E10 | S |

### Phase 5: Expand Coverage to Untested Commands

| ID | Task | Dependencies | Est. |
|----|------|-------------|------|
| **E13** | **Add `dispatch pr` test cases** to `dispatch.md`. | E8 | S |
| **E14** | **Add `dispatch refresh` test cases** to `dispatch.md`. | E8 | S |
| **E15** | **Add `dispatch log` test cases** to `dispatch.md`. | E8 | S |

**Size key:** S = < 1 hour, M = 1–3 hours, L = 3–8 hours.

---

## 6. Out of Scope

- **PTY/interactive/journey tests.** The markdown format covers CLI-stdout tests only. Tests that need an interactive terminal (dashboard navigation, keyboard input, visual regression) stay as JavaScript `.test.js` files using the existing PTY harness.
- **Rewriting `terminal.js` or the snapshot harness.** They work. We keep them.
- **Unit test changes.** This PRD covers `test/e2e/` only. Unit tests in `test/*.test.js` and `test/ui/*.test.js` are a separate concern.
- **CI matrix expansion.** The current 4-combo matrix (Ubuntu + Windows × Node 20 + 22) is fine.
- **Removing `node-pty` / `canvas` dependencies.** Still needed for PTY tests. But the markdown tests have **zero native dependencies**, which is a key advantage.

---

## 7. Success Criteria

1. **You can read any `.md` file in `test/e2e/cli/` and immediately understand what command is being tested and what output is expected.** No JavaScript knowledge required.
2. **Adding a new CLI test = adding a heading to a markdown file.** No new `.test.js` file, no boilerplate, no imports.
3. **`npm run test:e2e` runs the markdown-driven tests** and passes on all CI matrix combos.
4. **Zero pre-seeded config files.** All test state is created by running real CLI commands. No fake `projects.yaml`, no mocking, no config pre-population.
5. **All CLI-stdout commands have at least one markdown test case** — including `dispatch pr` and `dispatch refresh` which currently have zero coverage.
6. **The `.md` test files are browsable on GitHub** as informal command reference documentation.

---

## 8. Migration Strategy

**Incremental, additive, non-destructive.** The markdown tests are layered alongside existing tests — nothing is deleted until it's replaced.

- **Phase 1** (runner) is pure greenfield. No existing files are modified.
- **Phase 2** (help.md, status.md) proves the concept. Run `node --test test/e2e/runner.js` locally to validate. Existing tests still pass unchanged.
- **Phase 3** converts tests one file at a time. Each markdown file replaces one or more `.test.js` files. The monolith `e2e.test.js` is deleted only after all its test cases are covered.
- **Phase 4** fixes the CI glob and wires in both the new markdown tests and the existing PTY tests. This is the PR that finally solves the "22 of 23 files don't run" problem.
- **Phase 5** is purely additive — new test cases for untested commands, one heading at a time.

**Rollback:** If the markdown approach doesn't work out, the existing `.test.js` files are untouched until Phase 3. The runner is a single new file that can be deleted.

---

## 9. Key Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Tests are documentation.** `.md` files should be readable on GitHub as command reference. | Lowers the barrier to contributing tests. Anyone who can read markdown can review or write a test. |
| 2 | **No JavaScript in test files.** All logic lives in `runner.js`. | Eliminates boilerplate duplication. Test files can't drift in style or approach. |
| 3 | **Exact matching with line-wrap handling.** Whitespace-normalized, line-by-line equality after terminal line unwrapping. | Exact matching catches real regressions (extra/missing output lines). Terminal wrapping is the only legitimate formatting variance — handled by joining consecutive actual lines. Variable substitutions handle machine-specific paths. |
| 4 | **One runner, many `.md` files.** Adding a test = adding a heading. | Maximally low friction for test authors. No imports, no setup, no teardown code to write. |
| 5 | **PTY/interactive tests stay as JS.** Markdown format covers CLI-stdout tests only. | Interactive terminal tests need `node-pty`, keyboard input simulation, and frame-based assertions — fundamentally different from "run command, check output". |

---

## 10. Test Case Inventory

Every test case needed for complete CLI coverage. Each entry maps directly to a `## \`command\`` heading in the markdown test files.

> **How these were captured:** Every command below was run against the real `rally` CLI (v0.1.0). Commands that need config state were tested by running `rally onboard` first to create real state — the same approach the new markdown tests will use.

### rally (top-level)

#### `rally --help`

Shows all available commands and global options.

```expected
Usage: rally [options] [command]

Dispatch Squad teams to GitHub issues and PR reviews via git worktrees

Options:
  -V, --version             output the version number
  -h, --help                display help for command

Commands:
  onboard [options] [path]  Onboard a repo to Rally (local path, GitHub URL, or owner/repo)
  status [options]          Show Rally configuration and active dispatches for debugging
  dashboard [options]       Show active dispatch dashboard
  dispatch                  Dispatch Squad to a GitHub issue or PR
  help [command]            display help for command
```

#### `rally --version`

Prints the installed version number.

```expected
0.1.0
```

### rally onboard

#### `rally onboard --help`

Shows onboard usage, arguments, options, and subcommands.

```expected
Usage: rally onboard [options] [command] [path]

Onboard a repo to Rally (local path, GitHub URL, or owner/repo)

Arguments:
  path                        Path, GitHub URL, or owner/repo (defaults to current directory)

Options:
  --team <name>               Use a named team (skips interactive prompt)
  --fork <owner/repo>         Set origin to your fork and upstream to the main repo
  -h, --help                  display help for command

Commands:
  remove [options] [project]  Remove an onboarded project from Rally
```

#### `rally onboard .`

Onboards the current directory (local path form). Requires `repo: local` — the runner clones `rally-test-fixtures` into a temp directory first. Modifies filesystem (symlinks, `.git/info/exclude`) and writes to `projects.yaml`.

*(Requires runner setup support)*

```expected
✓ Updated .git/info/exclude
```

#### `rally onboard jsturtevant/rally-test-fixtures`

Onboards by owner/repo shorthand (remote form). Integration test — needs network access to resolve the repo on GitHub. Uses the shared fixture repo as the onboard target.

```expected
✓ Updated .git/info/exclude
```

#### `rally onboard --team default .`

Onboards with an explicit team name, skipping the interactive prompt. Requires `repo: local`.

*(Requires runner setup support)*

```expected
✓ Updated .git/info/exclude
```

#### `rally onboard --fork jsturtevant/rally-test-fixtures .`

Onboards with a fork configuration. Requires `repo: local`. Modifies git remotes (`origin`, `upstream`).

*(Requires runner setup support)*

```expected
✓ Updated origin → https://github.com/jsturtevant/rally-test-fixtures.git
✓ Updated .git/info/exclude
```

### rally onboard remove

#### `rally onboard remove --help`

Shows remove subcommand usage.

```expected
Usage: rally onboard remove [options] [project]

Remove an onboarded project from Rally

Arguments:
  project     Project name to remove (interactive picker if omitted)

Options:
  --yes       Skip confirmation prompt
  -h, --help  display help for command
```

#### `rally onboard remove --yes <project>`

Removes a previously onboarded project, skipping the confirmation prompt. Requires a project to be onboarded first — chain after an `onboard .` test earlier in the same file.

*(Requires runner setup support)*

```expected
✓ Removed
```

### rally status

#### `rally status --help`

Shows status usage and options.

```expected
Usage: rally status [options]

Show Rally configuration and active dispatches for debugging

Options:
  --json      Output as JSON
  -h, --help  display help for command
```

#### `rally status`

Displays config paths, directories, onboarded projects, and active dispatches in human-readable format. Runs after `rally onboard .` in the same file.

```expected
Rally Status
============

Config Paths:
  ✓ config: $RALLY_HOME/config.yaml
  ✓ projects: $RALLY_HOME/projects.yaml
  ✓ active: $RALLY_HOME/active.yaml

Directories:
  configDir:     $RALLY_HOME
  projectsDir:   $RALLY_HOME/projects

Onboarded Projects (1):
  - rally: $REPO_ROOT

Active Dispatches (0):
  (none)
```

#### `rally status --json`

Outputs full config state as JSON. Runs after `rally onboard .` in the same file.

```expected
{
  "configDir": "$RALLY_HOME",
  "configPaths": {
    "config": {
      "path": "$RALLY_HOME/config.yaml",
      "exists": true
    },
    "projects": {
      "path": "$RALLY_HOME/projects.yaml",
      "exists": true
    },
    "active": {
      "path": "$RALLY_HOME/active.yaml",
      "exists": true
    }
  },
  "projects": [
    {
      "name": "rally",
      "path": "$REPO_ROOT",
      "repo": "jsturtevant/rally",
      "team": "shared"
    }
  ],
  "dispatches": []
}
```

### rally dashboard

#### `rally dashboard --help`

Shows dashboard usage and options.

```expected
Usage: rally dashboard [options]

Show active dispatch dashboard

Options:
  --json            Output as JSON instead of interactive UI
  --project <name>  Filter by project (repo name)
  -h, --help        display help for command
```

#### `rally dashboard --json`

Outputs dispatch data as JSON. Runs after `rally onboard .` in the same file.

```expected
{
  "dispatches": [],
  "onboardedProjects": [
    "jsturtevant/rally"
  ]
}
```

#### `rally dashboard --json --project myrepo`

Filters dispatches to a specific project. With no matching dispatches, returns empty list with no matching onboarded projects. Runs after `rally onboard .` in the same file.

```expected
{
  "dispatches": [],
  "onboardedProjects": []
}
```

### rally dispatch (parent)

#### `rally dispatch --help`

Shows all dispatch subcommands.

```expected
Usage: rally dispatch [options] [command]

Dispatch Squad to a GitHub issue or PR

Options:
  -h, --help                   display help for command

Commands:
  issue [options] [number]     Dispatch Squad to a GitHub issue
  pr [options] [number]        Dispatch Squad to a GitHub PR review
  remove [options] <number>    Remove an active dispatch
  refresh                      Refresh dispatch statuses by checking if Copilot processes have exited
  log [options] <number>       View Copilot output log for a dispatch
  clean [options]              Clean done dispatches (remove worktrees and branches)
  continue [options] <number>  Reconnect to Copilot session for an active dispatch
  sessions                     List active dispatches with session info
```

### rally dispatch issue

#### `rally dispatch issue --help`

Shows dispatch issue usage. Requires integration test to actually dispatch.

```expected
Usage: rally dispatch issue [options] [number]

Dispatch Squad to a GitHub issue

Arguments:
  number               GitHub issue number (interactive picker if omitted)

Options:
  --repo <owner/repo>  Target repository (owner/repo)
  --repo-path <path>   Path to local repo clone
  --sandbox            Run Copilot inside a Docker sandbox microVM for host isolation
  --trust              Skip author/org trust warnings (for automation)
  -h, --help           display help for command
```

### rally dispatch pr

#### `rally dispatch pr --help`

Shows dispatch pr usage. Requires integration test to actually dispatch.

```expected
Usage: rally dispatch pr [options] [number]

Dispatch Squad to a GitHub PR review

Arguments:
  number               GitHub PR number (interactive picker if omitted)

Options:
  --repo <owner/repo>  Target repository (owner/repo)
  --repo-path <path>   Path to local repo clone
  --sandbox            Run Copilot inside a Docker sandbox microVM for host isolation
  --prompt <path>      Path to a custom review prompt file
  --trust              Skip author/org trust warnings (for automation)
  -h, --help           display help for command
```

### rally dispatch remove

#### `rally dispatch remove --help`

Shows dispatch remove usage.

```expected
Usage: rally dispatch remove [options] <number>

Remove an active dispatch

Arguments:
  number               Issue or PR number

Options:
  --repo <owner/repo>  Target repository (owner/repo)
  -h, --help           display help for command
```

### rally dispatch refresh

#### `rally dispatch refresh --help`

Shows dispatch refresh usage.

```expected
Usage: rally dispatch refresh [options]

Refresh dispatch statuses by checking if Copilot processes have exited

Options:
  -h, --help  display help for command
```

#### `rally dispatch refresh`

Checks all active dispatches and updates status for any whose Copilot process has exited. With zero dispatches, reports all up to date. Runs after `rally onboard .` in the same file.

```expected
All dispatch statuses are up to date.
```

### rally dispatch log

#### `rally dispatch log --help`

Shows dispatch log usage.

```expected
Usage: rally dispatch log [options] <number>

View Copilot output log for a dispatch

Arguments:
  number               Issue or PR number

Options:
  --repo <owner/repo>  Target repository (owner/repo)
  -f, --follow         Follow log output (tail -f style)
  -h, --help           display help for command
```

### rally dispatch clean

#### `rally dispatch clean --help`

Shows dispatch clean usage and flags.

```expected
Usage: rally dispatch clean [options]

Clean done dispatches (remove worktrees and branches)

Options:
  --all       Clean all dispatches, not just done ones
  --yes       Skip confirmation prompt for --all
  -h, --help  display help for command
```

#### `rally dispatch clean`

Cleans done dispatches. With no dispatches, prints a no-op message. Runs after `rally onboard .` in the same file.

```expected
No active dispatches.
```

#### `rally dispatch clean --all --yes`

Cleans all dispatches without prompting. With no dispatches, prints a no-op message. Runs after `rally onboard .` in the same file.

```expected
No active dispatches.
```

### rally dispatch continue

#### `rally dispatch continue --help`

Shows dispatch continue usage.

```expected
Usage: rally dispatch continue [options] <number>

Reconnect to Copilot session for an active dispatch

Arguments:
  number                Issue or PR number

Options:
  --repo <owner/repo>   Target repository (owner/repo)
  -m, --message <text>  Additional instructions for Copilot on reconnect
  -h, --help            display help for command
```

### rally dispatch sessions

#### `rally dispatch sessions --help`

Shows dispatch sessions usage.

```expected
Usage: rally dispatch sessions [options]

List active dispatches with session info

Options:
  -h, --help  display help for command
```

#### `rally dispatch sessions`

Lists dispatches with Copilot session info. With zero dispatches, prints a no-op message. Runs after `rally onboard .` in the same file.

```expected
No active dispatches.
```
