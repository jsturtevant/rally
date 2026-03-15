/**
 * Verify dispatch appears in dashboard JSON.
 * Usage: node verify-dispatch.js <dispatch-id> <type>
 * Reads RALLY_HOME from env, runs rally dashboard --json, checks fields.
 */
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RALLY_BIN = join(__dirname, '..', '..', '..', '..', 'bin', 'rally.js');
const [dispatchId, expectedType] = process.argv.slice(2);

const output = execFileSync(process.execPath, [RALLY_BIN, 'dashboard', '--json'], {
  encoding: 'utf8',
  timeout: 30000,
  env: { ...process.env, NO_COLOR: '1' },
});

const data = JSON.parse(output);
const dispatch = data.dispatches.find(d => d.id === dispatchId);

if (!dispatch) {
  console.error('Dispatch ' + dispatchId + ' not found in dashboard JSON');
  console.error('Available: ' + (data.dispatches.map(d => d.id).join(', ') || '(none)'));
  process.exit(1);
}

const checks = [
  ['id', dispatch.id, dispatchId],
  ['type', dispatch.type, expectedType],
  ['repo', dispatch.repo, 'jsturtevant/rally-test-fixtures'],
];

let ok = true;
for (const [field, actual, expected] of checks) {
  if (actual === expected) {
    console.log('✓ ' + field + ': ' + actual);
  } else {
    console.log('✗ ' + field + ': expected ' + expected + ', got ' + actual);
    ok = false;
  }
}

if (!ok) process.exit(1);
