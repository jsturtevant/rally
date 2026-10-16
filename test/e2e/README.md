# E2E Markdown Tests

Markdown-driven end-to-end tests for the Rally CLI. Each `.md` file in `test/e2e/cli/` is both documentation and an executable test spec.

The runner is [Markmason](https://github.com/jsturtevant/markmason), a standalone
Rust binary named `mm`. Its source, framework tests, and releases live in that
repository; Rally consumes the pinned `v0.1.1` release. Rust is not needed here.
Node is still required by Rally and its JavaScript fixtures.

## Running Tests

```bash
# Install the pinned binary (requires authenticated GitHub CLI and Bash)
npm run test:e2e:install
export PATH="$PWD/.tools/markmason/bin:$PATH"

# Put Rally on PATH
npm link --ignore-scripts

# Run non-slow markdown e2e tests
npm run test:e2e

# Run slow dispatch tests
npm run test:e2e:dispatch

# Run a specific test file (use the filename as pattern)
npm run test:e2e:run -- --test-name-pattern="status.md"

# Run with verbose output (shows actual output + diff)
VERBOSE=1 npm run test:e2e:run
```

The installer downloads the platform archive, verifies its SHA-256 checksum and
binary version, and installs only inside `.tools/markmason/`. In CI it also adds
the binary directory to `GITHUB_PATH`. Alternatively, install `mm` yourself and
put it on `PATH`. The npm aliases invoke `mm` directly, not Cargo or a Node runner.
Run `node test/build-jsx.mjs` first when using `test:e2e:run` directly.

To upgrade the pin, change `version` in `scripts/install-markmason.sh`.

## Filtering Tests

The runner treats each `.md` file as a suite and each `## \`command\`` heading as a
test. The `--test-name-pattern` flag matches relative file paths and command headings.

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

Failures return a nonzero exit code, including when filtering by test name.

The runner also supports env-var filtering before suites are selected:

| Env var | Behavior |
|---------|----------|
| `RALLY_E2E_FILE_PATTERN` | Include only spec paths matching the regex |
| `RALLY_E2E_FILE_EXCLUDE` | Exclude spec paths matching the regex |
| `RALLY_E2E_TAGS` | Include only specs that have **all** listed tags (comma-separated, case-insensitive) |
| `RALLY_E2E_TAGS_EXCLUDE` | Exclude specs that have **any** listed tags (comma-separated, case-insensitive) |

File filters and tag filters stack. For example, `RALLY_E2E_FILE_PATTERN=dispatch RALLY_E2E_TAGS_EXCLUDE=slow` runs only fast dispatch specs.

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
| Contains match | `` ```expected-contains `` block | Line-level contains — each expected line must appear in output in order, and any unmatched trailing lines after the last expected match cause the test to fail |
| Non-zero exit | `## \`command\` (exit 1)` | Bad command tests |
| Stdin input | `` ```stdin `` block | Piped input (non-TTY) |
| Pipelines | `cmd1 \| cmd2` in heading | `rally dispatch log 42 \| grep -c 'marker'` — chained commands, no shell |
| PTY interactive | `` ```pty `` block with match/send | Inquirer prompts (built into `mm`) |
| Raw PTY match | `match-raw:` in `` ```pty `` block | Match raw output including escape sequences |
| Variables | `$RALLY_HOME`, `$REPO_ROOT`, `$PROJECT_NAME`, `$XDG_CONFIG_HOME` | Dynamic paths |
| Repo setup | `clone: owner/repo` in frontmatter | Clones test fixtures repo via `gh repo clone` |
| Setup command | `setup: node setup-squad.js` in frontmatter | Per-file command; Python and native executables work too |
| Tags | `tags: [dispatch, slow]` in frontmatter | Filter specs with `RALLY_E2E_TAGS` / `RALLY_E2E_TAGS_EXCLUDE` |
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

PTY tests use **contains matching** (each expected line must appear in order, extra lines between matches are skipped, but no trailing lines allowed after the last match) because PTY output includes prompt text, ANSI codes, and menu decorations. Non-PTY tests in the same file still use exact matching.

Special keys: `{enter}`, `{up}`, `{down}`, `{space}`, `{backspace}`. Input is sent exactly as written — no automatic Enter appended. Use `{enter}` explicitly for prompts that need it (e.g., `send: y{enter}`). For raw keypresses like Ink TUI commands, send the key alone (e.g., `send: q`). PTY support is built into Markmason; these tests are not skipped for a missing Node package.

**Raw matching:** Use `match-raw:` instead of `match:` to match against raw PTY output _without_ ANSI stripping. This detects terminal control sequences that get stripped from normal matching. Named placeholders: `{hide-cursor}`, `{show-cursor}`, `{clear-screen}`, `{alt-screen}`. Raw hex escapes also work (e.g., `\x1b[2J`). Example: `match-raw: {hide-cursor}` waits for Ink TUI initialization.

### Variables in commands

Variables work in both `## \`command\`` headings and `` ```expected `` blocks:

```markdown
## `rally onboard remove $PROJECT_NAME --yes`
```
