import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import {
  parseFrontmatter,
  parseTestCases,
  filterSpecFiles,
  formatDiff,
  assertContainsLines,
  assertExactMatch,
} from './runner-lib.js';

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
// Preserve gh CLI config dir so XDG_CONFIG_HOME overrides don't break gh auth.
// gh uses XDG_CONFIG_HOME/gh (Linux), %APPDATA%/GitHub CLI (Windows) by default,
// but GH_CONFIG_DIR takes precedence.
// See: https://cli.github.com/manual/gh_help_environment
function resolveGhConfigDir() {
  if (process.env.GH_CONFIG_DIR) return process.env.GH_CONFIG_DIR;
  if (process.env.XDG_CONFIG_HOME) return join(process.env.XDG_CONFIG_HOME, 'gh');
  if (process.platform === 'win32' && process.env.APPDATA) return join(process.env.APPDATA, 'GitHub CLI');
  return join(homedir(), '.config', 'gh');
}
const GH_CONFIG_DIR = resolveGhConfigDir();

/**
 * Setup repo environment based on frontmatter
 * @param {object} frontmatter - parsed frontmatter
 * @returns {{ cwd: string, cleanup: Function }}
 */
function setupRepo(frontmatter) {
  if (!frontmatter || !frontmatter.clone) {
    // No repo setup needed
    return { cwd: process.cwd(), cleanup: () => {} };
  }

  const ownerRepo = frontmatter.clone;

  // Check gh auth status before attempting to clone
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
        GH_PROMPT_DISABLED: '1',
        NO_COLOR: '1',
        FORCE_COLOR: '0',
      },
    });
  } catch (err) {
    rmSync(repoDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
    throw new Error(`Failed to clone ${ownerRepo}: ${err.message}`);
  }

  return {
    cwd: repoDir,
    cleanup: () => {
      rmSync(repoDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
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
  const parts = command.trim().split(/\s+/);
  const env = {
    ...process.env,
    RALLY_HOME: rallyHome,
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    GIT_TERMINAL_PROMPT: '0',
    GH_PROMPT_DISABLED: '1',
    GH_CONFIG_DIR,
  };
  if (opts.xdgConfigHome) {
    env.XDG_CONFIG_HOME = opts.xdgConfigHome;
    if (process.platform === 'win32') {
      env.APPDATA = opts.xdgConfigHome;
      env.LOCALAPPDATA = opts.xdgConfigHome;
    }
  }

  const execOpts = {
    encoding: 'utf8',
    cwd,
    timeout: opts.timeout || DEFAULT_TIMEOUT,
    env,
  };
  if (opts.stdinInput) {
    execOpts.input = opts.stdinInput;
  }

  // Rally commands go through node + rally bin; other commands run directly
  const isRally = parts[0] === 'rally';
  const execFile = isRally ? process.execPath : parts[0];
  let args = isRally ? [RALLY_BIN, ...parts.slice(1)] : parts.slice(1);

  // Resolve node script paths starting with ./ relative to the spec's directory
  if (parts[0] === 'node' && args[0] && args[0].startsWith('./') && opts.specDir) {
    args[0] = join(opts.specDir, args[0]);
  }

  try {
    return execFileSync(execFile, args, execOpts);
  } catch (err) {
    const output = (err.stdout || '') + (err.stderr || '');
    err.output = output;
    throw err;
  }
}

/**
 * Execute a rally command in a PTY with scripted interactive input.
 * @param {string} command - full command string (e.g., "rally onboard .")
 * @param {string} rallyHome - RALLY_HOME path
 * @param {string} cwd - working directory
 * @param {Array<{match: string, input: string, raw: boolean}>} steps - prompt match/response pairs
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
    FORCE_COLOR: '0',
    GIT_TERMINAL_PROMPT: '0',
    GH_PROMPT_DISABLED: '1',
    GH_CONFIG_DIR,
  };
  if (opts.xdgConfigHome) {
    env.XDG_CONFIG_HOME = opts.xdgConfigHome;
    if (process.platform === 'win32') {
      env.APPDATA = opts.xdgConfigHome;
      env.LOCALAPPDATA = opts.xdgConfigHome;
    }
  }

  return new Promise((resolve, reject) => {
    let output = '';
    let stepIndex = 0;
    let searchCursorRaw = 0;
    let searchCursorStripped = 0;
    let pendingInput = false;
    let ptyProcess;

    // Strip ANSI escape sequences for clean text matching
    const stripAnsi = (s) => s
      .replace(/\x1b\[[?]?[0-9;]*[a-zA-Z]/g, '')
      .replace(/\x1b\][^\x07]*\x07/g, '');

    const timeoutMs = opts.timeout || DEFAULT_TIMEOUT;
    const timeout = setTimeout(() => {
      if (ptyProcess) ptyProcess.kill();
      const waitingMsg = stepIndex >= steps.length
        ? 'Waiting for process to exit (all steps matched)'
        : `Waiting for step ${stepIndex}: match "${steps[stepIndex]?.match}"`;
      reject(new Error(
        `PTY command timed out after ${timeoutMs}ms.\n` +
        `${waitingMsg}\n` +
        `Output so far:\n${output}`
      ));
    }, timeoutMs);

    const tryAdvanceStep = () => {
      if (pendingInput || stepIndex >= steps.length) {
        return;
      }

      const step = steps[stepIndex];
      const resolvedInput = step.input
        .replace(/\{enter\}/gi, '\r')
        .replace(/\{up\}/gi, '\x1b[A')
        .replace(/\{down\}/gi, '\x1b[B')
        .replace(/\{space\}/gi, ' ')
        .replace(/\{backspace\}/gi, '\x7f');

      let matchPos = -1;
      if (step.raw) {
        matchPos = output.indexOf(step.match, searchCursorRaw);
        if (matchPos !== -1) {
          searchCursorRaw = matchPos + step.match.length;
        }
      } else {
        // Strip ANSI from full output at match time to avoid split-sequence bugs
        const stripped = stripAnsi(output);
        matchPos = stripped.indexOf(step.match, searchCursorStripped);
        if (matchPos !== -1) {
          searchCursorStripped = matchPos + step.match.length;
        }
      }

      if (matchPos !== -1) {
        pendingInput = true;
        setTimeout(() => {
          ptyProcess.write(resolvedInput);
          stepIndex++;
          pendingInput = false;
          tryAdvanceStep();
        }, 200);
      }
    };

    ptyProcess = pty.spawn(process.execPath, args, {
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

      tryAdvanceStep();
    });

    ptyProcess.onExit(({ exitCode }) => {
      clearTimeout(timeout);
      const clean = stripAnsi(output);
      resolve({ output: clean, exitCode });
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
  const mdFiles = filterSpecFiles(findMdFiles(CLI_DIR), {
    includePattern: process.env.RALLY_E2E_FILE_PATTERN,
    excludePattern: process.env.RALLY_E2E_FILE_EXCLUDE,
  });

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

          // Setup repo first (clone if needed) so setup scripts can access it
          try {
            repoSetup = setupRepo(frontmatter);
          } catch (err) {
            rmSync(rallyHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
            rmSync(xdgConfigHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
            throw err;
          }

          // Run setup command after repo is available
          if (frontmatter && frontmatter.setup) {
            const mdDir = join(CLI_DIR, file, '..');
            const setupScript = join(mdDir, frontmatter.setup);
            try {
              const setupTimeout = frontmatter.timeout ? frontmatter.timeout * 1000 : DEFAULT_TIMEOUT;
              const setupOutput = execFileSync(process.execPath, [setupScript], {
                encoding: 'utf8',
                timeout: setupTimeout,
                env: {
                  ...process.env,
                  RALLY_HOME: rallyHome,
                  XDG_CONFIG_HOME: xdgConfigHome,
                  ...(process.platform === 'win32' ? { APPDATA: xdgConfigHome, LOCALAPPDATA: xdgConfigHome } : {}),
                  NO_COLOR: '1',
                  FORCE_COLOR: '0',
                },
              });
              if (VERBOSE) {
                console.error(`Setup (${frontmatter.setup}): ${setupOutput.trim()}`);
              }
            } catch (err) {
              // Cleanup both repo and temp dirs on setup failure
              if (repoSetup && repoSetup.cleanup) repoSetup.cleanup();
              rmSync(rallyHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
              rmSync(xdgConfigHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
              throw new Error(`Setup command failed: ${frontmatter.setup}\n${err.message}`);
            }
          }
        });

        after(() => {
          // Cleanup repo
          if (repoSetup && repoSetup.cleanup) {
            repoSetup.cleanup();
          }

          // Cleanup RALLY_HOME and XDG_CONFIG_HOME
          if (rallyHome) {
            rmSync(rallyHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
          }
          if (xdgConfigHome) {
            rmSync(xdgConfigHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
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

          const testTimeout = frontmatter && frontmatter.timeout ? frontmatter.timeout * 1000 : DEFAULT_TIMEOUT;
          it(rawCommand, { timeout: testTimeout }, async () => {
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
            const specTimeout = frontmatter && frontmatter.timeout ? frontmatter.timeout * 1000 : undefined;

            if (ptySteps) {
              // PTY execution for interactive commands
              const result = await executePtyCommand(
                command, rallyHome, repoSetup.cwd, ptySteps,
                { xdgConfigHome, timeout: specTimeout }
              );
              output = result.output;
              exitCode = result.exitCode;
            } else {
              // Standard execution
              const execOpts = { xdgConfigHome, stdinInput, specDir: join(CLI_DIR, file, '..'), timeout: specTimeout };
              try {
                output = executeCommand(command, rallyHome, repoSetup.cwd, execOpts);
              } catch (err) {
                output = err.output || '';
                exitCode = typeof err.status === 'number' ? err.status : 1;
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

