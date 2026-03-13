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
| Expected output | `` ```expected `` block | See above |
| Non-zero exit | `## \`command\` (exit 1)` | Bad command tests |
| Stdin input | `` ```stdin `` block | Interactive prompts |
| Variables | `$RALLY_HOME`, `$REPO_ROOT`, `$PROJECT_NAME`, `$XDG_CONFIG_HOME` | Dynamic paths |
| Repo setup | `repo: local` in frontmatter | Clones test fixtures repo |
| Smoke test | Heading with no `` ```expected `` block | Just checks exit code 0 |

### Variables in commands

Variables work in both `## \`command\`` headings and `` ```expected `` blocks:

```markdown
## `rally onboard remove $PROJECT_NAME --yes`
```
