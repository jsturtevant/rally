import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkCopilotAvailable, checkDockerSandboxAvailable, launchCopilot, resumeCopilot, DENY_TOOLS, DEFAULT_DENY_TOOLS, getReadOnlyPolicy, parseSessionIdFromLog } from '../lib/copilot.js';

// =====================================================
// checkDockerSandboxAvailable
// =====================================================

describe('checkDockerSandboxAvailable', () => {
  test('returns true when docker sandbox --help succeeds', () => {
    const exec = () => 'docker sandbox help output';
    assert.strictEqual(checkDockerSandboxAvailable({ _exec: exec }), true);
  });

  test('returns false when docker sandbox --help fails', () => {
    const exec = () => { throw new Error('unknown command "sandbox"'); };
    assert.strictEqual(checkDockerSandboxAvailable({ _exec: exec }), false);
  });
});

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
    assert.strictEqual(result.pid, 98765);
    assert.ok(result.process);
    assert.strictEqual(result.logPath, '/wt/.copilot-output.log');
  });

  test('returns null sessionId and pid when PID is falsy', () => {
    const mockSpawn = () => ({ pid: 0, unref() {} });
    const result = launchCopilot('/wt', 'prompt', { _spawn: mockSpawn });
    assert.strictEqual(result.sessionId, null);
    assert.strictEqual(result.pid, null);
    assert.strictEqual(result.logPath, null);
  });

  test('returns nulls when spawn throws ENOENT (code)', () => {
    const mockSpawn = () => {
      throw Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' });
    };
    const result = launchCopilot('/wt', 'prompt', { _spawn: mockSpawn });
    assert.strictEqual(result.sessionId, null);
    assert.strictEqual(result.pid, null);
    assert.strictEqual(result.process, null);
    assert.strictEqual(result.logPath, null);
  });

  test('returns nulls when spawn throws ENOENT (message)', () => {
    const mockSpawn = () => {
      throw new Error('spawn gh ENOENT');
    };
    const result = launchCopilot('/wt', 'prompt', { _spawn: mockSpawn });
    assert.strictEqual(result.sessionId, null);
    assert.strictEqual(result.pid, null);
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

  test('rejects relative worktree path', () => {
    assert.throws(
      () => launchCopilot('relative/path', 'prompt', {}),
      /worktreePath must be an absolute path/
    );
  });

  test('rejects worktree path with traversal segments', () => {
    assert.throws(
      () => launchCopilot('/repo/../etc/passwd', 'prompt', {}),
      /must not contain "\.\." traversal/
    );
  });

  test('spawns docker sandbox when sandbox option is true', () => {
    let captured;
    const mockSpawn = (cmd, args, opts) => {
      captured = { cmd, args, opts };
      return { pid: 42, unref() {} };
    };

    launchCopilot('/path/to/worktree', 'my prompt', { _spawn: mockSpawn, sandbox: true });

    assert.strictEqual(captured.cmd, 'docker');
    assert.strictEqual(captured.args[0], 'sandbox');
    assert.strictEqual(captured.args[1], 'run');
    assert.strictEqual(captured.args[2], 'copilot');
    assert.strictEqual(captured.args[3], '/path/to/worktree');
    assert.strictEqual(captured.args[4], '--');
    assert.ok(captured.args.includes('--allow-all-tools'));
    assert.ok(captured.args.includes('-p'));
    for (const tool of DENY_TOOLS) {
      const denyIdx = captured.args.indexOf('--deny-tool');
      assert.ok(denyIdx !== -1, `Expected sandbox args to include --deny-tool for ${tool}`);
      assert.ok(
        captured.args.some((a, i) => a === '--deny-tool' && captured.args[i + 1] === tool),
        `Expected sandbox args to include --deny-tool ${tool}`
      );
    }
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

  test('uses custom denyTools when provided in opts', () => {
    let captured;
    const mockSpawn = (cmd, args, opts) => {
      captured = { cmd, args, opts };
      return { pid: 42, unref() {} };
    };
    const customDeny = ['shell(rm)', 'shell(dd)'];

    launchCopilot('/path/to/worktree', 'my prompt', { _spawn: mockSpawn, denyTools: customDeny });

    // Custom deny tools should be present
    for (const tool of customDeny) {
      assert.ok(
        captured.args.some((a, i) => a === '--deny-tool' && captured.args[i + 1] === tool),
        `Expected --deny-tool ${tool}`
      );
    }
    // Default deny tools should NOT be present (unless overlapping)
    for (const tool of DEFAULT_DENY_TOOLS) {
      if (!customDeny.includes(tool)) {
        assert.ok(
          !captured.args.includes(tool),
          `Default tool ${tool} should not be in args when custom denyTools provided`
        );
      }
    }
  });
});

// =====================================================
// DENY_TOOLS constant
// =====================================================

describe('DENY_TOOLS / DEFAULT_DENY_TOOLS', () => {
  test('DENY_TOOLS is an alias for DEFAULT_DENY_TOOLS', () => {
    assert.strictEqual(DENY_TOOLS, DEFAULT_DENY_TOOLS);
  });

  test('is a non-empty array of strings', () => {
    assert.ok(Array.isArray(DEFAULT_DENY_TOOLS));
    assert.ok(DEFAULT_DENY_TOOLS.length > 0);
    for (const t of DEFAULT_DENY_TOOLS) {
      assert.strictEqual(typeof t, 'string');
    }
  });

  test('blocks git push', () => {
    assert.ok(DENY_TOOLS.includes('shell(git push)'));
  });

  test('blocks all gh commands with broad shell(gh) rule', () => {
    assert.ok(DENY_TOOLS.includes('shell(gh)'));
  });

  test('blocks network exfiltration tools', () => {
    assert.ok(DENY_TOOLS.includes('shell(curl)'));
    assert.ok(DENY_TOOLS.includes('shell(wget)'));
    assert.ok(DENY_TOOLS.includes('shell(nc)'));
    assert.ok(DENY_TOOLS.includes('shell(ssh)'));
    assert.ok(DENY_TOOLS.includes('shell(scp)'));
  });

  test('does not use granular deny rules (they do not work)', () => {
    // Granular rules like shell(gh pr create) are NOT matched by --deny-tool
    const granular = DENY_TOOLS.filter(t =>
      t.startsWith('shell(gh ') && t.split(' ').length > 2
    );
    assert.deepStrictEqual(granular, [], 'No granular gh rules should exist');
  });

  test('does not block github-mcp-server read tools', () => {
    assert.ok(!DENY_TOOLS.includes('github-mcp-server'));
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

  test('directs to MCP tools for remote reads', () => {
    const policy = getReadOnlyPolicy();
    assert.ok(policy.includes('MCP read-only tools'));
    assert.ok(policy.includes('github-mcp-server'));
  });

  test('includes untrusted content handling instructions', () => {
    const policy = getReadOnlyPolicy();
    assert.ok(policy.includes('untrusted_user_content'));
    assert.ok(policy.includes('Never'));
    assert.ok(policy.includes('data to analyze'));
  });
});

// =====================================================
// parseSessionIdFromLog
// =====================================================

describe('parseSessionIdFromLog', () => {
  test('returns null when file does not exist', () => {
    const result = parseSessionIdFromLog('/nonexistent/path.log', {
      _existsSync: () => false,
    });
    assert.strictEqual(result, null);
  });

  test('returns null when file has no session ID pattern', () => {
    const result = parseSessionIdFromLog('/some/log.log', {
      _existsSync: () => true,
      _readFile: () => 'Just some regular log output\nNo session info here\n',
    });
    assert.strictEqual(result, null);
  });

  test('extracts session ID from "Session ID:" format', () => {
    const result = parseSessionIdFromLog('/some/log.log', {
      _existsSync: () => true,
      _readFile: () => 'Starting up...\nSession ID: abc-123-def\nDone.\n',
    });
    assert.strictEqual(result, 'abc-123-def');
  });

  test('extracts session ID from "Resumable session:" format', () => {
    const result = parseSessionIdFromLog('/some/log.log', {
      _existsSync: () => true,
      _readFile: () => 'Resumable session: sess_xyz789\n',
    });
    assert.strictEqual(result, 'sess_xyz789');
  });

  test('extracts session ID from "--resume" format', () => {
    const result = parseSessionIdFromLog('/some/log.log', {
      _existsSync: () => true,
      _readFile: () => 'Run with --resume my-session-42 to continue\n',
    });
    assert.strictEqual(result, 'my-session-42');
  });

  test('handles empty file gracefully', () => {
    const result = parseSessionIdFromLog('/some/log.log', {
      _existsSync: () => true,
      _readFile: () => '',
    });
    assert.strictEqual(result, null);
  });

  test('returns null when logPath is falsy', () => {
    const result = parseSessionIdFromLog(null);
    assert.strictEqual(result, null);
  });
});

// =====================================================
// resumeCopilot
// =====================================================

describe('resumeCopilot', () => {
  test('calls gh copilot --resume with session ID', () => {
    let captured;
    const mockSpawnSync = (cmd, args, opts) => {
      captured = { cmd, args, opts };
      return { status: 0 };
    };
    resumeCopilot('/tmp/worktree', 'abc-123', { _spawnSync: mockSpawnSync });
    assert.strictEqual(captured.cmd, 'gh');
    assert.deepStrictEqual(captured.args, ['copilot', '--resume', 'abc-123']);
    assert.strictEqual(captured.opts.cwd, '/tmp/worktree');
  });

  test('omits session ID when not provided', () => {
    let captured;
    const mockSpawnSync = (cmd, args, opts) => {
      captured = { cmd, args, opts };
      return { status: 0 };
    };
    resumeCopilot('/tmp/worktree', null, { _spawnSync: mockSpawnSync });
    assert.deepStrictEqual(captured.args, ['copilot', '--resume']);
  });

  test('passes message option as -p flag', () => {
    let captured;
    const mockSpawnSync = (cmd, args) => {
      captured = { cmd, args };
      return { status: 0 };
    };
    resumeCopilot('/tmp/wt', 'sess-1', { message: 'hello', _spawnSync: mockSpawnSync });
    assert.deepStrictEqual(captured.args, ['copilot', '--resume', 'sess-1', '-p', 'hello']);
  });

  test('throws user-friendly error on ENOENT', () => {
    const mockSpawnSync = () => ({ error: { code: 'ENOENT' } });
    assert.throws(
      () => resumeCopilot('/tmp/wt', 'sess-1', { _spawnSync: mockSpawnSync }),
      /gh CLI not found/
    );
  });

  test('re-throws non-ENOENT errors', () => {
    const mockSpawnSync = () => ({ error: new Error('boom') });
    assert.throws(
      () => resumeCopilot('/tmp/wt', 'sess-1', { _spawnSync: mockSpawnSync }),
      /boom/
    );
  });

  test('returns exit status', () => {
    const mockSpawnSync = () => ({ status: 42 });
    const result = resumeCopilot('/tmp/wt', 'sess-1', { _spawnSync: mockSpawnSync });
    assert.strictEqual(result.status, 42);
  });

  test('rejects relative worktree path', () => {
    assert.throws(
      () => resumeCopilot('relative/path', 'sess-1', {}),
      /worktreePath must be an absolute path/
    );
  });

  test('rejects worktree path with traversal segments', () => {
    assert.throws(
      () => resumeCopilot('/repo/../etc/passwd', 'sess-1', {}),
      /must not contain "\.\." traversal/
    );
  });
});
