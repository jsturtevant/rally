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
  it('throws RallyError with the given exit code', () => {
    assert.throws(
      () => fatal('boom', 3),
      (err) => err instanceof RallyError && err.exitCode === 3 && err.message === 'boom'
    );
  });

  it('defaults to exit code 1', () => {
    assert.throws(
      () => fatal('boom'),
      (err) => err instanceof RallyError && err.exitCode === 1
    );
  });

  it('creates error with message', () => {
    try {
      fatal('something broke', 1);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof RallyError);
      assert.equal(err.message, 'something broke');
      assert.equal(err.exitCode, 1);
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
  it('throws RallyError if given RallyError', () => {
    const err = new RallyError('git fail', EXIT_GIT);
    assert.throws(
      () => handleError(err),
      (thrown) => thrown === err && thrown.exitCode === EXIT_GIT
    );
  });

  it('wraps generic Error in RallyError with EXIT_GENERAL', () => {
    const err = new Error('unknown');
    assert.throws(
      () => handleError(err),
      (thrown) => thrown instanceof RallyError && 
                  thrown.exitCode === EXIT_GENERAL && 
                  thrown.message === 'unknown'
    );
  });
});
