# E2E Markdown Tests

Markdown-driven end-to-end tests for the Rally CLI. Each `.md` file in `test/e2e/cli/` is both documentation and an executable test spec.

## Running Tests

```bash
# Run all markdown e2e tests
npm run test:e2e

# Run a specific test file (use the filename as pattern)
node --test --test-name-pattern="status.md" test/e2e/runner.js

# Run with verbose output (shows actual output + diff)
VERBOSE=1 node --test test/e2e/runner.js
```

## Filtering Tests

The runner registers each `.md` file as a `describe()` suite and each `## \`command\`` heading as an `it()` test. The `--test-name-pattern` flag matches against both.

**⚠️ Sequential test files:** Some files (like `onboard-local.md`) have tests that depend on earlier tests in the same file — e.g., `rally status` depends on `rally onboard` having run first. If you filter by test name and skip the setup step, dependent tests will fail.

**Safe patterns:**

| Want to run | Pattern | Why |
|-------------|---------|-----|
| All tests in a file | `--test-name-pattern="status.md"` | Matches the suite name, runs all tests within it |
| All tests in a file | `--test-name-pattern="onboard-local"` | Matches the suite, runs all 5 tests in order |
| One specific command | `--test-name-pattern="rally --help"` | OK if the test has no dependencies |

**Unsafe patterns:**

| Pattern | Problem |
|---------|---------|
| `--test-name-pattern="status"` | Matches `rally status` in **both** `status.md` and `onboard-local.md` — the onboard-local ones fail because `rally onboard` was skipped |
| `--test-name-pattern="rally onboard remove"` | Runs the remove test without the onboard that creates the project |

**⚠️ Exit code caveat:** When using `--test-name-pattern`, Node's test runner may exit with code 0 even when filtered tests fail. Always check the `ℹ fail` count in the output, not just the exit code. Running the full suite without `--test-name-pattern` correctly exits with code 1 on failure.

## Writing Tests

See the [PRD](../../docs/prd-e2e-test-rework.md) for full spec. Quick reference:

### Test format

````markdown
## `rally some-command --flag`

Description (ignored by runner).

```expected
exact expected output line 1
exact expected output line 2
```
````

### Available features

| Feature | Syntax | Example |
|---------|--------|---------|
| Expected output | `` ```expected `` block | Exact line-by-line match |
| Non-zero exit | `## \`command\` (exit 1)` | Bad command tests |
| Stdin input | `` ```stdin `` block | Piped input (non-TTY) |
| PTY interactive | `` ```pty `` block with match/send | Inquirer prompts (needs node-pty) |
| Variables | `$RALLY_HOME`, `$REPO_ROOT`, `$PROJECT_NAME`, `$XDG_CONFIG_HOME` | Dynamic paths |
| Repo setup | `clone: owner/repo` in frontmatter | Clones test fixtures repo via `gh repo clone` |
| Smoke test | Heading with no `` ```expected `` block | Just checks exit code 0 |

### PTY tests (interactive prompts)

For commands that trigger `@inquirer/prompts` (like `rally onboard .` without `--team`), use a `` ```pty `` block to script the prompt interactions:

````markdown
## `rally onboard .`

```pty
match: Would you like to create one now?
send: y

match: What kind of team do you need?
send: {enter}
```

```expected
✓ Updated .git/info/exclude
✓ Registered project: $PROJECT_NAME
```
````

PTY tests use **contains matching** (each expected line must appear in order, extra lines OK) because PTY output includes prompt text, ANSI codes, and menu decorations. Non-PTY tests in the same file still use exact matching.

Special keys: `{enter}`, `{up}`, `{down}`, `{space}`. Requires `node-pty` — tests are skipped if unavailable.

### Variables in commands

Variables work in both `## \`command\`` headings and `` ```expected `` blocks:

```markdown
## `rally onboard remove $PROJECT_NAME --yes`
```
