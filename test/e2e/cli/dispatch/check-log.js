/**
 * Verify a dispatch log contains the Copilot completion marker.
 * Usage: node check-log.js <dispatch-id>
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

const dispatchId = process.argv[2];
const rallyHome = process.env.RALLY_HOME;

if (!dispatchId || !rallyHome) {
  console.error('Usage: node check-log.js <dispatch-id>');
  console.error('RALLY_HOME must be set');
  process.exit(1);
}

try {
  const activeYaml = readFileSync(join(rallyHome, 'active.yaml'), 'utf8');
  const active = yaml.load(activeYaml, { schema: yaml.CORE_SCHEMA });
  const raw = active?.dispatches ?? active;
  const dispatches = Array.isArray(raw) ? raw : [];
  const dispatch = dispatches.find(candidate => candidate.id === dispatchId);

  if (!dispatch) {
    console.error(`Dispatch not found: ${dispatchId}`);
    process.exit(1);
  }

  if (!dispatch.logPath) {
    console.error(`Dispatch ${dispatchId} does not have a logPath`);
    process.exit(1);
  }

  const content = readFileSync(dispatch.logPath, 'utf8');
  if (!content.includes('Total session time:')) {
    console.error(`Completion marker not found in ${dispatch.logPath}`);
    process.exit(1);
  }

  console.log('log complete');
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
