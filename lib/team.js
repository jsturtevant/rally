import { getPersonalSquadRoot, personalSquadExists } from './squad-sdk.js';

/**
 * Select the team directory for onboarding.
 * Always uses the personal squad — no prompts.
 *
 * @param {object} options
 * @param {string} [options.team] - Team name (for backwards compatibility, ignored)
 * @param {object} [options._chalk] - Injectable chalk instance (for testing)
 * @param {Function} [options._personalSquadExists] - Injectable personalSquadExists (for testing)
 * @param {Function} [options._getPersonalSquadRoot] - Injectable getPersonalSquadRoot (for testing)
 * @returns {Promise<{ teamDir: string, teamType: string }>}
 */
export async function selectTeam(options = {}) {
  const _personalSquadExists = options._personalSquadExists || personalSquadExists;
  const _getPersonalSquadRoot = options._getPersonalSquadRoot || getPersonalSquadRoot;

  // Always use the personal squad (shared team)
  if (!_personalSquadExists()) {
    throw new Error('Personal squad not found. Create one with: npx @anthropic/squad init');
  }
  const sharedTeamDir = _getPersonalSquadRoot();
  return { teamDir: sharedTeamDir, teamType: 'shared' };
}
