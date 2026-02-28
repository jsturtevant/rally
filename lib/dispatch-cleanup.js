import { execFileSync } from 'node:child_process';
import { terminatePid } from './active.js';
import { removeWorktree } from './worktree.js';
import { extractLearnings } from './squad-sdk.js';

/** Max age for safe PID termination (7 days) */
export const STALE_PID_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Shared cleanup sequence: extract learnings, terminate PID, remove worktree, delete branch.
 *
 * @param {object} dispatch - The dispatch record
 * @param {string|null} repoPath - Resolved repo path on disk (may be null)
 * @param {object} [opts]
 * @param {Function} [opts._terminatePid] - Injectable for testing
 * @param {Function} [opts._removeWorktree] - Injectable for testing
 * @param {Function} [opts._exec] - Injectable execFileSync for testing
 * @param {Function} [opts._extractLearnings] - Injectable for testing
 */
export function cleanupDispatch(dispatch, repoPath, opts = {}) {
  const _terminatePid = opts._terminatePid || terminatePid;
  const _removeWt = opts._removeWorktree || removeWorktree;
  const _exec = opts._exec || execFileSync;
  const _extract = opts._extractLearnings || extractLearnings;

  // Extract learnings from worktree before cleanup (async but we don't await)
  if (dispatch.worktreePath) {
    try {
      // Fire and forget - don't block cleanup on learning extraction
      _extract({ projectRoot: dispatch.worktreePath, clean: true }).catch(() => {
        // Silently ignore extraction failures during cleanup
      });
    } catch {
      // Best-effort extraction — continue even if it fails
    }
  }

  // Terminate Copilot process if PID is tracked
  if (dispatch.pid) {
    try {
      // Only terminate if dispatch is recent to avoid recycled PIDs
      const age = dispatch.created ? Date.now() - new Date(dispatch.created).getTime() : Infinity;
      if (age <= STALE_PID_MS) {
        _terminatePid(dispatch.pid);
      }
    } catch {
      // Best-effort cleanup — continue even if termination fails
    }
  }

  // Remove worktree
  if (repoPath && dispatch.worktreePath) {
    try {
      _removeWt(repoPath, dispatch.worktreePath);
    } catch {
      // Worktree may already be removed — continue
    }
  }

  // Delete local branch
  if (repoPath && dispatch.branch) {
    try {
      _exec('git', ['branch', '-D', dispatch.branch], {
        cwd: repoPath,
        encoding: 'utf8',
      });
    } catch {
      // Branch may already be deleted or not exist locally
    }
  }
}
