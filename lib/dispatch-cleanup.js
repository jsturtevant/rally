import { execFileSync } from 'node:child_process';
import chalk from 'chalk';
import { terminatePid } from './active.js';
import { removeWorktree } from './worktree.js';
import { extractLearnings } from './squad-sdk.js';
import { isPidAlive } from './utils.js';

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
 * @param {Function} [opts._isPidAlive] - Injectable isPidAlive for testing
 * @param {object} [opts._chalk] - Injectable chalk for testing
 * @param {boolean} [opts.silent] - Suppress console output (for TUI callers)
 * @returns {Promise<{ extractionResult?: object }>}
 */
export async function cleanupDispatch(dispatch, repoPath, opts = {}) {
  const _terminatePid = opts._terminatePid || terminatePid;
  const _removeWt = opts._removeWorktree || removeWorktree;
  const _exec = opts._exec || execFileSync;
  const _extract = opts._extractLearnings || extractLearnings;
  const _chalk = opts._chalk || chalk;
  const silent = opts.silent || false;

  let extractionResult;

  // Extract learnings from worktree before cleanup (await to ensure completion)
  if (dispatch.worktreePath) {
    try {
      // Derive project name from dispatch.repo (owner/repo format) with org prefix
      const projectName = dispatch.repo ? dispatch.repo.replace('/', '-') : undefined;
      extractionResult = await _extract({ projectRoot: dispatch.worktreePath, clean: true, projectName });

      // Display extraction results (unless silent mode for TUI)
      if (!silent) {
        if (extractionResult && !extractionResult.blocked) {
          const { extracted = [], decisionsMerged = 0, skillsCreated = 0 } = extractionResult;
          const totalExtracted = extracted.length + decisionsMerged + skillsCreated;

          if (totalExtracted > 0) {
            console.log();
            console.log(_chalk.bold('📚 Learnings extracted:'));
            if (decisionsMerged > 0) {
              console.log(`   ${_chalk.green('✓')} ${decisionsMerged} decision${decisionsMerged === 1 ? '' : 's'} merged`);
            }
            if (skillsCreated > 0) {
              console.log(`   ${_chalk.green('✓')} ${skillsCreated} skill${skillsCreated === 1 ? '' : 's'} created`);
            }
            if (extracted.length > 0) {
              console.log(`   ${_chalk.green('✓')} ${extracted.length} learning${extracted.length === 1 ? '' : 's'} extracted`);
              // Show what was extracted (first 5 max)
              const toShow = extracted.slice(0, 5);
              for (const learning of toShow) {
                const label = learning.type || 'pattern';
                const preview = (learning.content || learning.filename || '').slice(0, 50);
                console.log(`      ${_chalk.dim(`[${label}]`)} ${preview}${preview.length >= 50 ? '...' : ''}`);
              }
              if (extracted.length > 5) {
                console.log(`      ${_chalk.dim(`... and ${extracted.length - 5} more`)}`);
              }
            }
            console.log();
          } else {
            console.log(_chalk.dim('📚 No learnings to extract'));
          }
        } else if (extractionResult && extractionResult.blocked) {
          console.log(_chalk.yellow('⚠ Learning extraction blocked (copyleft license detected)'));
        }
      }
    } catch (err) {
      // Log but continue — extraction failure shouldn't block cleanup
      if (!silent) {
        console.error(`Warning: learning extraction failed: ${err.message}`);
      }
      // Return error info so callers can report it
      extractionResult = { error: err.message };
    }
  }

  // Terminate Copilot process if PID is tracked
  if (dispatch.pid) {
    try {
      // Only terminate if dispatch is recent to avoid recycled PIDs
      const age = dispatch.created ? Date.now() - new Date(dispatch.created).getTime() : Infinity;
      if (age <= STALE_PID_MS) {
        _terminatePid(dispatch.pid);

        // Wait for the process to actually exit before removing the worktree.
        // On Windows, open file handles prevent directory removal (EBUSY).
        const _isPidAlive = opts._isPidAlive || isPidAlive;
        const maxWait = 10000; // 10 seconds
        const pollInterval = 500;
        const start = Date.now();
        while (_isPidAlive(dispatch.pid) && (Date.now() - start) < maxWait) {
          await new Promise(r => setTimeout(r, pollInterval));
        }
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

  return { extractionResult };
}
