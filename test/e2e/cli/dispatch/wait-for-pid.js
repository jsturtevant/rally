/**
 * Wait for a dispatch PID to exit without refreshing dispatch status.
 * Usage: node wait-for-pid.js <dispatch-id> [timeout_secs]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { isPidAlive } from '../../../../lib/utils.js';

const [dispatchId, timeoutArg = '120'] = process.argv.slice(2);
const rallyHome = process.env.RALLY_HOME;

if (!dispatchId || !rallyHome) {
  console.error('Usage: node wait-for-pid.js <dispatch-id> [timeout_secs]');
  console.error('RALLY_HOME must be set');
  process.exit(1);
}

const timeoutSecs = Number.parseInt(timeoutArg, 10);
if (!Number.isFinite(timeoutSecs) || timeoutSecs <= 0) {
  console.error('Invalid timeout: must be a positive number');
  process.exit(1);
}

const interval = 2000;
const deadline = Date.now() + (timeoutSecs * 1000);
let sawDispatch = false;
let lastError = null;
let lastPid = null;

while (Date.now() < deadline) {
  try {
    const activeYaml = readFileSync(join(rallyHome, 'active.yaml'), 'utf8');
    const active = yaml.load(activeYaml, { schema: yaml.CORE_SCHEMA });
    const raw = active?.dispatches ?? active;
    const dispatches = Array.isArray(raw) ? raw : [];
    const dispatch = dispatches.find(candidate => candidate.id === dispatchId);

    if (!dispatch) {
      if (sawDispatch) {
        console.log('dispatch cleaned');
        process.exit(0);
      }

      lastError = new Error(`Dispatch not found: ${dispatchId}`);
      await new Promise(resolve => setTimeout(resolve, interval));
      continue;
    }

    sawDispatch = true;

    const pid = Number(dispatch.pid ?? dispatch.session_id);
    if (!Number.isFinite(pid) || pid <= 0) {
      lastError = new Error(`Dispatch ${dispatchId} does not have a valid PID`);
      await new Promise(resolve => setTimeout(resolve, interval));
      continue;
    }

    lastPid = pid;
    lastError = null;

    if (!isPidAlive(pid)) {
      console.log('pid exited');
      process.exit(0);
    }
  } catch (err) {
    lastError = err;
  }

  await new Promise(resolve => setTimeout(resolve, interval));
}

console.error(
  `Timed out after ${timeoutSecs}s waiting for ${dispatchId}${lastPid ? ` (last PID ${lastPid})` : ''}`
);
if (lastError) {
  console.error(`Last error: ${lastError.message}`);
}
process.exit(1);
