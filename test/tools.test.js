import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkTools, assertTools } from '../lib/tools.js';
import { RallyError, EXIT_CONFIG } from '../lib/errors.js';

// Fake exec that succeeds for every tool
function execAllPass() {}

// Fake exec that throws for every tool
function execAllFail() {
  throw new Error('not found');
}

// Factory: fake exec that fails only for the given tool names
function execFailFor(...names) {
  return (tool) => {
    if (names.includes(tool)) throw new Error('not found');
  };
}

describe('checkTools', () => {
  it('returns empty array when all tools are present', () => {
    const missing = checkTools({ _exec: execAllPass });
    assert.deepEqual(missing, []);
  });

  it('returns all three tools when none are present', () => {
    const missing = checkTools({ _exec: execAllFail });
    assert.deepEqual(missing, ['git', 'gh', 'npx']);
  });

  it('returns only missing tools when some are absent', () => {
    const missing = checkTools({ _exec: execFailFor('gh') });
    assert.deepEqual(missing, ['gh']);
  });

  it('detects multiple missing tools', () => {
    const missing = checkTools({ _exec: execFailFor('git', 'npx') });
    assert.deepEqual(missing, ['git', 'npx']);
  });

  it('calls exec with --version and stdio pipe', () => {
    const calls = [];
    const spy = (tool, args, opts) => {
      calls.push({ tool, args, opts });
    };
    checkTools({ _exec: spy });
    assert.equal(calls.length, 3);
    for (const call of calls) {
      assert.deepEqual(call.args, ['--version']);
      assert.deepEqual(call.opts, { stdio: 'pipe' });
    }
    assert.deepEqual(calls.map((c) => c.tool), ['git', 'gh', 'npx']);
  });

  it('works with default opts (no arguments)', () => {
    // Just verify it doesn't throw when called with no args;
    // actual result depends on system, so we only check the return type
    const result = checkTools();
    assert.ok(Array.isArray(result));
  });
});

describe('assertTools', () => {
  it('does not throw when all tools are present', () => {
    assert.doesNotThrow(() => assertTools({ _exec: execAllPass }));
  });

  it('throws RallyError when tools are missing', () => {
    assert.throws(
      () => assertTools({ _exec: execAllFail }),
      (err) => {
        assert.ok(err instanceof RallyError);
        return true;
      }
    );
  });

  it('thrown error has EXIT_CONFIG exit code', () => {
    try {
      assertTools({ _exec: execAllFail });
      assert.fail('should have thrown');
    } catch (err) {
      assert.equal(err.exitCode, EXIT_CONFIG);
    }
  });

  it('error message lists all missing tools', () => {
    try {
      assertTools({ _exec: execAllFail });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('git'));
      assert.ok(err.message.includes('gh'));
      assert.ok(err.message.includes('npx'));
      assert.ok(err.message.includes('Missing required tools'));
    }
  });

  it('error message lists only the missing tool', () => {
    try {
      assertTools({ _exec: execFailFor('npx') });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('npx'));
      assert.ok(!err.message.includes('git, '));
    }
  });
});
