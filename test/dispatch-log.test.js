import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { dispatchLog } from '../lib/dispatch-log.js';

describe('dispatchLog', () => {
  test('displays log file content when dispatch is found', async (t) => {
    const mockGetActive = () => [
      {
        id: 'issue-42',
        repo: 'owner/repo',
        number: 42,
        type: 'issue',
        logPath: '/worktree/.copilot-output.log',
      },
    ];

    const mockReadFile = (path, encoding) => {
      assert.strictEqual(path, '/worktree/.copilot-output.log');
      assert.strictEqual(encoding, 'utf8');
      return 'Copilot output here\nMore output\n';
    };

    const mockExists = (path) => {
      assert.strictEqual(path, '/worktree/.copilot-output.log');
      return true;
    };

    const mockLog = t.mock.method(console, 'log', () => {});

    await dispatchLog(42, {
      _getActiveDispatches: mockGetActive,
      _readFile: mockReadFile,
      _existsSync: mockExists,
      _chalk: {
        yellow: (s) => s,
        dim: (s) => s,
      },
    });

    assert.strictEqual(mockLog.mock.calls.length, 1);
    assert.strictEqual(mockLog.mock.calls[0].arguments[0], 'Copilot output here\nMore output\n');
  });

  test('shows warning when logPath is missing', async (t) => {
    const mockGetActive = () => [
      {
        id: 'issue-42',
        repo: 'owner/repo',
        number: 42,
        type: 'issue',
        logPath: null,
      },
    ];

    const mockLog = t.mock.method(console, 'log', () => {});

    await dispatchLog(42, {
      _getActiveDispatches: mockGetActive,
      _chalk: {
        yellow: (s) => `[yellow]${s}`,
        dim: (s) => `[dim]${s}`,
      },
    });

    assert.ok(mockLog.mock.calls.some((call) => call.arguments.join(' ').includes('No log file available')));
  });

  test('shows warning when log file does not exist', async (t) => {
    const mockGetActive = () => [
      {
        id: 'issue-42',
        repo: 'owner/repo',
        number: 42,
        type: 'issue',
        logPath: '/worktree/.copilot-output.log',
      },
    ];

    const mockExists = () => false;

    const mockLog = t.mock.method(console, 'log', () => {});

    await dispatchLog(42, {
      _getActiveDispatches: mockGetActive,
      _existsSync: mockExists,
      _chalk: {
        yellow: (s) => `[yellow]${s}`,
        dim: (s) => `[dim]${s}`,
      },
    });

    assert.ok(mockLog.mock.calls.some((call) => call.arguments.join(' ').includes('Log file not found')));
  });

  test('throws when no dispatch is found for number', async () => {
    const mockGetActive = () => [
      { id: 'issue-99', repo: 'owner/repo', number: 99, type: 'issue' },
    ];

    await assert.rejects(
      async () => dispatchLog(42, { _getActiveDispatches: mockGetActive }),
      { message: /No active dispatch found for #42/ }
    );
  });

  test('throws when multiple dispatches found without --repo', async () => {
    const mockGetActive = () => [
      { id: 'issue-42-a', repo: 'owner/repo1', number: 42, type: 'issue' },
      { id: 'issue-42-b', repo: 'owner/repo2', number: 42, type: 'issue' },
    ];

    await assert.rejects(
      async () => dispatchLog(42, { _getActiveDispatches: mockGetActive }),
      { message: /Multiple dispatches found/ }
    );
  });

  test('disambiguates with --repo flag', async (t) => {
    const mockGetActive = () => [
      {
        id: 'issue-42-a',
        repo: 'owner/repo1',
        number: 42,
        type: 'issue',
        logPath: '/wt1/.copilot-output.log',
      },
      {
        id: 'issue-42-b',
        repo: 'owner/repo2',
        number: 42,
        type: 'issue',
        logPath: '/wt2/.copilot-output.log',
      },
    ];

    const mockReadFile = (path) => {
      assert.strictEqual(path, '/wt2/.copilot-output.log');
      return 'repo2 output\n';
    };

    const mockExists = () => true;

    const mockLog = t.mock.method(console, 'log', () => {});

    await dispatchLog(42, {
      repo: 'owner/repo2',
      _getActiveDispatches: mockGetActive,
      _readFile: mockReadFile,
      _existsSync: mockExists,
      _chalk: { yellow: (s) => s, dim: (s) => s },
    });

    assert.strictEqual(mockLog.mock.calls[0].arguments[0], 'repo2 output\n');
  });

  test('warns that --follow is not yet implemented', async (t) => {
    const mockGetActive = () => [
      {
        id: 'issue-42',
        repo: 'owner/repo',
        number: 42,
        type: 'issue',
        logPath: '/worktree/.copilot-output.log',
      },
    ];

    const mockReadFile = () => 'output\n';
    const mockExists = () => true;

    const mockLog = t.mock.method(console, 'log', () => {});

    await dispatchLog(42, {
      follow: true,
      _getActiveDispatches: mockGetActive,
      _readFile: mockReadFile,
      _existsSync: mockExists,
      _chalk: { yellow: (s) => `[yellow]${s}`, dim: (s) => s },
    });

    assert.ok(mockLog.mock.calls.some((call) => call.arguments.join(' ').includes('--follow flag is not yet implemented')));
  });

  test('shows stats summary when log contains copilot stats', async (t) => {
    const logContent = [
      'Some copilot output...',
      'Total code changes:     +164 -1',
      'Total session time:     3m 6s',
      'API time spent:         2m 48s',
      'Total usage est:        3 Premium requests',
    ].join('\n');

    const mockGetActive = () => [
      {
        id: 'issue-42',
        repo: 'owner/repo',
        number: 42,
        type: 'issue',
        logPath: '/worktree/.copilot-output.log',
      },
    ];

    const mockLog = t.mock.method(console, 'log', () => {});

    await dispatchLog(42, {
      _getActiveDispatches: mockGetActive,
      _readFile: () => logContent,
      _existsSync: () => true,
      _chalk: {
        yellow: (s) => s,
        dim: (s) => s,
        bold: (s) => `[bold]${s}`,
      },
    });

    assert.ok(mockLog.mock.calls.some((call) => call.arguments.join(' ').includes('[bold]Stats:')));
    assert.ok(mockLog.mock.calls.some((call) => call.arguments.join(' ').includes('+164 -1')));
    assert.ok(mockLog.mock.calls.some((call) => call.arguments.join(' ').includes('Premium requests: 3')));
  });

  test('shows log normally when no stats present', async (t) => {
    const logContent = 'Just regular output\nNo stats here\n';

    const mockGetActive = () => [
      {
        id: 'issue-42',
        repo: 'owner/repo',
        number: 42,
        type: 'issue',
        logPath: '/worktree/.copilot-output.log',
      },
    ];

    const mockLog = t.mock.method(console, 'log', () => {});

    await dispatchLog(42, {
      _getActiveDispatches: mockGetActive,
      _readFile: () => logContent,
      _existsSync: () => true,
      _chalk: {
        yellow: (s) => s,
        dim: (s) => s,
        bold: (s) => `[bold]${s}`,
      },
    });

    assert.ok(!mockLog.mock.calls.some((call) => call.arguments.join(' ').includes('[bold]Stats:')));
    assert.strictEqual(mockLog.mock.calls.length, 1);
    assert.strictEqual(mockLog.mock.calls[0].arguments[0], logContent);
  });
});
