import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const RALLY_BIN = join(import.meta.dirname, '..', 'bin', 'rally.js');

// @inquirer/prompts barrel import is slow under Node ESM; allow generous startup
const DEFAULT_TIMEOUT = 30_000;
const DASHBOARD_TIMEOUT = 60_000;

function rally(args, opts = {}) {
  return execFileSync('node', [RALLY_BIN, ...args], {
    encoding: 'utf8',
    timeout: opts.timeout ?? DEFAULT_TIMEOUT,
    env: {
      ...process.env,
      RALLY_HOME: opts.rallyHome || '/tmp/rally-e2e-test',
      NO_COLOR: '1',
      ...opts.env,
    },
    ...opts,
  });
}

let tempDir;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'rally-e2e-'));
});

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('e2e: rally --version', () => {
  test('prints version and exits 0', { timeout: DEFAULT_TIMEOUT + 5000 }, () => {
    const output = rally(['--version'], { rallyHome: tempDir });
    assert.match(output.trim(), /^\d+\.\d+\.\d+$/, 'should print semver version');
  });
});

describe('e2e: rally --help', () => {
  test('prints help text listing all commands and exits 0', { timeout: DEFAULT_TIMEOUT + 5000 }, () => {
    const output = rally(['--help'], { rallyHome: tempDir });
    assert.ok(output.includes('setup'), 'help should mention setup command');
    assert.ok(output.includes('onboard'), 'help should mention onboard command');
    assert.ok(output.includes('status'), 'help should mention status command');
    assert.ok(output.includes('dashboard'), 'help should mention dashboard command');
  });
});

describe('e2e: rally status', () => {
  test('prints status output and exits 0 even with no config', { timeout: DEFAULT_TIMEOUT + 5000 }, () => {
    const output = rally(['status'], { rallyHome: tempDir });
    assert.ok(output.includes('Rally Status'), 'should include Rally Status header');
    assert.ok(output.includes('Config Paths'), 'should include Config Paths section');
  });
});

describe('e2e: rally setup --help', () => {
  test('prints setup help text and exits 0', { timeout: DEFAULT_TIMEOUT + 5000 }, () => {
    const output = rally(['setup', '--help'], { rallyHome: tempDir });
    assert.ok(output.includes('setup'), 'should describe setup command');
    assert.ok(output.includes('--dir'), 'should list --dir option');
  });
});

describe('e2e: rally dashboard --json', () => {
  test('outputs valid JSON and exits 0', { timeout: DASHBOARD_TIMEOUT + 5000 }, () => {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, 'active.yaml'), 'dispatches: []\n', 'utf8');

    const output = rally(['dashboard', '--json'], { rallyHome: tempDir, timeout: DASHBOARD_TIMEOUT });
    const data = JSON.parse(output);
    assert.ok(Array.isArray(data.dispatches), 'JSON should contain dispatches array');
    assert.ok(typeof data.summary === 'object', 'JSON should contain summary object');
  });
});

describe('e2e: rally nonexistent', () => {
  test('exits non-zero and prints error', { timeout: DEFAULT_TIMEOUT + 5000 }, () => {
    try {
      rally(['nonexistent'], { rallyHome: tempDir });
      assert.fail('should have thrown on unknown command');
    } catch (err) {
      assert.notEqual(err.status, 0, 'exit code should be non-zero');
      const stderr = err.stderr?.toString() || '';
      const stdout = err.stdout?.toString() || '';
      const combined = stderr + stdout;
      assert.ok(combined.includes('unknown command'), 'should report unknown command');
    }
  });
});

describe('e2e: rally dashboard --project filter --json', () => {
  test('outputs valid JSON filtered by project', { timeout: DASHBOARD_TIMEOUT + 5000 }, () => {
    mkdirSync(tempDir, { recursive: true });
    const activeYaml = [
      'dispatches:',
      '  - id: d1',
      '    repo: owner/test-repo',
      '    type: issue',
      '    number: 1',
      '    branch: rally/1-feat',
      '    status: implementing',
      '    worktreePath: /nonexistent',
      '    session_id: s1',
      '    created: "2025-01-01T00:00:00.000Z"',
      '  - id: d2',
      '    repo: owner/other-repo',
      '    type: pr',
      '    number: 2',
      '    branch: rally/2-fix',
      '    status: done',
      '    worktreePath: /nonexistent',
      '    session_id: s2',
      '    created: "2025-01-01T00:00:00.000Z"',
      '',
    ].join('\n');
    writeFileSync(join(tempDir, 'active.yaml'), activeYaml, 'utf8');

    const output = rally(['dashboard', '--project', 'test-repo', '--json'], {
      rallyHome: tempDir,
      timeout: DASHBOARD_TIMEOUT,
    });
    const data = JSON.parse(output);
    assert.ok(Array.isArray(data.dispatches), 'should have dispatches array');
    assert.equal(data.dispatches.length, 1, 'should filter to one dispatch');
    assert.ok(data.dispatches[0].repo.includes('test-repo'), 'filtered dispatch should match project');
  });
});
