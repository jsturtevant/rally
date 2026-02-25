import { existsSync } from 'node:fs';
import chalk from 'chalk';
import { getActiveDispatches, updateDispatchStatus, updateDispatchField } from './active.js';
import { resumeCopilot, parseSessionIdFromLog } from './copilot.js';
import { findDispatchByNumber } from './utils.js';

/**
 * Continue (reconnect to) a Copilot session for an active dispatch.
 *
 * Looks up the dispatch by issue/PR number, resolves the session ID
 * (checking the log file if the stored value is a PID), and launches
 * `gh copilot --resume <session_id>` interactively in the worktree.
 *
 * @param {number} number - Issue or PR number
 * @param {object} [opts]
 * @param {string} [opts.repo] - Target repository (owner/repo) for disambiguation
 * @param {string} [opts.message] - Additional instructions for Copilot
 * @param {Function} [opts._getActiveDispatches] - Injectable for testing
 * @param {Function} [opts._updateDispatchStatus] - Injectable for testing
 * @param {Function} [opts._updateDispatchField] - Injectable for testing
 * @param {Function} [opts._resumeCopilot] - Injectable for testing
 * @param {Function} [opts._parseSessionIdFromLog] - Injectable for testing
 * @param {Function} [opts._existsSync] - Injectable for testing
 * @param {object} [opts._chalk] - Injectable for testing
 * @returns {Promise<object>} The dispatch record with exit status
 */
export async function dispatchContinue(number, opts = {}) {
  const _getActive = opts._getActiveDispatches || getActiveDispatches;
  const _updateStatus = opts._updateDispatchStatus || updateDispatchStatus;
  const _updateField = opts._updateDispatchField || updateDispatchField;
  const _resume = opts._resumeCopilot || resumeCopilot;
  const _parseSession = opts._parseSessionIdFromLog || parseSessionIdFromLog;
  const _exists = opts._existsSync || existsSync;
  const _chalk = opts._chalk || chalk;

  const dispatches = _getActive();
  const dispatch = findDispatchByNumber(dispatches, number, { repo: opts.repo });

  // Verify worktree still exists
  if (!dispatch.worktreePath || !_exists(dispatch.worktreePath)) {
    throw new Error(
      `Worktree not found at ${dispatch.worktreePath || '(none)'}. ` +
      `The dispatch may have been cleaned. Use "rally dispatch remove ${number}" to clear it.`
    );
  }

  // Resolve session ID — try log file if current value looks like a PID or is pending
  let sessionId = dispatch.session_id;
  if (!sessionId || sessionId === 'pending' || /^\d+$/.test(sessionId)) {
    const logSessionId = _parseSession(dispatch.logPath);
    if (logSessionId) {
      sessionId = logSessionId;
      // Persist resolved session ID back to active.yaml
      try {
        _updateField(dispatch.id, 'session_id', sessionId);
      } catch {
        // Best-effort persistence
      }
    }
  }

  if (!sessionId || sessionId === 'pending') {
    throw new Error(
      `No session ID available for #${number}. ` +
      'Copilot may not have started or the session ID was not captured.'
    );
  }

  // Fall back to interactive picker if session ID is a PID (not a UUID)
  if (/^\d+$/.test(sessionId)) {
    sessionId = null;
  }

  const typeLabel = dispatch.type === 'pr' ? 'PR' : 'Issue';
  console.log(
    `${_chalk.cyan('Resuming')} ${typeLabel} #${number} ` +
    `${_chalk.dim(`(${dispatch.id})`)} ` +
    (sessionId
      ? `session ${_chalk.dim(sessionId)} `
      : `${_chalk.dim('(interactive picker)')} `) +
    `in ${_chalk.dim(dispatch.worktreePath)}`
  );

  // Update status to show we're actively working again
  const previousStatus = dispatch.status;
  if (dispatch.status === 'reviewing' || dispatch.status === 'done') {
    try {
      _updateStatus(dispatch.id, 'implementing');
    } catch {
      // Best-effort status update
    }
  }

  // Resume the copilot session interactively
  let result;
  try {
    result = _resume(dispatch.worktreePath, sessionId, {
      message: opts.message,
    });
  } finally {
    // Restore status to original after resume exits
    try {
      _updateStatus(dispatch.id, previousStatus);
    } catch {
      // Best-effort status restore
    }
  }

  return { ...dispatch, session_id: sessionId, exitStatus: result.status };
}
