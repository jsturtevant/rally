import { getActiveDispatches } from '../active.js';
import { refreshDispatchStatuses } from '../dispatch-refresh.js';
import { checkWorktreeHealth, enrichWithStats } from '../dispatch-stats.js';
import { listOnboardedRepos } from '../picker.js';

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
 * Load and process dashboard data.
 */
export function getDashboardData({ project, _refreshDispatchStatuses, _listOnboardedRepos } = {}) {
  const refresh = _refreshDispatchStatuses || refreshDispatchStatuses;
  refresh();
  const raw = getActiveDispatches();
  let dispatches = checkWorktreeHealth(raw);
  dispatches = enrichWithStats(dispatches);

  if (project) {
    dispatches = dispatches.filter(d => d.repo && (d.repo.endsWith('/' + project) || d.repo === project));
  }

  // Collect onboarded project repo names for empty-project display
  let onboardedProjects;
  try {
    const listRepos = _listOnboardedRepos || listOnboardedRepos;
    const repos = listRepos();
    onboardedProjects = repos.map(r => r.repo).filter(Boolean);
    if (project) {
      onboardedProjects = onboardedProjects.filter(r => r.endsWith('/' + project) || r === project);
    }
  } catch { /* best-effort */ }

  return { dispatches, onboardedProjects };
}

/**
 * Group dispatches by project (repo name), using "(unknown)" for null/empty repos.
 * If onboardedProjects is provided, includes empty groups for projects with no dispatches.
 * Returns an array of { project, dispatches } in encounter order.
 */
export function groupByProject(dispatches, onboardedProjects) {
  const map = new Map();
  // Seed with onboarded projects so they appear even with no dispatches
  if (onboardedProjects) {
    for (const repo of onboardedProjects) {
      if (repo) map.set(repo, []);
    }
  }
  for (const d of dispatches) {
    const key = d.repo || '(unknown)';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(d);
  }
  return Array.from(map, ([project, dispatches]) => ({ project, dispatches }));
}

/**
 * Render a plain text dashboard (no ANSI escape codes) for non-TTY environments.
 */
export function renderPlainDashboard({ project } = {}) {
  const { dispatches } = getDashboardData({ project });

  const lines = [];
  lines.push('🚀 Rally Dashboard');
  lines.push('');

  const colWidths = { type: 7, issueRef: 10, title: 40, branch: 28, folder: 30, status: 20, changes: 10, age: 6 };
  const header = [
    '  ' + 'Type'.padEnd(colWidths.type),
    'Issue/PR'.padEnd(colWidths.issueRef),
    'Title'.padEnd(colWidths.title),
    'Branch'.padEnd(colWidths.branch),
    'Folder'.padEnd(colWidths.folder),
    'Status'.padEnd(colWidths.status),
    'Changes'.padEnd(colWidths.changes),
    'Age'.padEnd(colWidths.age),
  ].join(' ');
  lines.push(header);

  if (dispatches.length === 0) {
    lines.push('No active dispatches');
  } else {
    const groups = groupByProject(dispatches);
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      if (gi > 0) lines.push('');
      lines.push(group.project);
      for (const d of group.dispatches) {
        const type = d.type === 'pr' ? 'PR' : d.type === 'branch' ? 'Branch' : 'Issue';
        const issueRef = d.type === 'branch' ? '' : `#${d.number}`;
        let title = d.title ?? '';
        if (title.length > colWidths.title) {
          title = title.slice(0, colWidths.title - 1) + '…';
        }
        const age = formatAge(d.created ?? d.created_at);
        const folderPath = d.worktreePath ?? '';
        const truncatedFolder = folderPath.length > colWidths.folder
          ? '…' + folderPath.slice(-(colWidths.folder - 1))
          : folderPath;
        const row = [
          '  ' + type.padEnd(colWidths.type),
          issueRef.padEnd(colWidths.issueRef),
          title.padEnd(colWidths.title),
          (d.branch ?? '').padEnd(colWidths.branch),
          truncatedFolder.padEnd(colWidths.folder),
          (d.status ?? '').padEnd(colWidths.status),
          (d.changes ?? '').padEnd(colWidths.changes),
          age.padEnd(colWidths.age),
        ].join(' ');
        lines.push(row);
      }
    }
  }

  return lines.join('\n');
}
