import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';

let pty;
try {
  pty = (await import('node-pty')).default;
} catch {
  // node-pty not available — PTY tests will be skipped
}

const RALLY_BIN = join(import.meta.dirname, '..', '..', 'bin', 'rally.js');
const CLI_DIR = join(import.meta.dirname, 'cli');
const VERBOSE = typeof process.env.VERBOSE === 'string' && /^(1|true|yes)$/i.test(process.env.VERBOSE.trim());
const DEFAULT_TIMEOUT = 30_000;

/**
 * Parse YAML frontmatter from markdown content
 * @param {string} content - markdown file content
 * @returns {{ frontmatter: object | null, body: string }}
 */
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: null, body: content };
  }

  const frontmatter = yaml.load(match[1], { schema: yaml.CORE_SCHEMA });
  const body = content.slice(match[0].length);
  
  // Validate frontmatter is an object
  if (frontmatter !== null && (typeof frontmatter !== 'object' || Array.isArray(frontmatter))) {
    throw new Error(`Frontmatter must be a YAML object (got ${typeof frontmatter}${Array.isArray(frontmatter) ? ' array' : ''})`);
  }
  
  return { frontmatter, body };
}

/**
 * Parse test cases from markdown body
 * @param {string} body - markdown content after frontmatter
 * @returns {Array<{ command: string, expected: string | null, expectedExitCode: number }>}
 */
function parseTestCases(body) {
  const testCases = [];
  const lines = body.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Look for heading: ## `command` or ## `command` (exit N)
    const headingMatch = line.match(/^##\s+`([^`]+)`(?:\s+\(exit\s+(\d+)\))?/);
    if (headingMatch) {
      const command = headingMatch[1];
      const expectedExitCode = headingMatch[2] ? parseInt(headingMatch[2], 10) : 0;
      i++;

      // Skip prose until we find ```expected, ```stdin, ```pty, or another heading
      let expected = null;
      let stdinInput = null;
      let ptySteps = null;
      while (i < lines.length) {
        const currentLine = lines[i];

        // Another heading means we're done with this test case
        if (currentLine.match(/^##\s+`/)) {
          break;
        }

        // Look for ```expected
        if (currentLine.match(/^```expected/)) {
          i++;
          const expectedLines = [];
          while (i < lines.length && !lines[i].match(/^```\s*$/)) {
            expectedLines.push(lines[i]);
            i++;
          }
          expected = expectedLines.join('\n');
          i++; // skip closing ```
          continue;
        }

        // Look for ```stdin
        if (currentLine.match(/^```stdin/)) {
          i++;
          const stdinLines = [];
          while (i < lines.length && !lines[i].match(/^```\s*$/)) {
            stdinLines.push(lines[i]);
            i++;
          }
          stdinInput = stdinLines.join('\n') + '\n';
          i++; // skip closing ```
          continue;
        }

        // Look for ```pty — interactive prompt steps
        if (currentLine.match(/^```pty/)) {
          i++;
          ptySteps = [];
          let currentMatch = null;
          while (i < lines.length && !lines[i].match(/^```\s*$/)) {
            const ptyLine = lines[i].trim();
            if (ptyLine.startsWith('match:')) {
              currentMatch = ptyLine.slice(6).trim();
            } else if (ptyLine.startsWith('send:')) {
              const rawInput = ptyLine.slice(5).trim();
              ptySteps.push({ match: currentMatch || '', input: rawInput });
              currentMatch = null;
            } else if (ptyLine === '' && currentMatch === null) {
              // blank line between steps — ignore
            }
            i++;
          }
          i++; // skip closing ```
          continue;
        }

        i++;
      }

      testCases.push({ command, expected, expectedExitCode, stdinInput, ptySteps });
    } else {
      i++;
    }
  }

  return testCases;
}

/**
 * Normalize a line for matching
 * @param {string} line
 * @returns {string}
 */
function normalizeLine(line) {
  return line.trim().replace(/\s+/g, ' ');
}

/**
 * Prepare actual and expected lines for comparison.
 * Applies variable substitutions, normalizes paths and whitespace,
 * and unwraps terminal-wrapped lines by greedily joining short actual
 * lines that together match the next expected line.
 *
 * @param {string} actual
 * @param {string} expected
 * @param {object} vars - variable substitutions
 * @returns {{ actualLines: string[], expectedLines: string[] }}
 */
function prepareLines(actual, expected, vars = {}) {
  let processedExpected = expected;
  for (const [key, value] of Object.entries(vars)) {
    processedExpected = processedExpected.replaceAll(key, value);
  }

  const normalizePaths = (str) => str.replace(/\\\\/g, '/').replace(/\\/g, '/');
  processedExpected = normalizePaths(processedExpected);
  actual = normalizePaths(actual);

  const rawActual = actual.split(/\r?\n/).map(normalizeLine).filter(l => l.length > 0);
  const expectedLines = processedExpected.split('\n').map(normalizeLine).filter(l => l.length > 0);

  // Unwrap terminal-wrapped lines: greedily join consecutive actual lines
  // when they match the next expected line
  const actualLines = [];
  let a = 0;
  let e = 0;
  while (a < rawActual.length) {
    let wrapped = false;
    if (e < expectedLines.length) {
      for (let n = 2; n <= 3 && a + n - 1 < rawActual.length; n++) {
        const joined = rawActual.slice(a, a + n).join(' ');
        const joinedNoSpace = rawActual.slice(a, a + n).join('');
        if (joined === expectedLines[e] || joinedNoSpace === expectedLines[e]) {
          actualLines.push(joined === expectedLines[e] ? joined : joinedNoSpace);
          a += n;
          e++;
          wrapped = true;
          break;
        }
      }
    }
    if (wrapped) continue;
    // No wrap match — take the line as-is
    if (e < expectedLines.length && rawActual[a] === expectedLines[e]) {
      e++;
    }
    actualLines.push(rawActual[a]);
    a++;
  }

  return { actualLines, expectedLines };
}

/**
 * Assert exact match — every expected line must match the corresponding actual line.
 * Handles terminal line wrapping via prepareLines unwrapping.
 *
 * @param {string} actual
 * @param {string} expected
 * @param {object} vars - variable substitutions
 */
function assertExactMatch(actual, expected, vars = {}) {
  const { actualLines, expectedLines } = prepareLines(actual, expected, vars);
  const max = Math.max(actualLines.length, expectedLines.length);

  for (let i = 0; i < max; i++) {
    const exp = expectedLines[i];
    const act = actualLines[i];
    if (exp === undefined) {
      assert.fail(
        `Extra actual line ${i + 1}:\n` +
        `  + "${act}"`
      );
    }
    if (act === undefined) {
      assert.fail(
        `Missing expected line ${i + 1}:\n` +
        `  - "${exp}"`
      );
    }
    if (act !== exp) {
      assert.fail(
        `Line ${i + 1} mismatch:\n` +
        `  expected: "${exp}"\n` +
        `  actual:   "${act}"`
      );
    }
  }
}

/**
 * Assert that each expected line appears in actual output, in order.
 * Used for PTY tests where output includes interactive prompt noise.
 *
 * @param {string} actual
 * @param {string} expected
 * @param {object} vars - variable substitutions
 */
function assertContainsLines(actual, expected, vars = {}) {
  const { actualLines, expectedLines } = prepareLines(actual, expected, vars);
  let a = 0;

  for (let e = 0; e < expectedLines.length; e++) {
    let found = false;
    while (a < actualLines.length) {
      if (actualLines[a] === expectedLines[e]) {
        found = true;
        a++;
        break;
      }
      a++;
    }
    if (!found) {
      assert.fail(
        `Expected line ${e + 1} not found in output:\n` +
        `  expected: "${expectedLines[e]}"\n` +
        `  searched ${actualLines.length} actual lines`
      );
    }
  }

  // Check for unmatched trailing actual lines after last expected match
  const trailing = actualLines.slice(a);
  if (trailing.length > 0) {
    assert.fail(
      `Actual output has ${trailing.length} unmatched trailing line(s) after last expected line:\n` +
      trailing.map(l => `  + "${l}"`).join('\n')
    );
  }
}

/**
 * Format a compact diff between expected and actual output.
 * Shows each line with ✓ (match) or ✗ (mismatch/missing/extra).
 *
 * @param {string} actual
 * @param {string} expected
 * @param {object} vars - variable substitutions
 * @returns {string}
 */
function formatDiff(actual, expected, vars = {}) {
  const { actualLines, expectedLines } = prepareLines(actual, expected, vars);
  const max = Math.max(actualLines.length, expectedLines.length);
  const lines = [];

  for (let i = 0; i < max; i++) {
    const exp = expectedLines[i];
    const act = actualLines[i];
    if (exp === undefined) {
      lines.push(`  + "${act}"`);
    } else if (act === undefined) {
      lines.push(`  ✗ "${exp}" (missing)`);
    } else if (act === exp) {
      lines.push(`  ✓ ${exp}`);
    } else {
      lines.push(`  ✗ "${exp}"`);
      lines.push(`    actual: "${act}"`);
    }
  }

  return lines.join('\n');
}

/**
 * Setup repo environment based on frontmatter
 * @param {object} frontmatter - parsed frontmatter
 * @returns {{ cwd: string, cleanup: Function }}
 */
function setupRepo(frontmatter) {
  if (!frontmatter || !frontmatter.repo) {
    // No repo setup needed
    return { cwd: process.cwd(), cleanup: () => {} };
  }

  const repoValue = frontmatter.repo;
  let ownerRepo;

  if (repoValue === 'local') {
    // Use RALLY_TEST_OWNER env var or default to jsturtevant
    const owner = process.env.RALLY_TEST_OWNER || 'jsturtevant';
    ownerRepo = `${owner}/rally-test-fixtures`;
  } else {
    ownerRepo = repoValue;
  }

  // Check gh auth status before attempting to clone
  if (repoValue === 'local') {
    try {
      execFileSync('gh', ['auth', 'status'], {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 30_000,
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(`gh not installed. Install GitHub CLI from https://cli.github.com`);
      }
      throw new Error(`gh not authenticated. Run 'gh auth login' to authenticate.`);
    }

    // Clone repo into temp directory
    const repoDir = mkdtempSync(join(tmpdir(), 'rally-test-repo-'));

    try {
      execFileSync('gh', ['repo', 'clone', ownerRepo, repoDir], {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 30_000,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          NO_COLOR: '1',
          FORCE_COLOR: undefined,
        },
      });
    } catch (err) {
      rmSync(repoDir, { recursive: true, force: true });
      throw new Error(`Failed to clone ${ownerRepo}: ${err.message}`);
    }

    return {
      cwd: repoDir,
      cleanup: () => {
        rmSync(repoDir, { recursive: true, force: true });
      },
    };
  }

  // For owner/repo format, create temp dir but don't clone (rally handles cloning)
  const repoDir = mkdtempSync(join(tmpdir(), 'rally-test-repo-'));

  return {
    cwd: repoDir,
    cleanup: () => {
      rmSync(repoDir, { recursive: true, force: true });
    },
  };
}

/**
 * Execute a rally command
 * @param {string} command - full command string (e.g., "rally --help")
 * @param {string} rallyHome - RALLY_HOME path
 * @param {string} cwd - working directory
 * @param {object} [opts] - options
 * @param {string} [opts.xdgConfigHome] - XDG_CONFIG_HOME override for personal squad
 * @param {string} [opts.stdinInput] - stdin input to pipe to the command
 * @returns {string} - stdout
 */
function executeCommand(command, rallyHome, cwd, opts = {}) {
  // Extract args after "rally"
  const parts = command.trim().split(/\s+/);
  if (parts[0] !== 'rally') {
    throw new Error(`Command must start with "rally", got: ${command}`);
  }

  const args = parts.slice(1);
  const env = {
    ...process.env,
    RALLY_HOME: rallyHome,
    NO_COLOR: '1',
    FORCE_COLOR: undefined,
    GIT_TERMINAL_PROMPT: '0',
  };
  if (opts.xdgConfigHome) {
    env.XDG_CONFIG_HOME = opts.xdgConfigHome;
  }

  const execOpts = {
    encoding: 'utf8',
    cwd,
    timeout: DEFAULT_TIMEOUT,
    env,
  };
  if (opts.stdinInput) {
    execOpts.input = opts.stdinInput;
  }
  try {
    return execFileSync(process.execPath, [RALLY_BIN, ...args], execOpts);
  } catch (err) {
    // If the command is expected to fail (exit non-zero), capture the output
    const output = (err.stdout || '') + (err.stderr || '');
    // Re-throw with output attached so tests can still match against it
    err.output = output;
    throw err;
  }
}

/**
 * Execute a rally command in a PTY with scripted interactive input.
 * @param {string} command - full command string (e.g., "rally onboard .")
 * @param {string} rallyHome - RALLY_HOME path
 * @param {string} cwd - working directory
 * @param {Array<{match: string, input: string}>} steps - prompt match/response pairs
 * @param {object} [opts] - options
 * @param {string} [opts.xdgConfigHome] - XDG_CONFIG_HOME override
 * @returns {Promise<{output: string, exitCode: number}>}
 */
function executePtyCommand(command, rallyHome, cwd, steps, opts = {}) {
  if (!pty) {
    throw new Error('node-pty not available — cannot run PTY tests');
  }

  const parts = command.trim().split(/\s+/);
  if (parts[0] !== 'rally') {
    throw new Error(`Command must start with "rally", got: ${command}`);
  }
  const args = [RALLY_BIN, ...parts.slice(1)];

  const env = {
    ...process.env,
    RALLY_HOME: rallyHome,
    NO_COLOR: '1',
    FORCE_COLOR: undefined,
    GIT_TERMINAL_PROMPT: '0',
  };
  if (opts.xdgConfigHome) {
    env.XDG_CONFIG_HOME = opts.xdgConfigHome;
  }

  return new Promise((resolve, reject) => {
    let output = '';
    let stepIndex = 0;
    let lastPromptEnd = 0;
    const timeout = setTimeout(() => {
      ptyProcess.kill();
      reject(new Error(
        `PTY command timed out after ${DEFAULT_TIMEOUT}ms.\n` +
        `Waiting for step ${stepIndex}: match "${steps[stepIndex]?.match}"\n` +
        `Output so far:\n${output}`
      ));
    }, DEFAULT_TIMEOUT);

    const ptyProcess = pty.spawn(process.execPath, args, {
      name: 'xterm-color',
      cols: 120,
      rows: 30,
      cwd,
      env,
    });

    ptyProcess.onData((data) => {
      output += data;
      if (VERBOSE) {
        process.stdout.write(data);
      }

      if (stepIndex < steps.length) {
        const { match, input } = steps[stepIndex];
        // Resolve special keys
        const resolvedInput = input
          .replace(/\{enter\}/gi, '\r')
          .replace(/\{up\}/gi, '\x1b[A')
          .replace(/\{down\}/gi, '\x1b[B')
          .replace(/\{space\}/gi, ' ');

        if (output.includes(match)) {
          // Track where this prompt appeared so we can split output later
          lastPromptEnd = output.length;
          setTimeout(() => {
            const send = resolvedInput.includes('\r') ? resolvedInput : resolvedInput + '\r';
            ptyProcess.write(send);
            stepIndex++;
          }, 200);
        }
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      clearTimeout(timeout);
      // Strip ANSI escape sequences
      const clean = output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '');
      // Extract output after the last interactive prompt
      const cleanAfterPrompts = clean.slice(lastPromptEnd)
        .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '');
      resolve({ output: clean, outputAfterPrompts: cleanAfterPrompts, exitCode });
    });
  });
}
if (!existsSync(CLI_DIR)) {
  console.log('No test/e2e/cli/ directory found — skipping markdown tests');
  // Directory doesn't exist yet - no tests to run
  describe('markdown-driven E2E tests', () => {
    it('no .md files found', () => {
      assert.ok(true, 'test/e2e/cli/ directory does not exist yet');
    });
  });
} else {
  // Recursively find all .md files in CLI_DIR
  function findMdFiles(dir, base = '') {
    const entries = readdirSync(dir, { withFileTypes: true });
    let files = [];
    for (const entry of entries) {
      const rel = base ? join(base, entry.name) : entry.name;
      if (entry.isDirectory()) {
        files = files.concat(findMdFiles(join(dir, entry.name), rel));
      } else if (entry.name.endsWith('.md')) {
        files.push(rel);
      }
    }
    return files.sort();
  }
  const mdFiles = findMdFiles(CLI_DIR);

  if (mdFiles.length === 0) {
    describe('markdown-driven E2E tests', () => {
      it('no .md files found', () => {
        assert.fail('No markdown test specs found in test/e2e/cli/');
      });
    });
  } else {
    for (const file of mdFiles) {
      const filePath = join(CLI_DIR, file);
      const content = readFileSync(filePath, 'utf8');
      const { frontmatter, body } = parseFrontmatter(content);
      const testCases = parseTestCases(body);

      describe(file, () => {
        let rallyHome;
        let repoSetup;
        let xdgConfigHome;

        before(async () => {
          // Create temp RALLY_HOME
          rallyHome = mkdtempSync(join(tmpdir(), 'rally-test-home-'));

          // Create isolated XDG_CONFIG_HOME so squad creation doesn't affect real config
          xdgConfigHome = mkdtempSync(join(tmpdir(), 'rally-test-xdg-'));

          // Run setup command if specified in frontmatter
          if (frontmatter && frontmatter.setup) {
            try {
              const setupOutput = execFileSync(process.execPath, [frontmatter.setup], {
                encoding: 'utf8',
                cwd: import.meta.dirname,
                timeout: DEFAULT_TIMEOUT,
                env: {
                  ...process.env,
                  RALLY_HOME: rallyHome,
                  XDG_CONFIG_HOME: xdgConfigHome,
                  NO_COLOR: '1',
                  FORCE_COLOR: undefined,
                },
              });
              if (VERBOSE) {
                console.error(`Setup (${frontmatter.setup}): ${setupOutput.trim()}`);
              }
            } catch (err) {
              rmSync(rallyHome, { recursive: true, force: true });
              rmSync(xdgConfigHome, { recursive: true, force: true });
              throw new Error(`Setup command failed: ${frontmatter.setup}\n${err.message}`);
            }
          }

          // Setup repo if needed
          try {
            repoSetup = setupRepo(frontmatter);
          } catch (err) {
            rmSync(rallyHome, { recursive: true, force: true });
            rmSync(xdgConfigHome, { recursive: true, force: true });
            throw err;
          }
        });

        after(() => {
          // Cleanup repo
          if (repoSetup && repoSetup.cleanup) {
            repoSetup.cleanup();
          }

          // Cleanup RALLY_HOME and XDG_CONFIG_HOME
          if (rallyHome) {
            rmSync(rallyHome, { recursive: true, force: true });
          }
          if (xdgConfigHome) {
            rmSync(xdgConfigHome, { recursive: true, force: true });
          }
        });

        // Ensure at least one test case exists
        if (testCases.length === 0) {
          it('should have at least one test case', () => {
            assert.fail(`No test cases found in ${file}. Check that headings follow the format: ## \`command\``);
          });
        }

        // Execute tests sequentially
        for (const testCase of testCases) {
          const { command: rawCommand, expected, expectedExitCode, stdinInput, ptySteps } = testCase;

          // PTY tests need async; skip if node-pty unavailable
          if (ptySteps && !pty) {
            it(rawCommand, { skip: 'node-pty not available' }, () => {});
            continue;
          }

          it(rawCommand, async () => {
            // Substitute variables in command (must be inside it() — repoSetup is set in before())
            const commandVars = {
              '$RALLY_HOME': rallyHome,
              '$REPO_ROOT': repoSetup.cwd,
              '$PROJECT_NAME': basename(repoSetup.cwd),
              '$XDG_CONFIG_HOME': xdgConfigHome || '',
            };
            let command = rawCommand;
            for (const [key, value] of Object.entries(commandVars)) {
              command = command.replaceAll(key, value);
            }

            let output;
            let exitCode = 0;

            if (ptySteps) {
              // PTY execution for interactive commands
              const result = await executePtyCommand(
                command, rallyHome, repoSetup.cwd, ptySteps,
                { xdgConfigHome }
              );
              output = result.output;
              exitCode = result.exitCode;
            } else {
              // Standard execution
              const execOpts = { xdgConfigHome, stdinInput };
              try {
                output = executeCommand(command, rallyHome, repoSetup.cwd, execOpts);
              } catch (err) {
                output = err.output || '';
                exitCode = err.status || err.code || 1;
              }
            }

            if (expected === null) {
              // Smoke test - no expected output block
              if (VERBOSE) {
                console.log(`\n── ${rawCommand} (${file}) ──`);
                if (exitCode !== 0) {
                  console.log(`⚠️  Command exited with code ${exitCode}`);
                }
                console.log(`ACTUAL:\n${output}`);
                console.log('(no expected block — smoke test)');
                console.log('MATCH ✓');
              }
              if (exitCode !== expectedExitCode) {
                assert.fail(`Command exited with code ${exitCode} (expected exit ${expectedExitCode}).`);
              }
              assert.ok(output !== undefined, 'command should run');
            } else {
              // Variable substitutions
              const vars = {
                '$RALLY_HOME': rallyHome,
                '$REPO_ROOT': repoSetup.cwd,
                '$PROJECT_NAME': basename(repoSetup.cwd),
                '$XDG_CONFIG_HOME': xdgConfigHome || '',
              };

              if (VERBOSE) {
                console.log(`\n── ${rawCommand} (${file}) ──`);
                if (exitCode !== 0) {
                  console.log(`⚠️  Command exited with code ${exitCode}`);
                }
                console.log(`ACTUAL:\n${output}`);
                console.log(`DIFF (expected vs actual):`);
                console.log(formatDiff(output, expected, vars));
              }

              try {
                // PTY tests use contains matching (output includes prompt noise);
                // standard tests use exact matching
                if (ptySteps) {
                  assertContainsLines(output, expected, vars);
                } else {
                  assertExactMatch(output, expected, vars);
                }
                if (VERBOSE) console.log('MATCH ✓');
                
                // Check exit code after output matching
                if (exitCode !== expectedExitCode) {
                  assert.fail(
                    `Command exited with code ${exitCode} (expected exit ${expectedExitCode}). ` +
                    `Output matched but exit code indicates ${exitCode === 0 ? 'success' : 'failure'}.`
                  );
                }
              } catch (err) {
                if (VERBOSE) {
                  console.log(`\n${'━'.repeat(60)}`);
                  console.log(`❌ FAIL: ${rawCommand}`);
                  console.log(`   File: ${file}`);
                  console.log(`${'━'.repeat(60)}`);
                  console.log(err.message);
                  console.log(`${'━'.repeat(60)}\n`);
                } else {
                  console.log(`\n── ${command} ──`);
                  console.log(`ACTUAL:\n${output}`);
                  console.log(`DIFF (expected vs actual):`);
                  console.log(formatDiff(output, expected, vars));
                }
                throw err;
              }
            }
          });
        }
      });
    }
  }
}

// Exports for unit testing
export { prepareLines, assertExactMatch, assertContainsLines, normalizeLine, parseTestCases, parseFrontmatter };
