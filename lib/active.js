import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { getConfigDir, readActive, atomicWrite } from './config.js';

const VALID_STATUSES = ['planning', 'implementing', 'reviewing', 'done', 'cleaned'];

const REQUIRED_FIELDS = ['id', 'repo', 'number', 'type', 'branch', 'worktreePath', 'status', 'session_id'];

/**
 * Write active.yaml atomically using shared atomicWrite.
 */
function writeActiveAtomic(data) {
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  const activePath = join(configDir, 'active.yaml');
  const content = yaml.dump(data);
  atomicWrite(activePath, content);
}

/**
 * Validate a status value against the allowed enum.
 */
function validateStatus(status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid dispatch status: "${status}". Must be one of: ${VALID_STATUSES.join(', ')}`);
  }
}

/**
 * Add a dispatch record to active.yaml.
 * Throws if a dispatch with the same id already exists.
 *
 * @param {object} record - Dispatch record with id, repo, number, type, branch, worktreePath, status, session_id
 * @returns {object} The added dispatch record (with created timestamp)
 */
export function addDispatch(record) {
  for (const field of REQUIRED_FIELDS) {
    if (record[field] === undefined || record[field] === null) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (record.type !== 'issue' && record.type !== 'pr') {
    throw new Error(`Invalid dispatch type: "${record.type}". Must be "issue" or "pr"`);
  }

  validateStatus(record.status);

  const data = readActive();
  const existing = data.dispatches.find(d => d.id === record.id);
  if (existing) {
    throw new Error(`Dispatch with id "${record.id}" already exists`);
  }

  const dispatch = {
    ...record,
    created: record.created || new Date().toISOString(),
  };

  data.dispatches.push(dispatch);
  writeActiveAtomic(data);
  return dispatch;
}

/**
 * Update the status of a dispatch record.
 * Throws if the dispatch is not found or the status is invalid.
 *
 * @param {string} id - Dispatch id
 * @param {string} status - New status value
 * @returns {object} The updated dispatch record
 */
export function updateDispatchStatus(id, status) {
  validateStatus(status);

  const data = readActive();
  const dispatch = data.dispatches.find(d => d.id === id);
  if (!dispatch) {
    throw new Error(`Dispatch with id "${id}" not found`);
  }

  dispatch.status = status;
  writeActiveAtomic(data);
  return dispatch;
}

/**
 * Remove a dispatch record by id.
 * Throws if the dispatch is not found.
 *
 * @param {string} id - Dispatch id
 * @returns {object} The removed dispatch record
 */
export function removeDispatch(id) {
  const data = readActive();
  const index = data.dispatches.findIndex(d => d.id === id);
  if (index === -1) {
    throw new Error(`Dispatch with id "${id}" not found`);
  }

  const [removed] = data.dispatches.splice(index, 1);
  writeActiveAtomic(data);
  return removed;
}

/**
 * Get all active dispatch records.
 *
 * @returns {object[]} Array of dispatch records
 */
export function getActiveDispatches() {
  const data = readActive();
  return data.dispatches;
}

export { VALID_STATUSES };
