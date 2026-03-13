import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';

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

      // Skip prose until we find ```expected or another heading
      let expected = null;
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
          break;
        }

        i++;
      }

      testCases.push({ command, expected, expectedExitCode });
    } else {
      i++;
    }
  }

  return testCases;
}

/**
 * Normalize a line for fuzzy matching
 * @param {string} line
 * @returns {string}
 */
function normalizeLine(line) {
  return line.trim().replace(/\s+/g, ' ');
}

/**
 * Fuzzy match actual output against expected, returning per-line results.
 *
 * Uses a two-pointer scan: walks through actual lines to find each expected
 * line in order using equality after normalization (trim + collapse whitespace).
 * Handles terminal line wrapping by joining 2–3 consecutive actual lines.
 * Extra actual lines (preamble, decorations) are skipped automatically.
 *
 * @param {string} actual
 * @param {string} expected
 * @param {object} vars - variable substitutions
 * @returns {{ results: Array<{ line: string, found: boolean, context: string }>, actualLines: string[] }}
 */
function fuzzyMatch(actual, expected, vars = {}) {
  // Apply variable substitutions to expected
  let processedExpected = expected;
  for (const [key, value] of Object.entries(vars)) {
    processedExpected = processedExpected.replaceAll(key, value);
  }

  // Normalize path separators for cross-platform comparison
  // Normalize path separators: replace escaped backslashes (\\) and single backslashes (\) with forward slashes
  const normalizePaths = (str) => str.replace(/\\\\/g, '/').replace(/\\/g, '/');
  processedExpected = normalizePaths(processedExpected);
  actual = normalizePaths(actual);

  const actualLines = actual
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(line => line.length > 0);

  const expectedLines = processedExpected
    .split('\n')
    .map(normalizeLine)
    .filter(line => line.length > 0);

  const results = [];
  let a = 0; // actual line pointer

  for (const expectedLine of expectedLines) {
    let found = false;
    const searchStart = a;

    while (a < actualLines.length) {
      // Direct line equality
      if (actualLines[a] === expectedLine) {
        results.push({ line: expectedLine, found: true, context: '' });
        a++;
        found = true;
        break;
      }

      // Try joining consecutive actual lines to handle terminal wrapping
      for (let n = 2; n <= 3 && a + n - 1 < actualLines.length; n++) {
        const segment = actualLines.slice(a, a + n);
        if (segment.join(' ') === expectedLine || segment.join('') === expectedLine) {
          results.push({ line: expectedLine, found: true, context: '' });
          a += n;
          found = true;
          break;
        }
      }

      if (found) break;

      // This actual line doesn't match — skip it (preamble/extra output)
      a++;
    }

    if (!found) {
      // Show nearby actual lines for context
      const contextStart = Math.max(0, searchStart);
      const contextEnd = Math.min(actualLines.length, searchStart + 5);
      const context = actualLines.slice(contextStart, contextEnd).join(' | ');
      results.push({ line: expectedLine, found: false, context });
    }
  }

  return { results, actualLines };
}

/**
 * Assert fuzzy match — throws on first missing line.
 *
 * @param {string} actual
 * @param {string} expected
 * @param {object} vars - variable substitutions
 */
function assertFuzzyMatch(actual, expected, vars = {}) {
  const { results } = fuzzyMatch(actual, expected, vars);
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (!r.found) {
      assert.fail(
        `Expected line ${i + 1} not found in actual output:\n` +
        `  expected: "${r.line}"\n` +
        `  near:     "${r.context}..."`
      );
    }
  }
}

/**
 * Format a compact diff between expected and actual output.
 * Shows each expected line with ✓ (found) or ✗ (missing), plus context for misses.
 *
 * @param {string} actual
 * @param {string} expected
 * @param {object} vars - variable substitutions
 * @returns {string}
 */
function formatDiff(actual, expected, vars = {}) {
  const { results } = fuzzyMatch(actual, expected, vars);
  const lines = [];

  for (const r of results) {
    if (r.found) {
      lines.push(`  ✓ ${r.line}`);
    } else {
      lines.push(`  ✗ ${r.line}`);
      lines.push(`    actual near: "${r.context}..."`);
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
 * @returns {string} - stdout
 */
function executeCommand(command, rallyHome, cwd) {
  // Extract args after "rally"
  const parts = command.trim().split(/\s+/);
  if (parts[0] !== 'rally') {
    throw new Error(`Command must start with "rally", got: ${command}`);
  }

  const args = parts.slice(1);

  try {
    return execFileSync(process.execPath, [RALLY_BIN, ...args], {
      encoding: 'utf8',
      cwd,
      timeout: DEFAULT_TIMEOUT,
      env: {
        ...process.env,
        RALLY_HOME: rallyHome,
        NO_COLOR: '1',
        FORCE_COLOR: undefined,
        GIT_TERMINAL_PROMPT: '0',
      },
    });
  } catch (err) {
    // If the command is expected to fail (exit non-zero), capture the output
    const output = (err.stdout || '') + (err.stderr || '');
    // Re-throw with output attached so tests can still match against it
    err.output = output;
    throw err;
  }
}

// Discover and run tests
if (!existsSync(CLI_DIR)) {
  console.log('No test/e2e/cli/ directory found — skipping markdown tests');
  // Directory doesn't exist yet - no tests to run
  describe('markdown-driven E2E tests', () => {
    it('no .md files found', () => {
      assert.ok(true, 'test/e2e/cli/ directory does not exist yet');
    });
  });
} else {
  const mdFiles = readdirSync(CLI_DIR).filter(f => f.endsWith('.md'));

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

        before(() => {
          // Create temp RALLY_HOME
          rallyHome = mkdtempSync(join(tmpdir(), 'rally-test-home-'));

          // Setup repo if needed
          try {
            repoSetup = setupRepo(frontmatter);
          } catch (err) {
            rmSync(rallyHome, { recursive: true, force: true });
            throw err;
          }
        });

        after(() => {
          // Cleanup repo
          if (repoSetup && repoSetup.cleanup) {
            repoSetup.cleanup();
          }

          // Cleanup RALLY_HOME
          if (rallyHome) {
            rmSync(rallyHome, { recursive: true, force: true });
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
          const { command, expected, expectedExitCode } = testCase;

          it(command, () => {
            let output;

            if (expected === null) {
              // Smoke test - no expected output block
              let exitCode = 0;
              try {
                output = executeCommand(command, rallyHome, repoSetup.cwd);
              } catch (err) {
                output = err.output || '';
                exitCode = err.status || err.code || 1;
              }
              if (VERBOSE) {
                console.log(`\n── ${command} ──`);
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
              // Match against expected output
              let exitCode = 0;
              try {
                output = executeCommand(command, rallyHome, repoSetup.cwd);
              } catch (err) {
                // Command exited non-zero - capture output and exit code
                output = err.output || '';
                exitCode = err.status || err.code || 1;
                // Don't throw yet - let fuzzy match run against the output
              }

              // Variable substitutions
              const vars = {
                '$RALLY_HOME': rallyHome,
                '$REPO_ROOT': repoSetup.cwd,
              };

              if (VERBOSE) {
                console.log(`\n── ${command} ──`);
                if (exitCode !== 0) {
                  console.log(`⚠️  Command exited with code ${exitCode}`);
                }
                console.log(`ACTUAL:\n${output}`);
                console.log(`DIFF (expected vs actual):`);
                console.log(formatDiff(output, expected, vars));
              }

              try {
                assertFuzzyMatch(output, expected, vars);
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
                  console.log(`MISMATCH ✗\n${err.message}`);
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
