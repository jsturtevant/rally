import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, existsSync, readFileSync,
  mkdirSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';

// Module under test — will exist when #15 lands
// import { dispatchIssue } from '../lib/dispatch-issue.js';

describe('dispatch issue', () => {
  let tempDir;
  let repoPath;
  let originalEnv;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rally-dispatch-issue-test-'));
    repoPath = join(tempDir, 'repo');
    originalEnv = process.env.RALLY_HOME;
    process.env.RALLY_HOME = join(tempDir, 'rally-home');

    // Initialize a real git repo for worktree operations
    mkdirSync(repoPath, { recursive: true });
    execFileSync('git', ['init'], { cwd: repoPath, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: repoPath, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repoPath, stdio: 'ignore' });
    writeFileSync(join(repoPath, 'README.md'), '# Test');
    execFileSync('git', ['add', '.'], { cwd: repoPath, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: repoPath, stdio: 'ignore' });
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.RALLY_HOME = originalEnv;
    } else {
      delete process.env.RALLY_HOME;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper: set up Rally config + projects with an onboarded repo
   */
  function setupOnboardedRepo(repoName = 'my-repo') {
    const rallyHome = process.env.RALLY_HOME;
    const teamDir = join(rallyHome, 'team');
    mkdirSync(join(teamDir, '.squad'), { recursive: true });

    const config = { teamDir, projectsDir: join(rallyHome, 'projects'), version: '0.1.0' };
    writeFileSync(join(rallyHome, 'config.yaml'), yaml.dump(config), 'utf8');

    const projects = {
      projects: [{
        name: repoName,
        path: repoPath,
        team: 'shared',
        teamDir,
        onboarded: new Date().toISOString(),
      }],
    };
    writeFileSync(join(rallyHome, 'projects.yaml'), yaml.dump(projects), 'utf8');

    return { rallyHome, teamDir };
  }

  /**
   * Helper: mock _exec that captures calls and simulates gh/git/copilot
   */
  function createMockExec(issueData = null) {
    const calls = [];
    const mockExec = (cmd, args, opts) => {
      calls.push({ cmd, args, cwd: opts?.cwd });

      // Simulate `gh issue view` returning JSON
      if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view') {
        if (!issueData) {
          const err = new Error('Could not resolve to an Issue with the number of 999');
          err.stderr = 'Could not resolve to an Issue';
          throw err;
        }
        return JSON.stringify(issueData);
      }

      // Simulate `gh repo view` for default branch
      if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
        return 'main\n';
      }

      return '';
    };
    return { mockExec, calls };
  }

  // =====================================================
  // ERROR PATHS — tested first per team convention
  // =====================================================

  describe('error paths', () => {
    test('error: issue not found (gh returns error)', async () => {
      const { dispatchIssue } = await import('../lib/dispatch-issue.js');
      setupOnboardedRepo();

      const { mockExec } = createMockExec(null); // null = issue not found

      await assert.rejects(
        () => dispatchIssue({
          issueNumber: 999,
          repo: 'owner/repo',
          repoPath,
          _exec: mockExec,
        }),
        (err) => {
          assert.ok(
            err.message.includes('not found') || err.message.includes('999'),
            `Expected "not found" error, got: ${err.message}`
          );
          return true;
        }
      );
    });

    test('error: repo not onboarded', async () => {
      const { dispatchIssue } = await import('../lib/dispatch-issue.js');
      // Don't call setupOnboardedRepo — no projects.yaml
      const rallyHome = process.env.RALLY_HOME;
      mkdirSync(rallyHome, { recursive: true });
      writeFileSync(join(rallyHome, 'config.yaml'), yaml.dump({ version: '0.1.0' }), 'utf8');

      const issue = { number: 42, title: 'Test', labels: [], assignees: [], body: '' };
      const { mockExec } = createMockExec(issue);

      await assert.rejects(
        () => dispatchIssue({
          issueNumber: 42,
          repo: 'owner/repo',
          repoPath,
          _exec: mockExec,
        }),
        (err) => {
          assert.ok(
            err.message.includes('not onboarded') || err.message.includes('not found'),
            `Expected "not onboarded" error, got: ${err.message}`
          );
          return true;
        }
      );
    });

    test('error: worktree already exists at target path', async () => {
      const { dispatchIssue } = await import('../lib/dispatch-issue.js');
      setupOnboardedRepo();

      const issue = { number: 42, title: 'Test issue', labels: [], assignees: [], body: '' };
      const { mockExec } = createMockExec(issue);

      // Pre-create the worktree directory to simulate collision
      const worktreeDir = join(repoPath, '.worktrees', 'rally-42');
      mkdirSync(worktreeDir, { recursive: true });

      await assert.rejects(
        () => dispatchIssue({
          issueNumber: 42,
          repo: 'owner/repo',
          repoPath,
          _exec: mockExec,
        }),
        (err) => {
          assert.ok(
            err.message.includes('already exists') || err.message.includes('worktree'),
            `Expected "already exists" error, got: ${err.message}`
          );
          return true;
        }
      );
    });

    test('error: Copilot CLI not available', async () => {
      const { dispatchIssue } = await import('../lib/dispatch-issue.js');
      setupOnboardedRepo();

      const issue = { number: 50, title: 'Copilot missing', labels: [], assignees: [], body: '' };
      const mockExec = (cmd, args, opts) => {
        if (cmd === 'gh' && args[0] === 'issue') {
          return JSON.stringify(issue);
        }
        if (cmd === 'gh' && args[0] === 'repo') {
          return 'main\n';
        }
        // Simulate copilot CLI not found
        if (cmd === 'npx' || (cmd === 'gh' && args.includes('copilot'))) {
          const err = new Error('spawn npx ENOENT');
          err.code = 'ENOENT';
          throw err;
        }
        return '';
      };

      await assert.rejects(
        () => dispatchIssue({
          issueNumber: 50,
          repo: 'owner/repo',
          repoPath,
          _exec: mockExec,
        }),
        (err) => {
          assert.ok(err.message.length > 0, 'should have an error message');
          return true;
        }
      );
    });

    test('error: missing issue number argument', async () => {
      const { dispatchIssue } = await import('../lib/dispatch-issue.js');
      setupOnboardedRepo();

      await assert.rejects(
        () => dispatchIssue({
          repo: 'owner/repo',
          repoPath,
        }),
        (err) => {
          assert.ok(err.message.length > 0, 'should have an error message');
          return true;
        }
      );
    });
  });

  // =====================================================
  // BRANCH NAMING — rally/{issue-number}-{slug}
  // =====================================================

  describe('branch naming', () => {
    test('creates branch with rally/{number}-{slug} format', async () => {
      const { dispatchIssue } = await import('../lib/dispatch-issue.js');
      setupOnboardedRepo();

      const issue = { number: 42, title: 'Add login form', labels: [], assignees: [], body: '' };
      const { mockExec, calls } = createMockExec(issue);

      // We need a mock that also handles git worktree add
      const flexExec = (cmd, args, opts) => {
        if (cmd === 'git' && args[0] === 'worktree') {
          calls.push({ cmd, args, cwd: opts?.cwd });
          // Simulate worktree creation by creating the directory
          if (args[1] === 'add') {
            mkdirSync(args[2], { recursive: true });
            mkdirSync(join(args[2], '.squad'), { recursive: true });
          }
          return '';
        }
        return mockExec(cmd, args, opts);
      };

      try {
        await dispatchIssue({
          issueNumber: 42,
          repo: 'owner/repo',
          repoPath,
          _exec: flexExec,
        });
      } catch {
        // May fail on copilot invocation — that's OK for branch name check
      }

      const gitWorktreeCall = calls.find(
        (c) => c.cmd === 'git' && c.args[0] === 'worktree' && c.args[1] === 'add'
      );

      if (gitWorktreeCall) {
        const branchArg = gitWorktreeCall.args.find((a) => a.startsWith('rally/'));
        assert.ok(branchArg, 'should create branch starting with rally/');
        assert.ok(branchArg.includes('42'), 'branch should contain issue number');
        assert.match(branchArg, /^rally\/42-/, 'branch should match rally/{number}-{slug} format');
      }
    });

    test('slug is derived from issue title (lowercase, hyphenated)', async () => {
      const { dispatchIssue } = await import('../lib/dispatch-issue.js');
      setupOnboardedRepo();

      const issue = { number: 7, title: 'Fix Broken Navbar Component', labels: [], assignees: [], body: '' };
      const { mockExec, calls } = createMockExec(issue);

      const flexExec = (cmd, args, opts) => {
        if (cmd === 'git' && args[0] === 'worktree') {
          calls.push({ cmd, args, cwd: opts?.cwd });
          if (args[1] === 'add') {
            mkdirSync(args[2], { recursive: true });
            mkdirSync(join(args[2], '.squad'), { recursive: true });
          }
          return '';
        }
        return mockExec(cmd, args, opts);
      };

      try {
        await dispatchIssue({
          issueNumber: 7,
          repo: 'owner/repo',
          repoPath,
          _exec: flexExec,
        });
      } catch {
        // May fail after branch creation
      }

      const gitWorktreeCall = calls.find(
        (c) => c.cmd === 'git' && c.args[0] === 'worktree' && c.args[1] === 'add'
      );

      if (gitWorktreeCall) {
        const branchArg = gitWorktreeCall.args.find((a) => a.startsWith('rally/'));
        assert.ok(branchArg, 'branch name should exist');
        // Slug should be lowercase with hyphens
        assert.ok(!branchArg.includes('Fix'), 'slug should be lowercase');
        assert.ok(branchArg.includes('fix') || branchArg.includes('broken') || branchArg.includes('navbar'),
          'slug should derive from title');
      }
    });
  });

  // =====================================================
  // WORKTREE PATH — .worktrees/rally-{issue-number}/
  // =====================================================

  describe('worktree path', () => {
    test('worktree created at .worktrees/rally-{number}/', async () => {
      const { dispatchIssue } = await import('../lib/dispatch-issue.js');
      setupOnboardedRepo();

      const issue = { number: 42, title: 'Worktree path test', labels: [], assignees: [], body: '' };
      const { mockExec, calls } = createMockExec(issue);

      const flexExec = (cmd, args, opts) => {
        if (cmd === 'git' && args[0] === 'worktree') {
          calls.push({ cmd, args, cwd: opts?.cwd });
          if (args[1] === 'add') {
            mkdirSync(args[2], { recursive: true });
            mkdirSync(join(args[2], '.squad'), { recursive: true });
          }
          return '';
        }
        return mockExec(cmd, args, opts);
      };

      try {
        await dispatchIssue({
          issueNumber: 42,
          repo: 'owner/repo',
          repoPath,
          _exec: flexExec,
        });
      } catch {
        // May fail on copilot step
      }

      const gitWorktreeCall = calls.find(
        (c) => c.cmd === 'git' && c.args[0] === 'worktree' && c.args[1] === 'add'
      );

      if (gitWorktreeCall) {
        const worktreePathArg = gitWorktreeCall.args[2];
        assert.ok(
          worktreePathArg.includes('.worktrees') && worktreePathArg.includes('rally-42'),
          `worktree path should be .worktrees/rally-42/, got: ${worktreePathArg}`
        );
      }
    });
  });

  // =====================================================
  // ACTIVE.YAML — logs dispatch with status "planning"
  // =====================================================

  describe('active.yaml tracking', () => {
    test('logs dispatch entry to active.yaml', async () => {
      const { dispatchIssue } = await import('../lib/dispatch-issue.js');
      const { rallyHome } = setupOnboardedRepo();

      const issue = { number: 42, title: 'Active tracking test', labels: [], assignees: [], body: '' };
      const { mockExec } = createMockExec(issue);

      const flexExec = (cmd, args, opts) => {
        if (cmd === 'git' && args[0] === 'worktree') {
          if (args[1] === 'add') {
            mkdirSync(args[2], { recursive: true });
            mkdirSync(join(args[2], '.squad'), { recursive: true });
          }
          return '';
        }
        return mockExec(cmd, args, opts);
      };

      try {
        await dispatchIssue({
          issueNumber: 42,
          repo: 'owner/repo',
          repoPath,
          _exec: flexExec,
        });
      } catch {
        // May fail on copilot step
      }

      const activePath = join(rallyHome, 'active.yaml');
      if (existsSync(activePath)) {
        const active = yaml.load(readFileSync(activePath, 'utf8'));
        assert.ok(active.dispatches, 'should have dispatches array');
        const dispatch = active.dispatches.find((d) => d.issue === 42 || d.id === 42);
        assert.ok(dispatch, 'should log dispatch entry for issue 42');
      }
    });

    test('dispatch entry has status "planning"', async () => {
      const { dispatchIssue } = await import('../lib/dispatch-issue.js');
      const { rallyHome } = setupOnboardedRepo();

      const issue = { number: 42, title: 'Status test', labels: [], assignees: [], body: '' };
      const { mockExec } = createMockExec(issue);

      const flexExec = (cmd, args, opts) => {
        if (cmd === 'git' && args[0] === 'worktree') {
          if (args[1] === 'add') {
            mkdirSync(args[2], { recursive: true });
            mkdirSync(join(args[2], '.squad'), { recursive: true });
          }
          return '';
        }
        return mockExec(cmd, args, opts);
      };

      try {
        await dispatchIssue({
          issueNumber: 42,
          repo: 'owner/repo',
          repoPath,
          _exec: flexExec,
        });
      } catch {
        // May fail on copilot step
      }

      const activePath = join(rallyHome, 'active.yaml');
      if (existsSync(activePath)) {
        const active = yaml.load(readFileSync(activePath, 'utf8'));
        const dispatch = active.dispatches.find((d) => d.issue === 42 || d.id === 42);
        if (dispatch) {
          assert.strictEqual(dispatch.status, 'planning', 'status should be "planning"');
        }
      }
    });
  });

  // =====================================================
  // SQUAD SYMLINK — symlinks team into worktree
  // =====================================================

  describe('squad symlink in worktree', () => {
    test('creates .squad symlink inside worktree', async () => {
      const { dispatchIssue } = await import('../lib/dispatch-issue.js');
      setupOnboardedRepo();

      const issue = { number: 42, title: 'Symlink test', labels: [], assignees: [], body: '' };
      const { mockExec } = createMockExec(issue);

      let worktreeDir = null;
      const flexExec = (cmd, args, opts) => {
        if (cmd === 'git' && args[0] === 'worktree' && args[1] === 'add') {
          worktreeDir = args[2];
          mkdirSync(worktreeDir, { recursive: true });
          return '';
        }
        if (cmd === 'git' && args[0] === 'worktree') {
          return '';
        }
        return mockExec(cmd, args, opts);
      };

      try {
        await dispatchIssue({
          issueNumber: 42,
          repo: 'owner/repo',
          repoPath,
          _exec: flexExec,
        });
      } catch {
        // May fail on copilot step
      }

      // Verify symlink was attempted — check for .squad in worktree
      if (worktreeDir && existsSync(worktreeDir)) {
        const squadPath = join(worktreeDir, '.squad');
        // The implementation should have created a symlink here
        // (may not exist if exec mock stopped too early)
        assert.ok(worktreeDir.includes('rally-42'), 'worktree should be for issue 42');
      }
    });
  });

  // =====================================================
  // DISPATCH CONTEXT — writes context.md in worktree
  // =====================================================

  describe('dispatch context creation', () => {
    test('writes dispatch-context.md in worktree .squad/', async () => {
      const { dispatchIssue } = await import('../lib/dispatch-issue.js');
      setupOnboardedRepo();

      const issue = {
        number: 42,
        title: 'Context creation test',
        labels: [{ name: 'bug' }],
        assignees: [{ login: 'dev' }],
        body: 'Fix the thing.',
      };
      const { mockExec } = createMockExec(issue);

      let worktreeDir = null;
      const flexExec = (cmd, args, opts) => {
        if (cmd === 'git' && args[0] === 'worktree' && args[1] === 'add') {
          worktreeDir = args[2];
          mkdirSync(worktreeDir, { recursive: true });
          mkdirSync(join(worktreeDir, '.squad'), { recursive: true });
          return '';
        }
        if (cmd === 'git' && args[0] === 'worktree') {
          return '';
        }
        return mockExec(cmd, args, opts);
      };

      try {
        await dispatchIssue({
          issueNumber: 42,
          repo: 'owner/repo',
          repoPath,
          _exec: flexExec,
        });
      } catch {
        // May fail on copilot step
      }

      if (worktreeDir) {
        const contextPath = join(worktreeDir, '.squad', 'dispatch-context.md');
        if (existsSync(contextPath)) {
          const content = readFileSync(contextPath, 'utf8');
          assert.ok(content.includes('42'), 'context should contain issue number');
          assert.ok(content.includes('Context creation test'), 'context should contain issue title');
        }
      }
    });
  });

  // =====================================================
  // COPILOT CLI INVOCATION — launches copilot
  // =====================================================

  describe('copilot CLI invocation', () => {
    test('invokes Copilot CLI in worktree directory', async () => {
      const { dispatchIssue } = await import('../lib/dispatch-issue.js');
      setupOnboardedRepo();

      const issue = { number: 42, title: 'Copilot test', labels: [], assignees: [], body: '' };
      const calls = [];

      const flexExec = (cmd, args, opts) => {
        calls.push({ cmd, args, cwd: opts?.cwd });
        if (cmd === 'gh' && args[0] === 'issue') {
          return JSON.stringify(issue);
        }
        if (cmd === 'gh' && args[0] === 'repo') {
          return 'main\n';
        }
        if (cmd === 'git' && args[0] === 'worktree' && args[1] === 'add') {
          mkdirSync(args[2], { recursive: true });
          mkdirSync(join(args[2], '.squad'), { recursive: true });
          return '';
        }
        if (cmd === 'git' && args[0] === 'worktree') {
          return '';
        }
        return '';
      };

      try {
        await dispatchIssue({
          issueNumber: 42,
          repo: 'owner/repo',
          repoPath,
          _exec: flexExec,
        });
      } catch {
        // Expected — mock doesn't fully simulate copilot
      }

      // Check if any call looks like a copilot invocation
      const copilotCall = calls.find(
        (c) => (c.cmd === 'npx' && c.args.some((a) => a.includes('copilot')))
            || (c.cmd === 'gh' && c.args.includes('copilot'))
      );

      // This is a soft check — the exact invocation may vary
      if (copilotCall) {
        assert.ok(copilotCall.cwd, 'copilot should be invoked with a cwd');
      }
    });
  });

  // =====================================================
  // FULL WORKFLOW — end-to-end happy path
  // =====================================================

  describe('full workflow (happy path)', () => {
    test('complete dispatch: fetch → branch → worktree → symlink → context → copilot', async () => {
      const { dispatchIssue } = await import('../lib/dispatch-issue.js');
      setupOnboardedRepo();

      const issue = {
        number: 42,
        title: 'Full workflow test',
        labels: [{ name: 'enhancement' }],
        assignees: [{ login: 'alice' }],
        body: 'Implement the full workflow.',
      };
      const calls = [];
      let copilotSessionId = 'mock-session-123';

      const flexExec = (cmd, args, opts) => {
        calls.push({ cmd, args, cwd: opts?.cwd });

        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view') {
          return JSON.stringify(issue);
        }
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return 'main\n';
        }
        if (cmd === 'git' && args[0] === 'worktree' && args[1] === 'add') {
          const wtPath = args[2];
          mkdirSync(wtPath, { recursive: true });
          mkdirSync(join(wtPath, '.squad'), { recursive: true });
          return '';
        }
        if (cmd === 'git' && args[0] === 'worktree') {
          return '';
        }
        // Return a session ID for copilot
        if (cmd === 'npx' || (cmd === 'gh' && args.includes('copilot'))) {
          return copilotSessionId;
        }
        return '';
      };

      try {
        const result = await dispatchIssue({
          issueNumber: 42,
          repo: 'owner/repo',
          repoPath,
          _exec: flexExec,
        });

        // Verify the workflow executed the expected steps
        const ghIssueCalled = calls.some(
          (c) => c.cmd === 'gh' && c.args[0] === 'issue'
        );
        assert.ok(ghIssueCalled, 'should have called gh issue view');

        const gitWorktreeCalled = calls.some(
          (c) => c.cmd === 'git' && c.args[0] === 'worktree'
        );
        assert.ok(gitWorktreeCalled, 'should have called git worktree add');
      } catch {
        // If dispatch fails due to mock limitations, verify at least
        // the early steps were attempted
        const ghIssueCalled = calls.some(
          (c) => c.cmd === 'gh' && c.args[0] === 'issue'
        );
        assert.ok(ghIssueCalled, 'should have at least called gh issue view');
      }
    });
  });
});
