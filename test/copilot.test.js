import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkCopilotAvailable, checkDockerSandboxAvailable, launchCopilot, DENY_TOOLS, getReadOnlyPolicy } from '../lib/copilot.js';

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
// checkDockerSandboxAvailable
// =====================================================

describe('checkDockerSandboxAvailable', () => {
  test('returns true when docker sandbox is installed', () => {
    const exec = () => 'docker sandbox help output';
    assert.strictEqual(checkDockerSandboxAvailable({ _exec: exec }), true);
  });

  test('returns false when docker sandbox is not installed', () => {
    const exec = () => { throw new Error('unknown command "sandbox"'); };
    assert.strictEqual(checkDockerSandboxAvailable({ _exec: exec }), false);
  });

  test('returns false when docker is not installed', () => {
    const exec = () => {
      throw Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' });
    };
    assert.strictEqual(checkDockerSandboxAvailable({ _exec: exec }), false);
  });

  test('passes correct args to exec', () => {
    let captured;
    const exec = (cmd, args, opts) => {
      captured = { cmd, args, opts };
      return '';
    };
    checkDockerSandboxAvailable({ _exec: exec });
    assert.strictEqual(captured.cmd, 'docker');
    assert.deepStrictEqual(captured.args, ['sandbox', '--help']);
    assert.strictEqual(captured.opts.stdio, 'pipe');
  });
});

// =====================================================
// launchCopilot
// =====================================================

describe('launchCopilot', () => {
  test('spawns gh copilot with deny-tool flags and policy in prompt', () => {
    let captured;
    const mockSpawn = (cmd, args, opts) => {
      captured = { cmd, args, opts };
      return { pid: 42, unref() {} };
    };

    launchCopilot('/path/to/worktree', 'my prompt', { _spawn: mockSpawn });

    assert.strictEqual(captured.cmd, 'gh');
    // Verify --allow-all-tools is present
    assert.ok(captured.args.includes('--allow-all-tools'));
    // Verify all deny-tool flags are present
    for (const tool of DENY_TOOLS) {
      const idx = captured.args.indexOf(tool);
      assert.ok(idx > 0, `deny-tool ${tool} should be in args`);
      assert.strictEqual(captured.args[idx - 1], '--deny-tool');
    }
    // Verify -p flag with read-only policy in prompt
    const pIdx = captured.args.indexOf('-p');
    assert.ok(pIdx >= 0, '-p flag should be present');
    const prompt = captured.args[pIdx + 1];
    assert.ok(prompt.startsWith('workspace '), 'prompt should start with "workspace "');
    assert.ok(prompt.includes('Read-Only Policy'), 'prompt should include read-only policy');
    assert.ok(prompt.includes('my prompt'), 'prompt should include user prompt');
    assert.strictEqual(captured.opts.cwd, '/path/to/worktree');
    assert.strictEqual(captured.opts.detached, true);
  });

  test('sandbox mode uses docker sandbox run with deny-tool flags and policy', () => {
    let captured;
    const mockSpawn = (cmd, args, opts) => {
      captured = { cmd, args, opts };
      return { pid: 55, unref() {} };
    };

    launchCopilot('/path/to/worktree', 'fix the bug', { _spawn: mockSpawn, sandbox: true });

    assert.strictEqual(captured.cmd, 'docker');
    // First four args: sandbox run copilot <workspace>
    assert.deepStrictEqual(captured.args.slice(0, 4), [
      'sandbox', 'run', 'copilot', '/path/to/worktree',
    ]);
    // -- separator
    assert.strictEqual(captured.args[4], '--');
    const agentArgs = captured.args.slice(5);
    // Agent args must include --allow-all-tools
    assert.ok(agentArgs.includes('--allow-all-tools'));
    // Agent args must include deny-tool flags
    for (const tool of DENY_TOOLS) {
      const idx = agentArgs.indexOf(tool);
      assert.ok(idx > 0, `deny-tool ${tool} should be in agent args`);
      assert.strictEqual(agentArgs[idx - 1], '--deny-tool');
    }
    // Agent args must include -p with policy and user prompt
    const pIdx = agentArgs.indexOf('-p');
    assert.ok(pIdx >= 0, '-p flag should be in agent args');
    const prompt = agentArgs[pIdx + 1];
    assert.ok(prompt.startsWith('workspace '), 'prompt should start with "workspace "');
    assert.ok(prompt.includes('Read-Only Policy'), 'prompt should include read-only policy');
    assert.ok(prompt.includes('fix the bug'), 'prompt should include user prompt');
    assert.strictEqual(captured.opts.cwd, '/path/to/worktree');
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

  test('sandbox mode returns nulls when docker is not installed (ENOENT)', () => {
    const mockSpawn = () => {
      throw Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' });
    };
    const result = launchCopilot('/wt', 'prompt', { _spawn: mockSpawn, sandbox: true });
    assert.strictEqual(result.sessionId, null);
    assert.strictEqual(result.process, null);
    assert.strictEqual(result.logPath, null);
  });
});

// =====================================================
// DENY_TOOLS constant
// =====================================================

describe('DENY_TOOLS', () => {
  test('is a non-empty array of strings', () => {
    assert.ok(Array.isArray(DENY_TOOLS));
    assert.ok(DENY_TOOLS.length > 0);
    for (const t of DENY_TOOLS) {
      assert.strictEqual(typeof t, 'string');
    }
  });

  test('blocks git push', () => {
    assert.ok(DENY_TOOLS.includes('shell(git push)'));
  });

  test('blocks gh pr commands', () => {
    assert.ok(DENY_TOOLS.includes('shell(gh pr)'));
  });

  test('blocks github-mcp-server', () => {
    assert.ok(DENY_TOOLS.includes('github-mcp-server'));
  });
});

// =====================================================
// getReadOnlyPolicy
// =====================================================

describe('getReadOnlyPolicy', () => {
  test('returns a non-empty string with policy header', () => {
    const policy = getReadOnlyPolicy();
    assert.ok(typeof policy === 'string');
    assert.ok(policy.includes('Read-Only Policy'));
  });

  test('prohibits git push', () => {
    assert.ok(getReadOnlyPolicy().includes('git push'));
  });

  test('allows local code changes', () => {
    assert.ok(getReadOnlyPolicy().includes('local code changes'));
  });
});
