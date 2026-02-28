/**
 * E2E CLI Test: Help Command
 * 
 * Tests that help commands work correctly:
 * - rally --help shows usage
 * - Subcommand help works
 */

import { describe, it, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, cleanupAll } from '../../harness/terminal.js';
import path from 'node:path';

const RALLY_BIN = path.join(import.meta.dirname, '..', '..', '..', 'bin', 'rally.js');

describe('CLI — help command', () => {
  let term;

  afterEach(async () => {
    if (term) {
      try { term.close(); } catch {}
      term = null;
    }
  });

  after(async () => {
    await cleanupAll();
  });

  it('rally --help shows usage', { timeout: 15_000 }, async () => {
    term = await spawn(`node ${RALLY_BIN} --help`, { cols: 80, rows: 24 });

    await term.waitFor('Usage:', { timeout: 5_000 });
    const frame = term.getFrame();

    assert.ok(frame.includes('Usage:'), 'should show Usage:');
    assert.ok(frame.includes('rally'), 'should mention rally command');
    assert.ok(frame.includes('dashboard'), 'should list dashboard command');
    assert.ok(frame.includes('onboard'), 'should list onboard command');
    assert.ok(frame.includes('status'), 'should list status command');
  });

  it('rally -h shows same help', { timeout: 15_000 }, async () => {
    term = await spawn(`node ${RALLY_BIN} -h`, { cols: 80, rows: 24 });

    await term.waitFor('Usage:', { timeout: 5_000 });
    const frame = term.getFrame();

    assert.ok(frame.includes('Usage:'), '-h should show Usage:');
    assert.ok(frame.includes('dashboard'), '-h should list dashboard command');
  });

  it('rally onboard --help shows onboard usage', { timeout: 15_000 }, async () => {
    term = await spawn(`node ${RALLY_BIN} onboard --help`, { cols: 80, rows: 24 });

    await term.waitFor('onboard', { timeout: 5_000 });
    const frame = term.getFrame();

    assert.ok(frame.includes('onboard'), 'should show onboard command');
    assert.ok(frame.includes('path') || frame.includes('repo'), 'should mention path or repo argument');
  });

  it('rally dashboard --help shows dashboard usage', { timeout: 15_000 }, async () => {
    term = await spawn(`node ${RALLY_BIN} dashboard --help`, { cols: 80, rows: 24 });

    await term.waitFor('dashboard', { timeout: 5_000 });
    const frame = term.getFrame();

    assert.ok(frame.includes('dashboard'), 'should show dashboard command');
    assert.ok(frame.includes('--json') || frame.includes('active'), 'should show options or description');
  });

  it('rally status --help shows status usage', { timeout: 15_000 }, async () => {
    term = await spawn(`node ${RALLY_BIN} status --help`, { cols: 80, rows: 24 });

    await term.waitFor('status', { timeout: 5_000 });
    const frame = term.getFrame();

    assert.ok(frame.includes('status'), 'should show status command');
  });

  it('rally dispatch --help shows dispatch subcommands', { timeout: 15_000 }, async () => {
    term = await spawn(`node ${RALLY_BIN} dispatch --help`, { cols: 100, rows: 30 });

    await term.waitFor('dispatch', { timeout: 5_000 });
    const frame = term.getFrame();

    assert.ok(frame.includes('dispatch'), 'should show dispatch command');
    assert.ok(frame.includes('issue') || frame.includes('pr') || frame.includes('branch'), 
      'should list dispatch subcommands');
  });

  it('rally --version shows version', { timeout: 15_000 }, async () => {
    term = await spawn(`node ${RALLY_BIN} --version`, { cols: 80, rows: 24 });

    await new Promise(r => setTimeout(r, 1000));
    const frame = term.getFrame();

    // Should show a version number like "0.1.0" or similar
    assert.ok(/\d+\.\d+\.\d+/.test(frame), 'should show version number');
  });

  it('rally -V shows version', { timeout: 15_000 }, async () => {
    term = await spawn(`node ${RALLY_BIN} -V`, { cols: 80, rows: 24 });

    await new Promise(r => setTimeout(r, 1000));
    const frame = term.getFrame();

    assert.ok(/\d+\.\d+\.\d+/.test(frame), '-V should show version number');
  });
});
