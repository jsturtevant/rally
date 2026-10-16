# markdown-e2e

A standalone Rust binary for Markdown-driven CLI tests. This directory is a
self-contained Cargo package: it can be copied into another repository without
any Rally code, JavaScript runner, or Node dependencies. Node is only needed
when a tested command or setup script uses it. PTY support is built in.

```sh
cargo build --release --manifest-path tools/markdown-e2e/Cargo.toml
tools/markdown-e2e/target/release/markdown-e2e path/to/specs
```

Install with `cargo install --path tools/markdown-e2e`, then distribute the
resulting `markdown-e2e` executable for the target OS/architecture.

## Rally compatibility

**The Rust binary is the test runner.** It can execute Rally's
Markdown scenarios directly, without npm or Cargo at runtime.

First build Rally's JSX (`node test/build-jsx.mjs`, after installing its
dependencies) and ensure the `rally` executable is on `PATH`. For a local
checkout, `npm link --ignore-scripts` installs the package's standard executable.
Then, from the Rally root, run the installed `markdown-e2e` binary:

```sh
markdown-e2e test/e2e/cli \
  --home-env RALLY_HOME --env-prefix RALLY_E2E_ --tags-exclude slow
```

This runs the same non-slow Markdown scenarios as `npm run test:e2e`.
Node is needed by the **application and its existing JavaScript fixtures**, not
by the generic Rust runner. Each Markdown file declares its own setup command,
such as `setup: node setup-squad.js`; another file can use Python or a native
executable without affecting the rest of the suite. Tested commands resolve
through `PATH`.

### Optional npm aliases

The existing npm scripts remain convenience entry points. After application
preparation, their Markdown execution path is:

```text
npm run test:e2e -> cargo run -> markdown-e2e -> rally (from PATH)
```

There is no JavaScript Markdown runner or Node test adapter. npm orchestrates
the build and Cargo invocation; **Rust parses, executes, and checks the Markdown
scenarios**.

| npm alias | What it runs |
|-----------|--------------|
| `test:e2e` | Rust framework tests, Rally build, and non-slow Markdown scenarios |
| `test:e2e:fast` | Rust framework tests, Rally build, and Markdown scenarios outside `dispatch/` |
| `test:e2e:dispatch` | Rally build and Markdown scenarios tagged `slow` |
| `test:e2e:run` | Rust Markdown runner only, with Rally-specific flags; assumes Rally is already built |
| `test:e2e:runner` | `cargo test` for the Rust framework itself, not Rally's Markdown scenarios |

For example, `npm run test:e2e:run -- --test-name-pattern status.md` selects one
spec through the Rust runner. The former `node --test test/e2e/runner.js` entry
point is removed. The separate legacy `test:e2e:pty` JavaScript PTY/journey suite
is unchanged and is not the Markdown runner.

## Reuse in another project

Commands execute exactly as written and resolve through `PATH`. Put the tested
binary on `PATH`; there is no application-specific executable substitution:

```sh
PATH="$PWD/target/debug:$PATH" markdown-e2e tests/cli \
  --home-env MYCLI_HOME
```

Relative executables resolve from each spec's working directory; use absolute
paths for local builds when specs clone fixtures. `node ./helper.js` resolves
the script relative to the spec file, preserving the existing format.

Each file gets independent temporary application-home and XDG config directories.
Tests within a file run sequentially and share those directories. Without
`clone` frontmatter, commands run in `--cwd` (default: the current directory).
With `clone`, `gh auth status` and `gh repo clone` prepare a temporary repository.
The caller's GitHub authentication directory is preserved across XDG isolation.
Fixtures are cleaned up after each file, including failures. On Unix, SIGINT
and SIGTERM cancel the active command's process group, reap the command, clean
up fixtures, and stop the suite (exit 130 and 143 respectively).
On Windows, commands and PTYs run in per-command Job Objects. A startup gate
establishes job ownership before the tested command can spawn descendants.
Cleanup terminates the whole job even if the original command has already
exited; background descendants cannot keep using a completed file's fixtures.
Fixture environment overrides are case-insensitive on Windows.

## Specification format

````markdown
---
tags: [smoke]
timeout: 30
---
# My CLI

## `mycli --help`
```expected
Usage: mycli
```

## `mycli unknown` (exit 1)
```expected-contains
Error: unknown command
```
````

Optional YAML fields: `clone: owner/repo`, `setup: COMMAND`, `tags: [tag, ...]`,
and positive `timeout` in seconds. `setup` is a complete command local to that
Markdown file, not a suite-wide interpreter setting:

```yaml
setup: node setup-squad.js
```

Another file can declare `setup: python3 setup.py`, or execute a native script
directly with `setup: ./setup`. Quoting supports arguments and paths with spaces,
for example `setup: 'python3 "setup fixtures.py" --mode test'`.

Setup uses the same argument quoting rules as test commands, with no shell
expansion or pipeline processing. Executables resolve through `PATH` unless
they name a file beside the spec. Relative file arguments that exist beside the
spec, and explicit `./` or `../` paths, resolve relative to the Markdown file.
Setup runs from `--cwd`, after fixture cloning, with the file's isolated
application-home and configuration environment. Its command and timeout apply
only to that file. There is no `--setup-runner` flag.

Headings use ``## `command` `` with optional `(exit N)` (default exit 0).
Supported fenced blocks:

| Block | Meaning |
|-------|---------|
| `expected` | Exact output after normalizing paths, whitespace, blank lines and terminal wrapping |
| `expected-contains` | Expected lines must appear **as whole lines**, in order; trailing unmatched lines fail |
| `stdin` | Pipe the block plus a final newline to the command |
| `pty` | Interactive `match:` / `match-raw:` followed by `send:` directives |

Without an expected block, only the exit code is checked. Successful non-PTY
commands compare stdout; unsuccessful commands compare stdout followed by stderr.
Pipelines connect stdout to the next stage's stdin and stop at the first nonzero
exit. Commands never run through a shell. Single/double quotes group arguments;
backslashes are literal, with no shell expansion.

PTYs are 120 columns by 30 rows. `match:` ignores ANSI codes; `match-raw:`
preserves them. Matching advances separate raw and clean cursors. Every scripted
step must complete; missing prompts, spawn errors and timeouts always fail, even
when a nonzero exit is expected. PTY expected output uses contains matching.
Oversized scripted input remains subject to the command timeout and cancellation,
even when the child stops reading.

`send:` supports `{enter}`, `{up}`, `{down}`, `{space}`, `{backspace}`; no newline
is appended automatically. Raw matching supports `{hide-cursor}`, `{show-cursor}`,
`{clear-screen}`, `{alt-screen}`, and `\xNN`.

Command headings and expected output substitute `$REPO_ROOT`, `$PROJECT_NAME`,
`$XDG_CONFIG_HOME`, and the configured application-home variable (`$E2E_HOME`
by default). Stdin and PTY directive text remain literal.

## Filtering and diagnostics

Use `--file-pattern`, `--file-exclude`, `--tags`, `--tags-exclude`, or their
environment counterparts `E2E_FILE_PATTERN`, `E2E_FILE_EXCLUDE`, `E2E_TAGS`,
`E2E_TAGS_EXCLUDE`. `--env-prefix` changes the environment prefix. Explicit
flags take precedence. Tags are comma-separated and case-insensitive; inclusion
requires all tags, exclusion rejects any matching tag.

`--test-name-pattern REGEX` matches a relative spec path or command heading.
Matching a file selects every command in that file. Selecting a single command
does **not** run earlier prerequisite commands. Filters use Rust regex syntax.
`--list` lists selected commands without running setup or creating fixtures.
No matches and malformed specs are errors.

`--verbose` or `VERBOSE=1` (`true` and `yes` also work) prints output and diffs.
Failures always include diagnostics and produce a nonzero process exit, even
when name-filtered. `--timeout SECONDS` changes the default 30-second timeout;
frontmatter overrides it.

## Development

These commands check the Rust framework itself; `cargo test` does not execute
Rally's Markdown scenarios. Use the binary or the optional npm aliases above
for those scenarios.

```sh
cargo test --manifest-path tools/markdown-e2e/Cargo.toml
cargo fmt --manifest-path tools/markdown-e2e/Cargo.toml --check
cargo clippy --manifest-path tools/markdown-e2e/Cargo.toml --all-targets -- -D warnings
```

Tests compile a small Rust fixture executable and exercise pipelines, stdin,
PTYs, filters, setup, cloned fixtures, isolation, cleanup and failure handling
without Node, GitHub authentication, or network access.
Unix blocked-input regression tests use `stty` to put the fixture PTY in raw mode.
