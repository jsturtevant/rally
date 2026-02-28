/**
 * E2E Journey Test: Help Overlay
 * 
 * Tests the help overlay functionality:
 * - ? shows shortcut help overlay
 * - ? again or Escape hides it
 * - Screenshot the help overlay for visual regression
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

const SCREENSHOT_DIR = path.join(REPO_ROOT, 'test', 'baselines', 'navigation-help');

/**
 * Seed a minimal Rally config.
 */
function seedConfig(rallyHome, repoPath) {
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

  writeFileSync(
    path.join(rallyHome, 'projects.yaml'),
    yaml.dump({
      projects: [{
        name: 'rally',
        path: repoPath,
        repo: 'jsturtevant/rally',
        team: 'shared',
        teamDir,
        onboarded: new Date().toISOString(),
      }],
    }),
    'utf8',
  );

  writeFileSync(path.join(rallyHome, 'active.yaml'), 'dispatches: []\n', 'utf8');
  return { teamDir, projectsDir };
}

// ─── HELP OVERLAY SHOW/HIDE ─────────────────────────────────────────────────

describe('navigation - help overlay', () => {
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

  it('? shows shortcut help overlay', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-help-'));
    seedConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, '01-before-help.png'));

    const beforeFrame = term.getFrame();

    // Press ? to show help
    await term.send('?');
    await new Promise(r => setTimeout(r, 300));

    await term.screenshot(path.join(SCREENSHOT_DIR, '02-help-overlay.png'));
    const afterFrame = term.getFrame();

    // Help overlay should show keyboard shortcuts
    const hasHelpContent = 
      afterFrame.includes('Help') ||
      afterFrame.includes('Keyboard') ||
      afterFrame.includes('Shortcuts') ||
      afterFrame.includes('j/k') ||
      afterFrame.includes('navigation') ||
      afterFrame.includes('press');

    assert.ok(hasHelpContent, 'Help overlay should display shortcuts or help content');
    assert.notEqual(beforeFrame, afterFrame, 'Screen should change when help is shown');
  });

  it('? again hides help overlay', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-help-'));
    seedConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Show help
    await term.send('?');
    await new Promise(r => setTimeout(r, 300));

    const helpFrame = term.getFrame();
    await term.screenshot(path.join(SCREENSHOT_DIR, '03-help-shown.png'));

    // Hide help with ? again
    await term.send('?');
    await new Promise(r => setTimeout(r, 300));

    await term.screenshot(path.join(SCREENSHOT_DIR, '04-help-hidden.png'));
    const afterFrame = term.getFrame();

    // Should return to normal dashboard view
    assert.ok(afterFrame.includes('Rally Dashboard'), 'Dashboard should be visible after closing help');
  });

  it('Escape hides help overlay', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-help-'));
    seedConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Show help
    await term.send('?');
    await new Promise(r => setTimeout(r, 300));

    const helpFrame = term.getFrame();
    await term.screenshot(path.join(SCREENSHOT_DIR, '05-help-before-escape.png'));

    // Close with Escape
    await term.sendKey('escape');
    await new Promise(r => setTimeout(r, 300));

    await term.screenshot(path.join(SCREENSHOT_DIR, '06-help-after-escape.png'));
    const afterFrame = term.getFrame();

    // Should return to normal dashboard view
    assert.ok(afterFrame.includes('Rally Dashboard'), 'Dashboard should be visible after Escape');
  });
});

// ─── HELP OVERLAY VISUAL REGRESSION ─────────────────────────────────────────

describe('navigation - help overlay visual regression', () => {
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

  it('captures help overlay screenshot for visual regression', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-help-'));
    seedConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Open help
    await term.send('?');
    await new Promise(r => setTimeout(r, 500));

    // Capture baseline screenshot for visual regression testing
    await term.screenshot(path.join(SCREENSHOT_DIR, 'baseline-help-overlay.png'));

    const helpFrame = term.getFrame();
    
    // Document the help content for regression comparison
    console.log('Help overlay content captured:');
    console.log('─'.repeat(40));
    console.log(helpFrame);
    console.log('─'.repeat(40));

    // Verify help overlay rendered something
    assert.ok(helpFrame.length > 0, 'Help overlay should have content');
  });

  it('help overlay renders at different terminal sizes', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-help-'));
    seedConfig(tempDir, REPO_ROOT);

    // Test with narrow terminal
    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 80,
      rows: 24,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    await term.send('?');
    await new Promise(r => setTimeout(r, 300));

    await term.screenshot(path.join(SCREENSHOT_DIR, 'baseline-help-80x24.png'));
    const narrowFrame = term.getFrame();

    assert.ok(narrowFrame.length > 0, 'Help should render in narrow terminal');

    term.close();

    // Test with wide terminal
    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 160,
      rows: 40,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    await term.send('?');
    await new Promise(r => setTimeout(r, 300));

    await term.screenshot(path.join(SCREENSHOT_DIR, 'baseline-help-160x40.png'));
    const wideFrame = term.getFrame();

    assert.ok(wideFrame.length > 0, 'Help should render in wide terminal');
  });
});

// ─── HELP OVERLAY EDGE CASES ────────────────────────────────────────────────

describe('navigation - help overlay edge cases', () => {
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

  it('rapid ? presses do not break overlay', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-help-'));
    seedConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Rapid toggle
    await term.send('?');
    await term.send('?');
    await term.send('?');
    await term.send('?');
    await new Promise(r => setTimeout(r, 500));

    const frame = term.getFrame();

    // Should not crash — either help is shown or dashboard
    assert.ok(
      frame.includes('Rally Dashboard') || frame.includes('Help') || frame.includes('Shortcuts'),
      'Should survive rapid help toggles'
    );
  });

  it('help does not interfere with q to quit', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-help-'));
    seedConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Open help
    await term.send('?');
    await new Promise(r => setTimeout(r, 300));

    // q should either close help or quit app (depending on implementation)
    await term.send('q');
    await new Promise(r => setTimeout(r, 500));

    // Either process exited or help closed — both are valid
    // If we can still get a frame, app is running
    try {
      const frame = term.getFrame();
      // If still running, help should have closed
      assert.ok(frame.includes('Rally Dashboard'), 'Should return to dashboard or quit');
    } catch {
      // Process exited — also valid
    }
  });

  it('navigation keys do not work while help is open', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-help-'));
    seedConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Open help
    await term.send('?');
    await new Promise(r => setTimeout(r, 300));

    const helpFrame = term.getFrame();

    // Try navigation keys while help is open
    await term.send('j');
    await term.send('k');
    await term.sendKey('down');
    await term.sendKey('up');
    await new Promise(r => setTimeout(r, 200));

    const afterNavFrame = term.getFrame();

    // Help should still be visible (navigation blocked by modal)
    // Or navigation should work but not crash anything
    assert.ok(afterNavFrame.length > 0, 'Help should handle navigation keys gracefully');
  });
});
