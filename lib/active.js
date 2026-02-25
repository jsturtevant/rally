import { mkdirSync, existsSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { readActive, atomicWrite, ensureConfigDir, getConfigDir } from './config.js';
import { isPidAlive } from './utils.js';

const VALID_STATUSES = ['planning', 'implementing', 'reviewing', 'pushed', 'done', 'cleaned'];

const REQUIRED_FIELDS = ['id', 'repo', 'number', 'type', 'branch', 'worktreePath', 'status', 'session_id'];

const LOCK_TIMEOUT_MS = parseInt(process.env.RALLY_LOCK_TIMEOUT_MS, 10) || 10000;
const LOCK_RETRY_MS = 50;
const LOCK_STALE_MS = 5 * 60 * 1000;

/**
 * Attempt to terminate a process by PID. Best-effort, catches all errors.
 * @param {number|null} pid - Process ID to terminate
 * @param {Function} [_kill] - Injectable process.kill for testing
 * @returns {boolean} true if SIGTERM was sent successfully
 */
export function terminatePid(pid, _kill = process.kill.bind(process), _readFileSync = readFileSync) {
  if (!pid || !Number.isFinite(pid)) return false;
  if (!Number.isInteger(pid) || pid <= 0) return false;
  // Verify the PID belongs to a gh copilot process before signaling
  try {
    const cmdline = _readFileSync(`/proc/${pid}/cmdline`, 'utf8');
    // cmdline uses NUL separators: "gh\0copilot\0..." — check for gh followed by copilot
    const args = cmdline.split('\0');
    const ghIdx = args.findIndex(a => a.endsWith('/gh') || a === 'gh');
    if (ghIdx === -1 || args[ghIdx + 1] !== 'copilot') return false;
  } catch {
    // /proc not available (macOS/Windows) or process gone — proceed best-effort
  }
  try {
    _kill(pid, 'SIGTERM');
    return true;
  } catch (err) {
    // Best-effort — process may already be terminated or inaccessible
    return false;
  }
}

function readLockInfo(lockDir) {
  const infoPath = join(lockDir, 'info.json');
  if (!existsSync(infoPath)) return null;
  try {
    const raw = readFileSync(infoPath, 'utf8');
    const info = JSON.parse(raw);
    if (!info || typeof info !== 'object') return null;
    const pid = Number.isFinite(info.pid) ? info.pid : Number.parseInt(info.pid, 10);
    const timestamp = Number.isFinite(info.timestamp) ? info.timestamp : Number.parseInt(info.timestamp, 10);
    if (!Number.isFinite(pid) || !Number.isFinite(timestamp)) return null;
    return { pid, timestamp };
  } catch {
    return null;
  }
}

function writeLockInfo(lockDir) {
  const infoPath = join(lockDir, 'info.json');
  const info = { pid: process.pid, timestamp: Date.now() };
  writeFileSync(infoPath, JSON.stringify(info), 'utf8');
}

function isLockStale(info, lockDir) {
  const now = Date.now();
  if (info) {
    const pidAlive = isPidAlive(info.pid);
    const ageMs = Number.isFinite(info.timestamp) ? now - info.timestamp : null;
    if (pidAlive === false || (ageMs !== null && ageMs > LOCK_STALE_MS)) {
      return { stale: true, pidAlive, pid: info.pid };
    }
    return { stale: false, pidAlive, pid: info.pid };
  }
  try {
    const stats = statSync(lockDir);
    if (now - stats.mtimeMs > LOCK_STALE_MS) {
      return { stale: true, pidAlive: null, pid: null };
    }
  } catch {
    // Ignore stat errors; fall back to waiting
  }
  return { stale: false, pidAlive: null, pid: null };
}

/**
 * Acquire a file-system lock using mkdir (atomic on POSIX and Windows).
 * Returns a release function.
 */
function acquireLock() {
  const configDir = ensureConfigDir();
  const lockDir = join(configDir, '.active.lock');
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  let lastAlivePid = null;

  while (Date.now() < deadline) {
    try {
      mkdirSync(lockDir);
      try {
        writeLockInfo(lockDir);
      } catch (err) {
        try {
          rmSync(lockDir, { recursive: true, force: true });
        } catch (cleanupErr) {
          console.error(`Warning: failed to cleanup lock at ${lockDir}: ${cleanupErr.message}`);
        }
        throw err;
      }
      return () => {
        try {
          rmSync(lockDir, { recursive: true, force: true });
        } catch (err) {
          // Log but don't throw — lock file leak is better than crashing
          console.error(`Warning: failed to release lock at ${lockDir}: ${err.message}`);
        }
      };
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      const info = readLockInfo(lockDir);
      const staleCheck = isLockStale(info, lockDir);
      if (staleCheck.pidAlive) {
        lastAlivePid = staleCheck.pid;
      }
      if (staleCheck.stale) {
        try {
          rmSync(lockDir, { recursive: true, force: true });
          // Immediately re-attempt mkdirSync so another process cannot
          // slip in between removal and the next loop iteration.
          continue;
        } catch (cleanupErr) {
          if (cleanupErr.code === 'ENOENT') {
            // Another process already removed the stale lock — retry
            continue;
          }
          console.error(`Warning: failed to cleanup stale lock at ${lockDir}: ${cleanupErr.message}`);
          continue;
        }
      }
      // Use Atomics.wait for proper sleep without CPU spin
      const buf = new SharedArrayBuffer(4);
      Atomics.wait(new Int32Array(buf), 0, 0, LOCK_RETRY_MS);
    }
  }
  const pidInfo = lastAlivePid ? ` (PID ${lastAlivePid})` : '';
  const staleMinutes = Math.ceil(LOCK_STALE_MS / 60000);
  throw new Error(
    `Failed to acquire lock on active.yaml — another rally process${pidInfo} is running. ` +
    `If this is stale, remove ${lockDir} or wait ${staleMinutes} minutes and retry.`
  );
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
 * Remove the active.yaml lock if held by the current process.
 * Safe to call from signal handlers.
 */
export function cleanupLock() {
  try {
    const configDir = getConfigDir();
    const lockDir = join(configDir, '.active.lock');
    const info = readLockInfo(lockDir);
    if (info && info.pid === process.pid) {
      rmSync(lockDir, { recursive: true, force: true });
    }
  } catch (_) {
    // best-effort — signal handlers must not throw
  }
}

/**
 * Write active.yaml atomically using shared atomicWrite.
 */
function writeActiveAtomic(data) {
  const configDir = ensureConfigDir();
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
 * Update a single field on a dispatch record.
 * Throws if the dispatch is not found.
 *
 * @param {string} id - Dispatch id
 * @param {string} field - Field name to update
 * @param {*} value - New value
 * @returns {object} The updated dispatch record
 */
const UPDATABLE_FIELDS = ['session_id', 'status', 'logPath', 'pid'];

export function updateDispatchField(id, field, value) {
  if (!UPDATABLE_FIELDS.includes(field)) {
    throw new Error(`Cannot update field: "${field}"`);
  }
  if (field === 'status') validateStatus(value);
  return withLock(() => {
    const data = readActive();
    const dispatch = data.dispatches.find(d => d.id === id);
    if (!dispatch) {
      throw new Error(`Dispatch with id "${id}" not found`);
    }

    dispatch[field] = value;
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
