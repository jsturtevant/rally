import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getCopilotInstructions, writeCopilotInstructions } from '../lib/copilot-instructions.js';

// =====================================================
// getCopilotInstructions
// =====================================================

describe('getCopilotInstructions', () => {
  test('returns a non-empty string', () => {
    const content = getCopilotInstructions();
    assert.ok(typeof content === 'string');
    assert.ok(content.length > 0);
  });

  test('includes read-only policy header', () => {
    const content = getCopilotInstructions();
    assert.ok(content.includes('Read-Only Policy'));
  });

  test('prohibits gh pr create', () => {
    const content = getCopilotInstructions();
    assert.ok(content.includes('gh pr create'));
  });

  test('prohibits git push', () => {
    const content = getCopilotInstructions();
    assert.ok(content.includes('git push'));
  });

  test('prohibits gh issue close', () => {
    const content = getCopilotInstructions();
    assert.ok(content.includes('gh issue close'));
  });

  test('prohibits MCP tools that modify external state', () => {
    const content = getCopilotInstructions();
    assert.ok(content.includes('MCP'));
  });

  test('allows local code changes', () => {
    const content = getCopilotInstructions();
    assert.ok(content.includes('local code changes'));
  });

  test('allows gh issue view (read-only)', () => {
    const content = getCopilotInstructions();
    assert.ok(content.includes('gh issue view'));
  });
});

// =====================================================
// writeCopilotInstructions
// =====================================================

describe('writeCopilotInstructions', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rally-copilot-inst-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('creates .github/ directory if it does not exist', () => {
    writeCopilotInstructions(tempDir);
    assert.ok(existsSync(join(tempDir, '.github')));
  });

  test('writes copilot-instructions.md into .github/', () => {
    writeCopilotInstructions(tempDir);
    const filePath = join(tempDir, '.github', 'copilot-instructions.md');
    assert.ok(existsSync(filePath));
  });

  test('written file contains read-only policy', () => {
    writeCopilotInstructions(tempDir);
    const filePath = join(tempDir, '.github', 'copilot-instructions.md');
    const content = readFileSync(filePath, 'utf8');
    assert.ok(content.includes('Read-Only Policy'));
    assert.ok(content.includes('git push'));
  });

  test('handles pre-existing .github directory', () => {
    mkdirSync(join(tempDir, '.github'), { recursive: true });
    writeCopilotInstructions(tempDir);
    const filePath = join(tempDir, '.github', 'copilot-instructions.md');
    assert.ok(existsSync(filePath));
  });

  test('throws when worktreePath is falsy', () => {
    assert.throws(
      () => writeCopilotInstructions(''),
      { message: /worktreePath is required/ }
    );
    assert.throws(
      () => writeCopilotInstructions(null),
      { message: /worktreePath is required/ }
    );
  });

  test('throws when worktreePath does not exist on disk', () => {
    assert.throws(
      () => writeCopilotInstructions('/nonexistent/path/that/does/not/exist'),
      { message: /worktreePath does not exist/ }
    );
  });

  test('throws when .github exists but is not a directory', () => {
    writeFileSync(join(tempDir, '.github'), 'not a directory');
    assert.throws(
      () => writeCopilotInstructions(tempDir),
      { message: /\.github exists but is not a directory/ }
    );
  });

  test('uses injectable _fs', () => {
    const calls = { mkdir: [], write: [], exists: [], stat: [] };
    const mockFs = {
      existsSync: (p) => { calls.exists.push(p); return p.includes('.github') ? false : true; },
      statSync: (p) => { calls.stat.push(p); return { isDirectory: () => true }; },
      mkdirSync: (p, opts) => { calls.mkdir.push({ p, opts }); },
      writeFileSync: (p, content, enc) => { calls.write.push({ p, content, enc }); },
    };

    writeCopilotInstructions('/fake/worktree', { _fs: mockFs });

    assert.strictEqual(calls.mkdir.length, 1);
    assert.ok(calls.mkdir[0].p.includes('.github'));
    assert.strictEqual(calls.write.length, 1);
    assert.ok(calls.write[0].p.includes('copilot-instructions.md'));
    assert.ok(calls.write[0].content.includes('Read-Only Policy'));
  });
});
