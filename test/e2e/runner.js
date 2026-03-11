import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';

const RALLY_BIN = join(import.meta.dirname, '..', '..', 'bin', 'rally.js');
const CLI_DIR = join(import.meta.dirname, 'cli');
const VERBOSE = !!process.env.VERBOSE;

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
  return { frontmatter, body };
}

/**
 * Parse test cases from markdown body
 * @param {string} body - markdown content after frontmatter
 * @returns {Array<{ command: string, expected: string | null }>}
 */
function parseTestCases(body) {
  const testCases = [];
  const lines = body.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Look for heading: ## `command`
    const headingMatch = line.match(/^##\s+`([^`]+)`/);
    if (headingMatch) {
      const command = headingMatch[1];
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

      testCases.push({ command, expected });
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
 * Joins all actual output into a single normalized string, then checks that
 * each expected line appears as a substring in order. This handles terminal
 * line wrapping and extra preamble lines in actual output.
 *
 * @param {string} actual
 * @param {string} expected
 * @param {object} vars - variable substitutions
 * @returns {{ results: Array<{ line: string, found: boolean, context: string }>, actualFlat: string }}
 */
function fuzzyMatch(actual, expected, vars = {}) {
  // Apply variable substitutions to expected
  let processedExpected = expected;
  for (const [key, value] of Object.entries(vars)) {
    processedExpected = processedExpected.replaceAll(key, value);
  }

  // Collapse actual output into one normalized string (handles line wrapping)
  const actualFlat = actual.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

  const expectedLines = processedExpected
    .split('\n')
    .map(normalizeLine)
    .filter(line => line.length > 0);

  const results = [];
  let searchFrom = 0;

  for (const expectedLine of expectedLines) {
    const idx = actualFlat.indexOf(expectedLine, searchFrom);
    if (idx === -1) {
      // Show nearby actual content for context
      const nearby = actualFlat.slice(Math.max(0, searchFrom - 20), searchFrom + 80);
      results.push({ line: expectedLine, found: false, context: nearby });
    } else {
      searchFrom = idx + expectedLine.length;
      results.push({ line: expectedLine, found: true, context: '' });
    }
  }

  return { results, actualFlat };
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
 * @param {string} rallyHome - temp RALLY_HOME directory
 * @param {object} frontmatter - parsed frontmatter
 * @returns {{ cwd: string, cleanup: Function }}
 */
function setupRepo(rallyHome, frontmatter) {
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

  // Clone repo into temp directory
  const repoDir = mkdtempSync(join(tmpdir(), 'rally-test-repo-'));

  try {
    execFileSync('gh', ['repo', 'clone', ownerRepo, repoDir], {
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        NO_COLOR: '1',
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
    return execFileSync('node', [RALLY_BIN, ...args], {
      encoding: 'utf8',
      cwd,
      env: {
        ...process.env,
        RALLY_HOME: rallyHome,
        NO_COLOR: '1',
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
  console.log('No test/e2e/cli/ directory found, creating it...');
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
        assert.ok(true, 'no .md test files in test/e2e/cli/');
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
          repoSetup = setupRepo(rallyHome, frontmatter);
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

        // Execute tests sequentially
        for (const testCase of testCases) {
          const { command, expected } = testCase;

          it(command, () => {
            let output;

            if (expected === null) {
              // Smoke test - command should exit 0
              output = executeCommand(command, rallyHome, repoSetup.cwd);
              if (VERBOSE) {
                console.log(`\n── ${command} ──`);
                console.log(`ACTUAL:\n${output}`);
                console.log('(no expected block — smoke test)');
                console.log('MATCH ✓');
              }
              assert.ok(output !== undefined, 'command should succeed');
            } else {
              // Match against expected output
              output = executeCommand(command, rallyHome, repoSetup.cwd);

              // Variable substitutions
              const vars = {
                '$RALLY_HOME': rallyHome,
                '$REPO_ROOT': repoSetup.cwd,
              };

              if (VERBOSE) {
                console.log(`\n── ${command} ──`);
                console.log(`ACTUAL:\n${output}`);
                console.log(`DIFF (expected vs actual):`);
                console.log(formatDiff(output, expected, vars));
              }

              try {
                assertFuzzyMatch(output, expected, vars);
                if (VERBOSE) console.log('MATCH ✓');
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
