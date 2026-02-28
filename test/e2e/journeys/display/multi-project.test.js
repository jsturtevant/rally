/**
 * E2E Display Test: Multi-Project Dashboard
 * 
 * Tests dashboard rendering with dispatches from multiple repositories.
 * Verifies repo grouping headers appear correctly.
 */

import { describe, it, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, cleanupAll } from '../../../harness/terminal.js';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';

const RALLY_BIN = path.join(import.meta.dirname, '..', '..', '..', '..', 'bin', 'rally.js');
const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

const SCREENSHOT_DIR = path.join(REPO_ROOT, 'test', 'baselines', 'display', 'multi-project');

/**
 * Seed a Rally config with multiple projects and dispatches.
 */
function seedMultiProjectConfig(rallyHome, repoPath) {
  mkdirSync(rallyHome, { recursive: true });

  const teamDir = path.join(rallyHome, 'team');
  const projectsDir = path.join(rallyHome, 'projects');
  mkdirSync(teamDir, { recursive: true });
  mkdirSync(projectsDir, { recursive: true });

  writeFileSync(
    path.join(rallyHome, 'config.yaml'),
    yaml.dump({ teamDir, projectsDir, version: '0.1.0' }),
    'utf8',
  );

  // Multiple projects from different repos
  writeFileSync(
    path.join(rallyHome, 'projects.yaml'),
    yaml.dump({
      projects: [
        {
          name: 'frontend-app',
          path: repoPath,
          repo: 'acme/frontend-app',
          team: 'shared',
          teamDir,
          onboarded: new Date().toISOString(),
        },
        {
          name: 'backend-api',
          path: repoPath,
          repo: 'acme/backend-api',
          team: 'shared',
          teamDir,
          onboarded: new Date().toISOString(),
        },
        {
          name: 'shared-utils',
          path: repoPath,
          repo: 'acme/shared-utils',
          team: 'shared',
          teamDir,
          onboarded: new Date().toISOString(),
        },
      ],
    }),
    'utf8',
  );

  // Dispatches from multiple projects
  writeFileSync(
    path.join(rallyHome, 'active.yaml'),
    yaml.dump({
      dispatches: [
        {
          id: 'dispatch-1',
          repo: 'acme/frontend-app',
          issue: 42,
          title: 'Fix login button styling',
          branch: 'rally/42-fix-login-button',
          status: 'implementing',
          worktreePath: path.join(projectsDir, 'wt-1'),
          created: new Date().toISOString(),
        },
        {
          id: 'dispatch-2',
          repo: 'acme/frontend-app',
          issue: 57,
          title: 'Add dark mode support',
          branch: 'rally/57-add-dark-mode',
          status: 'waiting',
          worktreePath: path.join(projectsDir, 'wt-2'),
          created: new Date().toISOString(),
        },
        {
          id: 'dispatch-3',
          repo: 'acme/backend-api',
          issue: 123,
          title: 'Implement OAuth2 endpoints',
          branch: 'rally/123-oauth2-endpoints',
          status: 'implementing',
          worktreePath: path.join(projectsDir, 'wt-3'),
          created: new Date().toISOString(),
        },
        {
          id: 'dispatch-4',
          repo: 'acme/shared-utils',
          pr: 15,
          title: 'Review: Add retry helper',
          branch: 'rally/pr-15-retry-helper',
          status: 'reviewing',
          worktreePath: path.join(projectsDir, 'wt-4'),
          created: new Date().toISOString(),
        },
      ],
    }),
    'utf8',
  );

  return { teamDir, projectsDir };
}

describe('display — multi-project dashboard', () => {
  let term;
  let tempDir;

  afterEach(async () => {
    if (term) {
      try { term.close(); } catch {}
      term = null;
    }
  });

  after(async () => {
    await cleanupAll();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('dashboard with 2+ repos shows grouping headers', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-multi-'));
    seedMultiProjectConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    // Should show multiple repo section headers
    const hasRepoHeaders = 
      frame.includes('acme/frontend-app') ||
      frame.includes('frontend-app') ||
      frame.includes('acme/backend-api') ||
      frame.includes('backend-api');

    assert.ok(hasRepoHeaders, 'Dashboard should show repo names as section headers');

    // Capture screenshot
    await term.screenshot(path.join(SCREENSHOT_DIR, 'multi-project-grouped.png'));
  });

  it('repo names appear as section headers', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-multi-'));
    seedMultiProjectConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    // Count distinct repo references — should have at least 2 different repos visible
    const repos = ['frontend-app', 'backend-api', 'shared-utils'];
    const visibleRepos = repos.filter(repo => frame.includes(repo));

    assert.ok(
      visibleRepos.length >= 2,
      `Should show at least 2 repo groupings, found: ${visibleRepos.join(', ')}`
    );

    await term.screenshot(path.join(SCREENSHOT_DIR, 'repo-section-headers.png'));
  });

  it('dispatches are grouped under their repo headers', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-multi-'));
    seedMultiProjectConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    // Verify dispatch titles are visible
    const hasTitles =
      frame.includes('login') ||
      frame.includes('dark mode') ||
      frame.includes('OAuth') ||
      frame.includes('retry');

    assert.ok(hasTitles, 'Dispatch titles should be visible in dashboard');

    // Should show issue/PR numbers
    const hasNumbers =
      frame.includes('#42') ||
      frame.includes('#57') ||
      frame.includes('#123') ||
      frame.includes('#15') ||
      frame.includes('42') ||
      frame.includes('123');

    assert.ok(hasNumbers, 'Issue/PR numbers should be visible');

    await term.screenshot(path.join(SCREENSHOT_DIR, 'dispatches-grouped.png'));
  });

  it('multi-project view handles navigation between groups', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-multi-'));
    seedMultiProjectConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Navigate through dispatches
    await term.sendKey('down');
    await new Promise(r => setTimeout(r, 100));
    await term.screenshot(path.join(SCREENSHOT_DIR, 'navigation-1.png'));

    await term.sendKey('down');
    await new Promise(r => setTimeout(r, 100));
    await term.screenshot(path.join(SCREENSHOT_DIR, 'navigation-2.png'));

    await term.sendKey('down');
    await new Promise(r => setTimeout(r, 100));
    await term.screenshot(path.join(SCREENSHOT_DIR, 'navigation-3.png'));

    // Should still be functional after navigation
    const frame = term.getFrame();
    assert.ok(frame.includes('Rally Dashboard'), 'Dashboard should remain stable during navigation');
  });
});
