import assert from 'node:assert/strict';
import yaml from 'js-yaml';

function normalizeTag(tag, sourceName) {
  if (typeof tag !== 'string') {
    throw new Error(`${sourceName} tags must be an array of strings`);
  }

  const normalized = tag.trim().toLowerCase();
  if (!normalized) {
    throw new Error(`${sourceName} tags must not contain empty values`);
  }

  return normalized;
}

function normalizeSpecTags(tags, sourceName = 'Spec', { allowMissing = true } = {}) {
  if (tags == null) {
    if (allowMissing) {
      return [];
    }
    throw new Error(`${sourceName} tags must be an array of strings`);
  }

  if (!Array.isArray(tags)) {
    throw new Error(`${sourceName} tags must be an array of strings`);
  }

  return [...new Set(tags.map((tag) => normalizeTag(tag, sourceName)))];
}

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

  const parsedFrontmatter = yaml.load(match[1], { schema: yaml.CORE_SCHEMA });
  const body = content.slice(match[0].length);

  if (parsedFrontmatter !== null && (typeof parsedFrontmatter !== 'object' || Array.isArray(parsedFrontmatter))) {
    throw new Error(`Frontmatter must be a YAML object (got ${typeof parsedFrontmatter}${Array.isArray(parsedFrontmatter) ? ' array' : ''})`);
  }

  const frontmatter = parsedFrontmatter ? { ...parsedFrontmatter } : null;
  if (frontmatter) {
    frontmatter.tags = Object.prototype.hasOwnProperty.call(frontmatter, 'tags')
      ? normalizeSpecTags(frontmatter.tags, 'Frontmatter', { allowMissing: false })
      : [];
  }

  return { frontmatter, body };
}

/**
 * Parse test cases from markdown body
 * @param {string} body - markdown content after frontmatter
 * @returns {Array<{ command: string, expected: string | null, expectedExitCode: number, stdinInput: string | null, ptySteps: Array<{ match: string, input: string, raw: boolean }> | null }>}
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
          let currentRaw = false;
          let currentDirective = null;
          while (i < lines.length && !lines[i].match(/^```\s*$/)) {
            const ptyLine = lines[i].trim();
            if (ptyLine.startsWith('match-raw:')) {
              currentMatch = ptyLine
                .slice(10)
                .trim()
                .replace(/\{hide-cursor\}/gi, '\x1b[?25l')
                .replace(/\{show-cursor\}/gi, '\x1b[?25h')
                .replace(/\{clear-screen\}/gi, '\x1b[2J')
                .replace(/\{alt-screen\}/gi, '\x1b[?1049h')
                .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
              currentRaw = true;
              currentDirective = 'match-raw';
            } else if (ptyLine.startsWith('match:')) {
              currentMatch = ptyLine.slice(6).trim();
              currentRaw = false;
              currentDirective = 'match';
            } else if (ptyLine.startsWith('send:')) {
              if (currentMatch === null) {
                throw new Error(`PTY parse error: "send:" without preceding "match:" or "match-raw:" at line: ${ptyLine}`);
              }
              const rawInput = ptyLine.slice(5).trim();
              ptySteps.push({ match: currentMatch, input: rawInput, raw: currentRaw });
              currentMatch = null;
              currentRaw = false;
              currentDirective = null;
            } else if (ptyLine === '' && currentMatch === null) {
              // blank line between steps — ignore
            }
            i++;
          }
          if (currentMatch !== null) {
            throw new Error(`PTY parse error: trailing "${currentDirective}: ${currentMatch}" without a following "send:" line`);
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

function compilePattern(pattern, envName) {
  if (!pattern) {
    return null;
  }

  try {
    return new RegExp(pattern);
  } catch (error) {
    throw new Error(`Invalid ${envName} regex: ${error.message}`);
  }
}

function parseFilterTags(rawTags) {
  if (!rawTags) {
    return [];
  }

  return [...new Set(rawTags
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean))];
}

function getSpecFile(spec) {
  if (typeof spec === 'string') {
    return spec;
  }

  if (spec && typeof spec.file === 'string') {
    return spec.file;
  }

  throw new Error('Spec entries must be file paths or objects with a string "file" property');
}

function getSpecTags(spec) {
  if (typeof spec === 'string' || spec == null) {
    return [];
  }

  return normalizeSpecTags(spec.tags, 'Spec');
}

function filterSpecFiles(files, options = {}) {
  const includePattern = compilePattern(options.includePattern, 'RALLY_E2E_FILE_PATTERN');
  const excludePattern = compilePattern(options.excludePattern, 'RALLY_E2E_FILE_EXCLUDE');
  const includeTags = parseFilterTags(options.includeTags);
  const excludeTags = parseFilterTags(options.excludeTags);

  return files.filter((spec) => {
    const file = getSpecFile(spec);
    const normalized = file.replace(/\\/g, '/');

    if (includePattern && !includePattern.test(normalized)) {
      return false;
    }
    if (excludePattern && excludePattern.test(normalized)) {
      return false;
    }

    const specTags = new Set(getSpecTags(spec));
    if (includeTags.length > 0 && includeTags.some((tag) => !specTags.has(tag))) {
      return false;
    }
    if (excludeTags.length > 0 && excludeTags.some((tag) => specTags.has(tag))) {
      return false;
    }

    return true;
  });
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

export {
  parseFrontmatter,
  parseTestCases,
  prepareLines,
  normalizeLine,
  filterSpecFiles,
  assertExactMatch,
  assertContainsLines,
  formatDiff,
};
