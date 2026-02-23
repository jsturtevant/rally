import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXIT_SUCCESS,
  EXIT_GENERAL,
  EXIT_CONFIG,
  EXIT_GIT,
  EXIT_GITHUB,
  RallyError,
  fatal,
  handleError,
} from '../lib/errors.js';

function makeFakes() {
  const logs = [];
  const exits = [];
  return {
    _console: { error: (msg) => logs.push(msg) },
    _process: { exit: (code) => exits.push(code) },
    logs,
    exits,
  };
}

describe('exit code constants', () => {
  it('EXIT_SUCCESS is 0', () => assert.equal(EXIT_SUCCESS, 0));
  it('EXIT_GENERAL is 1', () => assert.equal(EXIT_GENERAL, 1));
  it('EXIT_CONFIG is 2', () => assert.equal(EXIT_CONFIG, 2));
  it('EXIT_GIT is 3', () => assert.equal(EXIT_GIT, 3));
  it('EXIT_GITHUB is 4', () => assert.equal(EXIT_GITHUB, 4));
});

describe('fatal()', () => {
  it('calls process.exit with the given code', () => {
    const f = makeFakes();
    fatal('boom', 3, f);
    assert.deepEqual(f.exits, [3]);
  });

  it('defaults to exit code 1', () => {
    const f = makeFakes();
    fatal('boom', undefined, f);
    assert.deepEqual(f.exits, [1]);
  });

  it('logs message to stderr', () => {
    const f = makeFakes();
    fatal('something broke', 1, f);
    assert.deepEqual(f.logs, ['Error: something broke']);
  });

  it('does not log stack traces', () => {
    const f = makeFakes();
    fatal('oops', 1, f);
    for (const line of f.logs) {
      assert.ok(!line.includes('at '), 'should not contain stack trace');
      assert.ok(!line.includes('Error\n'), 'should not contain raw Error');
    }
  });
});

describe('RallyError', () => {
  it('stores exit code', () => {
    const err = new RallyError('bad config', EXIT_CONFIG);
    assert.equal(err.exitCode, EXIT_CONFIG);
    assert.equal(err.message, 'bad config');
  });

  it('defaults exit code to EXIT_GENERAL', () => {
    const err = new RallyError('generic');
    assert.equal(err.exitCode, EXIT_GENERAL);
  });

  it('is an instance of Error', () => {
    const err = new RallyError('test');
    assert.ok(err instanceof Error);
  });
});

describe('handleError()', () => {
  it('maps RallyError to its exitCode', () => {
    const f = makeFakes();
    handleError(new RallyError('git fail', EXIT_GIT), f);
    assert.deepEqual(f.exits, [EXIT_GIT]);
    assert.deepEqual(f.logs, ['Error: git fail']);
  });

  it('maps generic Error to EXIT_GENERAL', () => {
    const f = makeFakes();
    handleError(new Error('unknown'), f);
    assert.deepEqual(f.exits, [EXIT_GENERAL]);
    assert.deepEqual(f.logs, ['Error: unknown']);
  });
});
