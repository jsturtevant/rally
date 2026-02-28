import { describe, test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync,
  rmSync, existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';

const RALLY_BIN = join(import.meta.dirname, '..', '..', 'bin', 'rally.js');
const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

const DEFAULT_TIMEOUT = 30_000;
const DISPATCH_TIMEOUT = 60_000;

/** Run the rally CLI as a subprocess. */
function rally(args, opts = {}) {
  const { rallyHome, timeout: t, env: extraEnv, ...rest } = opts;
  return execFileSync('node', [RALLY_BIN, ...args], {
    encoding: 'utf8',
    timeout: t ?? DEFAULT_TIMEOUT,
    ...rest,
    env: {
      ...process.env,
      RALLY_HOME: rallyHome || join(tmpdir(), 'rally-e2e-test'),
      NO_COLOR: '1',
      GIT_TERMINAL_PROMPT: '0',
      ...extraEnv,
    },
  });
}

/** Write a minimal Rally config that registers the real repo. */
function seedConfig(rallyHome, repoPath) {
  mkdirSync(rallyHome, { recursive: true });

  const teamDir = join(rallyHome, 'team');
  const projectsDir = join(rallyHome, 'projects');
  mkdirSync(teamDir, { recursive: true });
  mkdirSync(projectsDir, { recursive: true });

  writeFileSync(
    join(rallyHome, 'config.yaml'),
    yaml.dump({ teamDir, projectsDir, version: '0.1.0' }),
    'utf8',
  );

  writeFileSync(
    join(rallyHome, 'projects.yaml'),
    yaml.dump({
      projects: [{
        name: 'rally',
        path: repoPath,
        team: 'shared',
        teamDir,
        onboarded: new Date().toISOString(),
      }],
    }),
    'utf8',
  );

  writeFileSync(join(rallyHome, 'active.yaml'), 'dispatches: []\n', 'utf8');
  return { teamDir, projectsDir };
}

// ─── Group 1: CLI basics ────────────────────────────────────────────────────

describe('e2e: CLI basics', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rally-e2e-'));
  });
  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test('rally --version prints semver', { timeout: DEFAULT_TIMEOUT }, () => {
    const output = rally(['--version'], { rallyHome: tempDir });
    assert.match(output.trim(), /^\d+\.\d+\.\d+$/, 'should print semver');
  });

  test('rally --help lists commands', { timeout: DEFAULT_TIMEOUT }, () => {
    const output = rally(['--help'], { rallyHome: tempDir });
    for (const cmd of ['setup', 'onboard', 'status', 'dashboard']) {
      assert.ok(output.includes(cmd), `help should mention ${cmd}`);
    }
  });

  test('rally status shows status info', { timeout: DEFAULT_TIMEOUT }, () => {
    const output = rally(['status'], { rallyHome: tempDir });
    assert.ok(output.includes('Rally Status'), 'should include header');
    assert.ok(output.includes('Config Paths'), 'should include Config Paths');
  });

  test('rally dashboard --json outputs valid JSON', { timeout: DISPATCH_TIMEOUT }, () => {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, 'active.yaml'), 'dispatches: []\n', 'utf8');

    const output = rally(['dashboard', '--json'], { rallyHome: tempDir, timeout: DISPATCH_TIMEOUT });
    const data = JSON.parse(output);
    assert.ok(Array.isArray(data.dispatches), 'should have dispatches array');
  });

  test('rally nonexistent exits non-zero', { timeout: DEFAULT_TIMEOUT }, () => {
    assert.throws(
      () => rally(['nonexistent'], { rallyHome: tempDir }),
      (err) => {
        assert.notEqual(err.status, 0);
        const out = (err.stderr?.toString() || '') + (err.stdout?.toString() || '');
        assert.ok(out.includes('unknown command'), 'should report unknown command');
        return true;
      },
    );
  });
});

// ─── Group 2: Setup & Onboard flow ─────────────────────────────────────────

describe('e2e: setup & onboard (config seeding)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rally-e2e-'));
  });
  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test('manual config seeding creates config with repo registered', { timeout: DEFAULT_TIMEOUT }, () => {
    // setup uses npx + interactive prompts; seed config manually instead
    seedConfig(tempDir, REPO_ROOT);

    // Verify config was written correctly
    const config = yaml.load(readFileSync(join(tempDir, 'config.yaml'), 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.equal(config.version, '0.1.0');
    assert.ok(existsSync(config.teamDir), 'teamDir should exist');
    assert.ok(existsSync(config.projectsDir), 'projectsDir should exist');
  });

  test('seeded config makes project visible in rally status', { timeout: DEFAULT_TIMEOUT }, () => {
    seedConfig(tempDir, REPO_ROOT);

    const output = rally(['status'], { rallyHome: tempDir });
    assert.ok(output.includes('rally'), 'status should show onboarded project name');
  });

  test('rally status --json reflects seeded config', { timeout: DEFAULT_TIMEOUT }, () => {
    seedConfig(tempDir, REPO_ROOT);

    const output = rally(['status', '--json'], { rallyHome: tempDir });
    const data = JSON.parse(output);
    assert.ok(Array.isArray(data.projects), 'should have projects array');
    assert.equal(data.projects.length, 1);
    assert.equal(data.projects[0].name, 'rally');
  });
});

// ─── Group 3: Dispatch (real repo integration) ─────────────────────────────

describe('e2e: dispatch issue 54 (library)', () => {
  const skipReason = (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN)
    ? 'Skipping: GH_TOKEN not set (dispatch tests require GitHub API access)'
    : undefined;

  let tempDir;
  let worktreePath;
  let branchName;
  let dispatchResult;
  let origRallyHome;

  before(() => {
    if (skipReason) return;

    origRallyHome = process.env.RALLY_HOME;
    tempDir = mkdtempSync(join(tmpdir(), 'rally-e2e-dispatch-'));
    seedConfig(tempDir, REPO_ROOT);
    process.env.RALLY_HOME = tempDir;
  });

  // Shared before that runs dispatch once for all tests in the suite
  before(async () => {
    if (skipReason) return;

    const { dispatchIssue } = await import('../../lib/dispatch-issue.js');

    dispatchResult = await dispatchIssue({
      issueNumber: 54,
      repo: 'jsturtevant/rally',
      repoPath: REPO_ROOT,
      teamDir: join(tempDir, 'nonexistent-team'),
    });

    worktreePath = dispatchResult.worktreePath;
    branchName = dispatchResult.branch;
  });

  after(() => {
    if (skipReason) return;

    // Restore RALLY_HOME
    if (origRallyHome !== undefined) {
      process.env.RALLY_HOME = origRallyHome;
    } else {
      delete process.env.RALLY_HOME;
    }

    // Clean up worktree via git first (must happen before rmSync)
    if (worktreePath) {
      try {
        execFileSync('git', ['worktree', 'remove', worktreePath, '--force'], {
          cwd: REPO_ROOT, encoding: 'utf8',
        });
      } catch { /* already gone */ }
    }

    // Clean up branch
    if (branchName) {
      try {
        execFileSync('git', ['branch', '-D', branchName], {
          cwd: REPO_ROOT, encoding: 'utf8',
        });
      } catch { /* already gone */ }
    }

    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test('dispatchIssue creates worktree, branch, context, and active entry', { skip: skipReason, timeout: DISPATCH_TIMEOUT }, () => {
    // Branch name should match pattern
    assert.match(dispatchResult.branch, /^rally\/54-/, 'branch should start with rally/54-');

    // Worktree should exist on disk
    assert.ok(existsSync(worktreePath), 'worktree directory should exist');

    // dispatch-context.md is written inside .squad/
    const contextPath = join(worktreePath, '.squad', 'dispatch-context.md');
    assert.ok(existsSync(contextPath), 'dispatch-context.md should exist');
    const contextContent = readFileSync(contextPath, 'utf8');
    assert.ok(contextContent.includes('#54') || contextContent.includes('54'), 'context should reference issue 54');

    // active.yaml should have the dispatch
    const active = yaml.load(readFileSync(join(tempDir, 'active.yaml'), 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.ok(active.dispatches.length >= 1, 'should have at least one dispatch');
    const dispatch = active.dispatches.find(d => d.number === 54);
    assert.ok(dispatch, 'dispatch for issue 54 should exist');
    assert.equal(dispatch.status, 'implementing');
    assert.equal(dispatch.type, 'issue');
  });

  test('rally dashboard --json shows the dispatch after dispatch', { skip: skipReason, timeout: DISPATCH_TIMEOUT }, () => {
    const output = rally(['dashboard', '--json'], { rallyHome: tempDir, timeout: DISPATCH_TIMEOUT });
    const data = JSON.parse(output);
    assert.ok(data.dispatches.length >= 1, 'should have dispatches');
    const d = data.dispatches.find(x => x.number === 54);
    assert.ok(d, 'dashboard JSON should include issue 54 dispatch');
    assert.equal(d.repo, 'jsturtevant/rally');
  });

  test('rally dashboard (non-TTY piped) shows text output', { skip: skipReason, timeout: DISPATCH_TIMEOUT }, () => {
    // Force non-TTY by piping through cat-like behavior (no isTTY on stdout)
    const output = rally(['dashboard'], { rallyHome: tempDir, timeout: DISPATCH_TIMEOUT });
    assert.ok(output.includes('Rally Dashboard'), 'should include dashboard header');
    assert.ok(output.includes('54') || output.includes('rally'), 'should reference the dispatch');
  });
});

// ─── Group 4: Dispatch clean ───────────────────────────────────────────────

describe('e2e: dispatch clean', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rally-e2e-clean-'));
  });
  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test('dispatch clean removes done dispatches', { timeout: DISPATCH_TIMEOUT }, async (t) => {
    // Seed config with a "done" dispatch
    seedConfig(tempDir, REPO_ROOT);
    const active = {
      dispatches: [{
        id: 'rally-issue-99',
        repo: 'jsturtevant/rally',
        number: 99,
        type: 'issue',
        branch: 'rally/99-fake',
        worktreePath: '/nonexistent/path',
        status: 'done',
        session_id: 'test-session',
        created: new Date().toISOString(),
      }],
    };
    writeFileSync(join(tempDir, 'active.yaml'), yaml.dump(active), 'utf8');

    // Set RALLY_HOME for library imports
    const origHome = process.env.RALLY_HOME;
    process.env.RALLY_HOME = tempDir;
    t.after(() => {
      if (origHome !== undefined) process.env.RALLY_HOME = origHome;
      else delete process.env.RALLY_HOME;
    });

    const { dispatchClean } = await import('../../lib/dispatch-clean.js');
    const noopOra = (opts) => ({
      start() { return this; },
      succeed() {},
      fail() {},
    });

    const result = await dispatchClean({
      _ora: noopOra,
      _chalk: { green: s => s, red: s => s, yellow: s => s, dim: s => s },
      _removeWorktree: () => {},  // worktree doesn't exist; skip removal
    });

    assert.equal(result.cleaned.length, 1, 'should clean one dispatch');
    assert.equal(result.cleaned[0].id, 'rally-issue-99');

    // active.yaml should now be empty
    const afterActive = yaml.load(readFileSync(join(tempDir, 'active.yaml'), 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.equal(afterActive.dispatches.length, 0, 'active.yaml should have no dispatches');
  });

  test('dispatch clean skips when no done dispatches', { timeout: DISPATCH_TIMEOUT }, async (t) => {
    seedConfig(tempDir, REPO_ROOT);
    // All dispatches are "implementing" — none are "done"
    const active = {
      dispatches: [{
        id: 'rally-issue-77',
        repo: 'jsturtevant/rally',
        number: 77,
        type: 'issue',
        branch: 'rally/77-wip',
        worktreePath: '/nonexistent',
        status: 'implementing',
        session_id: 'test-session',
        created: new Date().toISOString(),
      }],
    };
    writeFileSync(join(tempDir, 'active.yaml'), yaml.dump(active), 'utf8');

    const origHome = process.env.RALLY_HOME;
    process.env.RALLY_HOME = tempDir;
    t.after(() => {
      if (origHome !== undefined) process.env.RALLY_HOME = origHome;
      else delete process.env.RALLY_HOME;
    });

    const { dispatchClean } = await import('../../lib/dispatch-clean.js');
    const noopOra = () => ({ start() { return this; }, succeed() {}, fail() {} });

    const result = await dispatchClean({
      _ora: noopOra,
      _chalk: { green: s => s, red: s => s, yellow: s => s, dim: s => s },
      _removeWorktree: () => {},
    });

    assert.equal(result.cleaned.length, 0, 'should clean nothing');

    // Dispatch should still be present
    const afterActive = yaml.load(readFileSync(join(tempDir, 'active.yaml'), 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.equal(afterActive.dispatches.length, 1, 'dispatch should remain');
  });

  test('rally dashboard --json shows filtered project data', { timeout: DISPATCH_TIMEOUT }, () => {
    mkdirSync(tempDir, { recursive: true });
    const activeYaml = yaml.dump({
      dispatches: [
        {
          id: 'd1', repo: 'owner/test-repo', type: 'issue', number: 1,
          branch: 'rally/1-feat', status: 'implementing',
          worktreePath: '/nonexistent', session_id: 's1',
          created: '2025-01-01T00:00:00.000Z',
        },
        {
          id: 'd2', repo: 'owner/other-repo', type: 'pr', number: 2,
          branch: 'rally/2-fix', status: 'done',
          worktreePath: '/nonexistent', session_id: 's2',
          created: '2025-01-01T00:00:00.000Z',
        },
      ],
    });
    writeFileSync(join(tempDir, 'active.yaml'), activeYaml, 'utf8');

    const output = rally(['dashboard', '--project', 'test-repo', '--json'], {
      rallyHome: tempDir, timeout: DISPATCH_TIMEOUT,
    });
    const data = JSON.parse(output);
    assert.equal(data.dispatches.length, 1, 'should filter to one dispatch');
    assert.ok(data.dispatches[0].repo.includes('test-repo'));
  });
});
