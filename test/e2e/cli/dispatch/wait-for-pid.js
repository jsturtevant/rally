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

function readDispatch(dispatchIdToFind) {
  const activeYaml = readFileSync(join(rallyHome, 'active.yaml'), 'utf8');
  const active = yaml.load(activeYaml, { schema: yaml.CORE_SCHEMA });
  const raw = active?.dispatches ?? active;
  const dispatches = Array.isArray(raw) ? raw : [];
  return dispatches.find(dispatch => dispatch.id === dispatchIdToFind);
}

let dispatch;
try {
  dispatch = readDispatch(dispatchId);
} catch (err) {
  console.error(`Failed to read active.yaml: ${err.message}`);
  process.exit(1);
}

if (!dispatch) {
  console.error(`Dispatch not found: ${dispatchId}`);
  process.exit(1);
}

const pid = Number(dispatch.pid ?? dispatch.session_id);
if (!Number.isFinite(pid) || pid <= 0) {
  console.error(`Dispatch ${dispatchId} does not have a valid PID`);
  process.exit(1);
}

const deadline = Date.now() + (timeoutSecs * 1000);
while (Date.now() < deadline) {
  if (!isPidAlive(pid)) {
    console.log('pid exited');
    process.exit(0);
  }

  await new Promise(resolve => setTimeout(resolve, 2000));
}

console.error(`Timed out after ${timeoutSecs}s waiting for PID ${pid} from ${dispatchId}`);
process.exit(1);
