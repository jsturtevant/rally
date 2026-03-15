/**
 * Poll rally dispatch refresh until a dispatch's status changes from "implementing".
 * Usage: node wait-for-dispatch.js <dispatch-id> [timeout_secs]
 *
 * Reads RALLY_HOME from env. Runs rally dispatch refresh, then checks active.yaml.
 * Exits 0 when status is no longer "implementing", prints the new status.
 * Exits 1 on timeout.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RALLY_BIN = join(__dirname, '..', '..', '..', '..', 'bin', 'rally.js');
const dispatchId = process.argv[2];
const timeoutSecs = parseInt(process.argv[3] || '120', 10);
const rallyHome = process.env.RALLY_HOME;

if (!dispatchId || !rallyHome) {
  console.error('Usage: node wait-for-dispatch.js <dispatch-id> [timeout_secs]');
  console.error('RALLY_HOME must be set');
  process.exit(1);
}

const interval = 3000;
const deadline = Date.now() + (timeoutSecs * 1000);

while (Date.now() < deadline) {
  // Run rally dispatch refresh to update statuses
  try {
    execFileSync(process.execPath, [RALLY_BIN, 'dispatch', 'refresh'], {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, NO_COLOR: '1' },
    });
  } catch {
    // refresh might fail if no dispatches — continue
  }

  // Read active.yaml and check status
  try {
    const activeYaml = readFileSync(join(rallyHome, 'active.yaml'), 'utf8');
    const active = yaml.load(activeYaml, { schema: yaml.CORE_SCHEMA });
    const dispatches = active?.dispatches || active || [];
    const dispatch = dispatches.find(d => d.id === dispatchId);

    if (!dispatch) {
      console.log('cleaned');
      process.exit(0);
    }

    if (dispatch.status !== 'implementing') {
      console.log(dispatch.status);
      process.exit(0);
    }
  } catch {
    // active.yaml might not exist yet
  }

  await new Promise(r => setTimeout(r, interval));
}

console.error(`Timed out after ${timeoutSecs}s waiting for ${dispatchId} to finish implementing`);
process.exit(1);
