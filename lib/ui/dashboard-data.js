import { existsSync } from 'node:fs';
import { getActiveDispatches } from '../active.js';

/**
 * Format a timestamp into a human-readable age string.
 */
export function formatAge(createdAt) {
  if (!createdAt) return '—';
  const ts = new Date(createdAt).getTime();
  if (Number.isNaN(ts)) return '—';
  const ms = Date.now() - ts;
  if (ms < 0) return '0m';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/**
 * Check worktree health by verifying paths exist on disk.
 */
export function checkWorktreeHealth(dispatches) {
  return dispatches.map(d => ({
    ...d,
    healthy: d.worktreePath ? existsSync(d.worktreePath) : false,
  }));
}

/**
 * Compute summary counts from dispatches.
 */
export function computeSummary(dispatches) {
  let active = 0;
  let done = 0;
  let orphaned = 0;

  for (const d of dispatches) {
    if (d.status === 'done' || d.status === 'cleaned') {
      done++;
    } else if (!d.healthy) {
      orphaned++;
    } else {
      active++;
    }
  }

  return { active, done, orphaned };
}

/**
 * Load and process dashboard data.
 */
export function getDashboardData({ project } = {}) {
  const raw = getActiveDispatches();
  let dispatches = checkWorktreeHealth(raw);

  if (project) {
    dispatches = dispatches.filter(d => d.repo && (d.repo.endsWith('/' + project) || d.repo === project));
  }

  const summary = computeSummary(dispatches);
  return { dispatches, summary };
}

/**
 * Render a plain text dashboard (no ANSI escape codes) for non-TTY environments.
 */
export function renderPlainDashboard({ project } = {}) {
  const { dispatches, summary } = getDashboardData({ project });

  const lines = [];
  lines.push('Rally Dashboard');
  lines.push('');

  const colWidths = { project: 20, issueRef: 12, branch: 28, folder: 30, status: 16, age: 6 };
  const header = [
    'Project'.padEnd(colWidths.project),
    'Issue/PR'.padEnd(colWidths.issueRef),
    'Branch'.padEnd(colWidths.branch),
    'Folder'.padEnd(colWidths.folder),
    'Status'.padEnd(colWidths.status),
    'Age'.padEnd(colWidths.age),
  ].join(' ');
  lines.push(header);

  if (dispatches.length === 0) {
    lines.push('No active dispatches');
  } else {
    for (const d of dispatches) {
      const issueRef = d.type === 'pr' ? `PR #${d.number}` : `Issue #${d.number}`;
      const age = formatAge(d.created ?? d.created_at);
      const row = [
        (d.repo ?? '').padEnd(colWidths.project),
        issueRef.padEnd(colWidths.issueRef),
        (d.branch ?? '').padEnd(colWidths.branch),
        (d.worktreePath ?? '').padEnd(colWidths.folder),
        (d.status ?? '').padEnd(colWidths.status),
        age.padEnd(colWidths.age),
      ].join(' ');
      lines.push(row);
    }
  }

  lines.push('');
  lines.push(`${summary.active} active · ${summary.done} done · ${summary.orphaned} orphaned`);

  return lines.join('\n');
}
