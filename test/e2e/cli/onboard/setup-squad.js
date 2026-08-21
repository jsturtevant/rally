/**
 * Setup script for e2e tests: creates a personal squad using the SDK.
 * Called by the runner when frontmatter has `setup: setup-squad.js`.
 *
 * Expects XDG_CONFIG_HOME to be set to an isolated temp directory.
 */
import { initSquad, resolveGlobalSquadPath } from '@bradygaster/squad-sdk';

import { migrateLegacyPersonalSquad, getPersonalSquadRoot } from '../../../../lib/squad-sdk.js';

const globalPath = resolveGlobalSquadPath();

await initSquad({
  teamRoot: globalPath,
  projectName: 'personal-squad',
  projectDescription: 'E2E test personal squad',
  agents: [
    { name: 'lead', role: 'lead' },
    { name: 'developer', role: 'developer' },
  ],
  configFormat: 'json',
  includeWorkflows: false,
  includeTemplates: false,
  includeMcpConfig: false,
});

// initSquad writes to <teamRoot>/.squad; SDK 0.11+ reads the personal squad
// from <globalDir>/personal-squad, so relocate it the same way Rally does.
migrateLegacyPersonalSquad({ quiet: true });

console.log(`✓ Personal squad created at ${getPersonalSquadRoot()}`);
