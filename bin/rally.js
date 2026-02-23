#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { setup } from '../lib/setup.js';
import { onboard } from '../lib/onboard.js';
import { getStatus, formatStatus } from '../lib/status.js';
import { handleError } from '../lib/errors.js';
import { assertTools } from '../lib/tools.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

const program = new Command();

program
  .name('rally')
  .description('Dispatch Squad teams to GitHub issues and PR reviews via git worktrees')
  .version(pkg.version);

program
  .command('setup')
  .description('Initialize Squad team state and Rally directories')
  .option('--dir <path>', 'Where to create external team state')
  .action(async (options) => {
    try {
      await setup(options);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command('onboard')
  .description('Onboard a repo to Rally (local path, GitHub URL, or owner/repo)')
  .argument('[path]', 'Path, GitHub URL, or owner/repo (defaults to current directory)')
  .option('--team <name>', 'Use a named team (skips interactive prompt)')
  .hook('preAction', () => assertTools())
  .action(async (pathArg, opts) => {
    try {
      await onboard({ path: pathArg, team: opts.team });
    } catch (err) {
      handleError(err);
    }
  });

program
  .command('status')
  .description('Show Rally configuration and active dispatches for debugging')
  .option('--json', 'Output as JSON')
  .action((opts) => {
    try {
      const status = getStatus();
      if (opts.json) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log(formatStatus(status));
      }
    } catch (err) {
      handleError(err);
    }
  });

const dashboard = program
  .command('dashboard')
  .description('Show active dispatch dashboard')
  .option('--json', 'Output as JSON instead of interactive UI')
  .option('--project <name>', 'Filter by project (repo name)')
  .action(async (opts) => {
    try {
      if (opts.json) {
        const { getDashboardData } = await import('../lib/ui/dashboard-data.js');
        const data = getDashboardData({ project: opts.project });
        console.log(JSON.stringify(data, null, 2));
      } else if (!process.stdout.isTTY) {
        const { renderPlainDashboard } = await import('../lib/ui/dashboard-data.js');
        console.log(renderPlainDashboard({ project: opts.project }));
      } else {
        const React = await import('react');
        const { render } = await import('ink');
        const { default: Dashboard } = await import('../lib/ui/Dashboard.js');
        render(React.createElement(Dashboard, { project: opts.project }));
      }
    } catch (err) {
      handleError(err);
    }
  });

dashboard
  .command('clean')
  .description('Clean done dispatches (remove worktrees, preserve branches)')
  .option('--all', 'Clean all dispatches, not just done ones')
  .option('--yes', 'Skip confirmation prompt for --all')
  .action(async (opts) => {
    try {
      const { dashboardClean } = await import('../lib/dashboard-clean.js');
      await dashboardClean({ all: opts.all, yes: opts.yes });
    } catch (err) {
      handleError(err);
    }
  });

const dispatch = program
  .command('dispatch')
  .description('Dispatch Squad to a GitHub issue or PR')
  .hook('preAction', () => assertTools());

dispatch
  .command('issue')
  .description('Dispatch Squad to a GitHub issue')
  .argument('<number>', 'GitHub issue number')
  .option('--repo <owner/repo>', 'Target repository (owner/repo)')
  .option('--repo-path <path>', 'Path to local repo clone')
  .option('--team-dir <path>', 'Path to custom squad directory')
  .action(async (number, opts) => {
    try {
      const { resolveRepo } = await import('../lib/dispatch.js');
      const { dispatchIssue } = await import('../lib/dispatch-issue.js');
      const resolved = resolveRepo({ repo: opts.repo });
      const result = await dispatchIssue({
        issueNumber: number,
        repo: resolved.fullName,
        repoPath: opts.repoPath || resolved.project.path,
        teamDir: opts.teamDir,
      });
      console.log(`Dispatched issue #${number} → ${result.worktreePath}`);
    } catch (err) {
      handleError(err);
    }
  });

dispatch
  .command('pr')
  .description('Dispatch Squad to a GitHub PR review')
  .argument('<number>', 'GitHub PR number')
  .option('--repo <owner/repo>', 'Target repository (owner/repo)')
  .option('--repo-path <path>', 'Path to local repo clone')
  .option('--team-dir <path>', 'Path to custom squad directory')
  .action(async (number, opts) => {
    try {
      const { resolveRepo } = await import('../lib/dispatch.js');
      const { dispatchPr } = await import('../lib/dispatch-pr.js');
      const resolved = resolveRepo({ repo: opts.repo });
      const result = await dispatchPr({
        prNumber: number,
        repo: resolved.fullName,
        repoPath: opts.repoPath || resolved.project.path,
        teamDir: opts.teamDir,
      });
      console.log(`Dispatched PR #${number} → ${result.worktreePath}`);
    } catch (err) {
      handleError(err);
    }
  });

program.parse();
