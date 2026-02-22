import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

describe('rally CLI', () => {
  it('should show version', () => {
    const output = execSync('node bin/rally.js --version', { encoding: 'utf8' });
    assert.match(output.trim(), /0\.1\.0/);
  });
  
  it('should show help', () => {
    const output = execSync('node bin/rally.js --help', { encoding: 'utf8' });
    assert.match(output, /Dispatch Squad teams/);
  });
});
