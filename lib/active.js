import { mkdirSync, existsSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { getConfigDir, readActive, atomicWrite } from './config.js';

const VALID_STATUSES = ['planning', 'implementing', 'reviewing', 'done', 'cleaned'];

const REQUIRED_FIELDS = ['id', 'repo', 'number', 'type', 'branch', 'worktreePath', 'status', 'session_id'];

const LOCK_TIMEOUT_MS = parseInt(process.env.RALLY_LOCK_TIMEOUT_MS, 10) || 10000;
const LOCK_RETRY_MS = 50;

/**
 * Acquire a file-system lock using mkdir (atomic on POSIX and Windows).
 * Returns a release function.
 */
function acquireLock() {
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  const lockDir = join(configDir, '.active.lock');
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      mkdirSync(lockDir);
      return () => {
        try {
          rmdirSync(lockDir);
        } catch (err) {
          // Log but don't throw — lock file leak is better than crashing
          console.error(`Warning: failed to release lock at ${lockDir}: ${err.message}`);
        }
      };
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      // Use Atomics.wait for proper sleep without CPU spin
      const buf = new SharedArrayBuffer(4);
      Atomics.wait(new Int32Array(buf), 0, 0, LOCK_RETRY_MS);
    }
  }
  throw new Error('Failed to acquire lock on active.yaml — another rally process may be stuck');
}

/**
 * Execute fn while holding the active.yaml lock.
 */
function withLock(fn) {
  const release = acquireLock();
  try {
    return fn();
  } finally {
    release();
  }
}

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
 * @param {object} record - Dispatch record with id, repo, number, type, branch, worktreePath, status, session_id, optional logPath
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

  return withLock(() => {
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
  });
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

  return withLock(() => {
    const data = readActive();
    const dispatch = data.dispatches.find(d => d.id === id);
    if (!dispatch) {
      throw new Error(`Dispatch with id "${id}" not found`);
    }

    dispatch.status = status;
    writeActiveAtomic(data);
    return dispatch;
  });
}

/**
 * Remove a dispatch record by id.
 * Throws if the dispatch is not found.
 *
 * @param {string} id - Dispatch id
 * @returns {object} The removed dispatch record
 */
export function removeDispatch(id) {
  return withLock(() => {
    const data = readActive();
    const index = data.dispatches.findIndex(d => d.id === id);
    if (index === -1) {
      throw new Error(`Dispatch with id "${id}" not found`);
    }

    const [removed] = data.dispatches.splice(index, 1);
    writeActiveAtomic(data);
    return removed;
  });
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
