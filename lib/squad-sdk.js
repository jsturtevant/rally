/**
 * Squad SDK exports
 *
 * This module re-exports the Squad SDK functions used by Rally.
 * The SDK is installed as a monorepo, so we import from the subpackage path.
 */

// Import from the built SDK subpackage
import {
  initSquad,
  setupConsultMode,
  extractLearnings,
  resolveGlobalSquadPath,
  getPersonalSquadRoot,
  ensureSquadPath,
  isConsultMode
} from '@bradygaster/squad/packages/squad-sdk/dist/index.js';

export {
  initSquad,
  setupConsultMode,
  extractLearnings,
  resolveGlobalSquadPath,
  getPersonalSquadRoot,
  ensureSquadPath,
  isConsultMode
};
