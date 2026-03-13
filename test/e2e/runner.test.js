import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareLines,
  assertExactMatch,
  assertContainsLines,
  normalizeLine,
  parseTestCases,
  parseFrontmatter,
} from './runner.js';

describe('normalizeLine', () => {
  it('trims and collapses whitespace', () => {
    assert.equal(normalizeLine('  hello   world  '), 'hello world');
  });

  it('returns empty for blank lines', () => {
    assert.equal(normalizeLine('   '), '');
  });
});

describe('prepareLines', () => {
  it('substitutes variables in expected', () => {
    const { expectedLines } = prepareLines(
      'hello world',
      '$VAR world',
      { '$VAR': 'hello' }
    );
    assert.deepEqual(expectedLines, ['hello world']);
  });

  it('normalizes backslash paths', () => {
    const { actualLines } = prepareLines(
      'path\\to\\file',
      'path/to/file'
    );
    assert.deepEqual(actualLines, ['path/to/file']);
  });

  it('filters empty lines', () => {
    const { actualLines } = prepareLines('a\n\nb\n\n', 'a\nb');
    assert.deepEqual(actualLines, ['a', 'b']);
  });

  it('unwraps terminal-wrapped lines', () => {
    // Actual has "hello" and "world" on separate lines,
    // expected has "hello world" as one line
    const { actualLines } = prepareLines('hello\nworld', 'hello world');
    assert.deepEqual(actualLines, ['hello world']);
  });

  it('does not unwrap when lines match directly', () => {
    const { actualLines } = prepareLines('hello\nworld', 'hello\nworld');
    assert.deepEqual(actualLines, ['hello', 'world']);
  });
});

describe('assertExactMatch', () => {
  it('passes on identical output', () => {
    assertExactMatch('line1\nline2', 'line1\nline2');
  });

  it('passes with variable substitution', () => {
    assertExactMatch(
      'hello /tmp/test',
      'hello $DIR',
      { '$DIR': '/tmp/test' }
    );
  });

  it('fails on line mismatch', () => {
    assert.throws(
      () => assertExactMatch('actual', 'expected'),
      /Line 1 mismatch/
    );
  });

  it('fails on extra actual lines', () => {
    assert.throws(
      () => assertExactMatch('line1\nline2\nextra', 'line1\nline2'),
      /Extra actual line/
    );
  });

  it('fails on missing expected lines', () => {
    assert.throws(
      () => assertExactMatch('line1', 'line1\nline2'),
      /Missing expected line/
    );
  });

  it('ignores empty lines', () => {
    assertExactMatch('line1\n\nline2', 'line1\nline2');
  });

  it('normalizes whitespace', () => {
    assertExactMatch('  hello   world  ', 'hello world');
  });
});

describe('assertContainsLines', () => {
  it('passes when all expected lines found in order', () => {
    assertContainsLines(
      'noise\nline1\nmore noise\nline2',
      'line1\nline2'
    );
  });

  it('fails when expected line not found', () => {
    assert.throws(
      () => assertContainsLines('line1\nline3', 'line1\nline2'),
      /Expected line 2 not found/
    );
  });

  it('fails on trailing actual lines after last match', () => {
    assert.throws(
      () => assertContainsLines('noise\nline1\ntrailing', 'line1'),
      /unmatched trailing line/
    );
  });

  it('passes when last expected line is last actual line', () => {
    assertContainsLines('noise\nline1\nline2', 'line1\nline2');
  });

  it('supports variable substitution', () => {
    assertContainsLines(
      'noise\nhello world',
      'hello $NAME',
      { '$NAME': 'world' }
    );
  });

  it('requires order — out of order fails', () => {
    assert.throws(
      () => assertContainsLines('line2\nline1', 'line1\nline2'),
      /Expected line 2 not found/
    );
  });
});

describe('parseFrontmatter', () => {
  it('parses yaml frontmatter', () => {
    const { frontmatter, body } = parseFrontmatter('---\nrepo: local\n---\n# Title');
    assert.equal(frontmatter.repo, 'local');
    assert.equal(body.trim(), '# Title');
  });

  it('returns null frontmatter when none present', () => {
    const { frontmatter, body } = parseFrontmatter('# Title\nContent');
    assert.equal(frontmatter, null);
    assert.ok(body.includes('# Title'));
  });
});

describe('parseTestCases', () => {
  it('parses command with expected block', () => {
    const cases = parseTestCases('## `rally --help`\n\n```expected\nUsage: rally\n```');
    assert.equal(cases.length, 1);
    assert.equal(cases[0].command, 'rally --help');
    assert.equal(cases[0].expected, 'Usage: rally');
    assert.equal(cases[0].expectedExitCode, 0);
  });

  it('parses exit code', () => {
    const cases = parseTestCases('## `rally bad` (exit 1)\n\n```expected\nerror\n```');
    assert.equal(cases[0].expectedExitCode, 1);
  });

  it('parses smoke test (no expected)', () => {
    const cases = parseTestCases('## `rally status`\n\nJust runs.\n');
    assert.equal(cases[0].expected, null);
  });

  it('parses stdin block', () => {
    const cases = parseTestCases('## `rally cmd`\n\n```stdin\ny\n```\n');
    assert.equal(cases[0].stdinInput, 'y\n');
  });

  it('parses pty block', () => {
    const cases = parseTestCases(
      '## `rally onboard .`\n\n```pty\nmatch: Create?\nsend: y\n```\n```expected\ndone\n```'
    );
    assert.equal(cases[0].ptySteps.length, 1);
    assert.equal(cases[0].ptySteps[0].match, 'Create?');
    assert.equal(cases[0].ptySteps[0].input, 'y');
    assert.equal(cases[0].expected, 'done');
  });

  it('parses multiple test cases', () => {
    const md = '## `rally a`\n\n```expected\nout1\n```\n\n## `rally b`\n\nSmoke.\n';
    const cases = parseTestCases(md);
    assert.equal(cases.length, 2);
    assert.equal(cases[0].command, 'rally a');
    assert.equal(cases[1].command, 'rally b');
    assert.equal(cases[1].expected, null);
  });
});
