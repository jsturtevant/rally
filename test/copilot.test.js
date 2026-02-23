import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkCopilotAvailable, launchCopilot } from '../lib/copilot.js';

// =====================================================
// checkCopilotAvailable
// =====================================================

describe('checkCopilotAvailable', () => {
  test('returns true when gh copilot is installed', () => {
    const exec = () => 'gh copilot help output';
    assert.strictEqual(checkCopilotAvailable({ _exec: exec }), true);
  });

  test('returns false when gh copilot is not installed', () => {
    const exec = () => { throw new Error('unknown command "copilot"'); };
    assert.strictEqual(checkCopilotAvailable({ _exec: exec }), false);
  });

  test('returns false when gh is not installed', () => {
    const exec = () => {
      throw Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' });
    };
    assert.strictEqual(checkCopilotAvailable({ _exec: exec }), false);
  });

  test('passes correct args to exec', () => {
    let captured;
    const exec = (cmd, args, opts) => {
      captured = { cmd, args, opts };
      return '';
    };
    checkCopilotAvailable({ _exec: exec });
    assert.strictEqual(captured.cmd, 'gh');
    assert.deepStrictEqual(captured.args, ['copilot', '--help']);
    assert.strictEqual(captured.opts.stdio, 'pipe');
  });
});

// =====================================================
// launchCopilot
// =====================================================

describe('launchCopilot', () => {
  test('spawns gh copilot with -p flag and workspace prompt', () => {
    let captured;
    const mockSpawn = (cmd, args, opts) => {
      captured = { cmd, args, opts };
      return { pid: 42, unref() {} };
    };

    launchCopilot('/path/to/worktree', 'my prompt', { _spawn: mockSpawn });

    assert.strictEqual(captured.cmd, 'gh');
    assert.deepStrictEqual(captured.args, ['copilot', '-p', 'workspace my prompt']);
    assert.strictEqual(captured.opts.cwd, '/path/to/worktree');
    assert.strictEqual(captured.opts.stdio, 'inherit');
    assert.strictEqual(captured.opts.detached, true);
  });

  test('redirects stdout/stderr to log file when logPath is provided', () => {
    let captured;
    let openCalls = [];
    let closeCalls = [];

    const mockSpawn = (cmd, args, opts) => {
      captured = { cmd, args, opts };
      return { pid: 42, unref() {} };
    };

    const mockFs = {
      openSync: (path, flags) => {
        openCalls.push({ path, flags });
        return 99;
      },
      closeSync: (fd) => {
        closeCalls.push(fd);
      },
    };

    const result = launchCopilot('/path/to/worktree', 'my prompt', {
      _spawn: mockSpawn,
      _fs: mockFs,
      logPath: '/path/to/worktree/.copilot-output.log',
    });

    assert.strictEqual(openCalls.length, 1);
    assert.strictEqual(openCalls[0].path, '/path/to/worktree/.copilot-output.log');
    assert.strictEqual(openCalls[0].flags, 'w');
    assert.deepStrictEqual(captured.opts.stdio, ['ignore', 99, 99]);
    assert.strictEqual(closeCalls.length, 1);
    assert.strictEqual(closeCalls[0], 99);
    assert.strictEqual(result.logPath, '/path/to/worktree/.copilot-output.log');
  });

  test('returns sessionId, process, and logPath', () => {
    const mockSpawn = () => ({ pid: 98765, unref() {} });
    const result = launchCopilot('/wt', 'prompt', {
      _spawn: mockSpawn,
      logPath: '/wt/.copilot-output.log',
      _fs: {
        openSync: () => 10,
        closeSync: () => {},
      },
    });
    assert.strictEqual(result.sessionId, '98765');
    assert.ok(result.process);
    assert.strictEqual(result.logPath, '/wt/.copilot-output.log');
  });

  test('returns null sessionId when PID is falsy', () => {
    const mockSpawn = () => ({ pid: 0, unref() {} });
    const result = launchCopilot('/wt', 'prompt', { _spawn: mockSpawn });
    assert.strictEqual(result.sessionId, null);
    assert.strictEqual(result.logPath, null);
  });

  test('returns nulls when spawn throws ENOENT (code)', () => {
    const mockSpawn = () => {
      throw Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' });
    };
    const result = launchCopilot('/wt', 'prompt', { _spawn: mockSpawn });
    assert.strictEqual(result.sessionId, null);
    assert.strictEqual(result.process, null);
    assert.strictEqual(result.logPath, null);
  });

  test('returns nulls when spawn throws ENOENT (message)', () => {
    const mockSpawn = () => {
      throw new Error('spawn gh ENOENT');
    };
    const result = launchCopilot('/wt', 'prompt', { _spawn: mockSpawn });
    assert.strictEqual(result.sessionId, null);
    assert.strictEqual(result.process, null);
    assert.strictEqual(result.logPath, null);
  });

  test('re-throws non-ENOENT errors', () => {
    const mockSpawn = () => {
      throw new Error('permission denied');
    };
    assert.throws(
      () => launchCopilot('/wt', 'prompt', { _spawn: mockSpawn }),
      { message: 'permission denied' }
    );
  });

  test('calls unref on child process', () => {
    let unrefCalled = false;
    const mockSpawn = () => ({
      pid: 1,
      unref() { unrefCalled = true; },
    });
    launchCopilot('/wt', 'prompt', { _spawn: mockSpawn });
    assert.strictEqual(unrefCalled, true);
  });
});
