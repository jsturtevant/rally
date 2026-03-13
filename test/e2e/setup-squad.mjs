/**
 * Setup script for e2e tests: creates a personal squad using the SDK.
 * Called by the runner when frontmatter has `setup: squad`.
 *
 * Expects XDG_CONFIG_HOME to be set to an isolated temp directory.
 */
import { initSquad, resolveGlobalSquadPath } from '@bradygaster/squad-sdk';

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

console.log(`✓ Personal squad created at ${globalPath}`);
