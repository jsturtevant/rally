---
title: Testing Guide
description: How to run and write tests for Rally
---

Rally uses Node.js's built-in test runner (`node:test`) and strict assertions (`node:assert/strict`) for all testing. This aligns with Rally's philosophy of using production-quality dependencies and avoiding external test frameworks.

## Test Philosophy

Rally's testing strategy follows these core principles:

1. **Error paths before happy paths** — Every test suite starts with error cases
2. **Assume every input is wrong** — Test invalid inputs, missing arguments, malformed data
3. **Exit codes matter** — Tests verify stderr output AND exit codes
4. **Isolation** — Every test runs in a clean environment with no shared state
5. **No mocking libraries** — Use `node:test`'s built-in mock module

## Running Tests

### Run all tests

```bash
npm test
```

This runs three steps:
1. **JSX pre-build** — Compiles `.jsx` UI components to `.js` via esbuild
2. **Non-UI tests** — Runs all unit/integration tests in `test/*.test.js`
3. **UI tests** — Runs Ink component tests in `test/ui/*.test.js`

### Run E2E tests

```bash
npm run test:e2e
```

End-to-end tests validate the full CLI workflow with real git operations.

### Run all tests (unit + E2E)

```bash
npm run test:all
```

### Run a single test file

```bash
node --test test/setup.test.js
```

### Run with coverage (Node 20+)

```bash
node --test --experimental-test-coverage ./test/*.test.js
```

### Watch mode (Node 20+)

```bash
node --test --watch ./test/*.test.js
```

## Test Structure

### Test Organization

Tests are organized to mirror the module structure:

```
lib/setup.js        → test/setup.test.js
lib/onboard.js      → test/onboard.test.js
lib/dispatch.js     → test/dispatch.test.js
lib/config.js       → test/config.js
lib/worktree.js     → test/worktree.test.js
lib/ui/components/StatusMessage.jsx → test/ui/StatusMessage.test.js
```

### Test Categories

- **Unit tests** (`test/*.test.js`) — Test individual modules and functions
- **UI tests** (`test/ui/*.test.js`) — Test Ink React components
- **E2E tests** (`test/e2e/*.test.js`) — Test the full CLI as a subprocess, organized by:
  - `cli/` — CLI command behavior (help, status, sessions, onboard)
  - `journeys/actions/` — User actions (clean, remove, continue, view-log, open-browser)
  - `journeys/navigation/` — Dashboard navigation (selection, help, refresh)
  - `journeys/lifecycle/` — Dispatch lifecycle (complete, cancel)
  - `journeys/display/` — UI display logic (empty-state, truncation, status-icons, column-widths)
  - `journeys/dispatch/` — Dispatch workflows (issue)

## Test Framework Stack

| Component | Tool | Purpose |
|-----------|------|---------|
| Test runner | `node:test` | Built-in Node.js test runner (Node 18+) |
| Assertions | `node:assert/strict` | Strict equality, deep equality, throws checks |
| Mocking | `node:test` mock module | Mock `fs`, `child_process`, environment |
| UI testing | `ink-testing-library` | Render Ink components, query output, simulate input |
| Fixtures | `fs.mkdtempSync()` | Temporary directories for git operations |

## Writing Tests

### Basic Test Structure

All tests use ESM imports:

```javascript
import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from '../lib/setup.js';

describe('setup', () => {
  test('creates Rally directories when missing', () => {
    // Test implementation
  });

  test('returns true when setup was needed', () => {
    // Test implementation
  });
});
```

### Mocking Child Processes

Rally shells out to `git`, `gh`, and `npx`. Tests mock `execFileSync` and `execSync`:

```javascript
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('dispatch: fetch issue metadata', (t) => {
  mock.method(execFileSync, 'default', (cmd, args) => {
    if (cmd === 'gh' && args[0] === 'issue') {
      return JSON.stringify({
        number: 42,
        title: 'Add user authentication',
        labels: ['enhancement']
      });
    }
    throw new Error(`Unexpected command: ${cmd}`);
  });

  // Test code that calls gh
});
```

### Mocking Filesystem

Config operations and symlink creation use `fs` operations. Tests mock `fs` methods:

```javascript
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('config: read missing config file', (t) => {
  mock.method(fs, 'readFileSync', (path) => {
    const err = new Error('ENOENT');
    err.code = 'ENOENT';
    throw err;
  });

  assert.throws(() => readConfig(), { code: 'ENOENT' });
});
```

### Temporary Directories for Git Tests

Integration tests that need real git repositories use temporary directories:

```javascript
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

test('worktree: create and remove', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-test-'));
  
  t.after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Initialize a real git repo
  execFileSync('git', ['init'], { cwd: tmpDir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: tmpDir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmpDir });
  
  // Test worktree operations
});
```

### Environment Helpers

Rally provides test helpers for managing temporary environments:

```javascript
import { withTempRallyHome } from './helpers/temp-env.js';

test('creates config in RALLY_HOME', (t) => {
  const tempDir = withTempRallyHome(t);
  // tempDir is now set as RALLY_HOME and will be cleaned up automatically
});
```

## Testing Ink Components

### Basic Component Testing

```javascript
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import StatusMessage from '../../lib/ui/components/StatusMessage.js';

afterEach(() => { cleanup(); });

describe('StatusMessage', () => {
  it('renders success with green checkmark', () => {
    const { lastFrame } = render(
      React.createElement(StatusMessage, { type: 'success' }, 'Done')
    );
    const output = lastFrame();
    assert.ok(output.includes('✓'), 'should include ✓ icon');
    assert.ok(output.includes('Done'), 'should include children text');
  });
});
```

### Testing Interactive Components

For components with keyboard navigation, use `stdin` to simulate keypresses:

```javascript
test('Dashboard: arrow keys navigate', async () => {
  const { lastFrame, stdin } = render(
    React.createElement(Dashboard, { dispatches: mockDispatches })
  );
  
  stdin.write('\x1B[B'); // Down arrow (ANSI escape sequence)
  await new Promise(resolve => setTimeout(resolve, 100)); // Wait for re-render
  
  // Assert expected selection change
});
```

## Dependency Injection

Rally functions accept injectable dependencies via underscore-prefixed parameters for testing:

```javascript
await dispatchIssue({
  number: 42,
  _exec: mock.fn(() => JSON.stringify({ title: 'Fix bug' })),
});
```

This avoids mocking global modules and keeps tests isolated.

## Coverage Goals

- **Minimum coverage:** 80% across all modules
- **Priority:** Error paths over happy paths
- High-priority modules (`config.js`, `symlink.js`, `exclude.js`) target 90%+

### Measuring Coverage

```bash
node --test --experimental-test-coverage ./test/*.test.js
```

Output shows line, branch, and function coverage per file.

## CI Integration

All tests run on every PR via GitHub Actions (`.github/workflows/test.yml`):

1. **All tests must pass** — Zero tolerance for failing tests on PR branches
2. **Coverage must be ≥80%** — PRs that drop coverage below threshold are blocked
3. **Platform** — Tests run on Linux (Ubuntu) in CI; Windows/macOS testing is manual QA

## Common Patterns

### Test Naming

Use descriptive names that explain the behavior or error condition:

```javascript
// Good
test('dispatch: error when issue not found', () => { /* ... */ });
test('config: parse valid YAML with all keys', () => { /* ... */ });

// Bad
test('test1', () => { /* ... */ });
test('dispatch works', () => { /* ... */ });
```

### Cleanup in `t.after()`

Always clean up resources to avoid polluting subsequent test runs:

```javascript
test('example test', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-test-'));
  
  t.after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
  
  // Test code...
});
```

### Environment Restoration

When mutating global state, restore it manually:

```javascript
test('platform detection', (t) => {
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'win32' });
  
  t.after(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });
  
  // Test code...
});
```

## TDD Workflow

For every new command or module:

1. **Write error case tests first** — List all failure modes
2. **Run tests (all fail)** — Red phase
3. **Implement minimal code to pass one test** — Green phase
4. **Refactor** — Clean up implementation
5. **Repeat** for next error case
6. **Write happy path tests last** — After error handling is solid

---

**Philosophy:** Test the unhappy path first. Assume every input is wrong. Verify exit codes and stderr, not just stdout. Break things on purpose so they don't break by accident.
