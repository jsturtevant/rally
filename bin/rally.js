#!/usr/bin/env node
import { Command } from 'commander';
import { setup } from '../lib/setup.js';
import { onboard } from '../lib/onboard.js';
import { getStatus, formatStatus } from '../lib/status.js';

const program = new Command();

program
  .name('rally')
  .description('Dispatch Squad teams to GitHub issues and PR reviews via git worktrees')
  .version('0.1.0');

program
  .command('setup')
  .description('Initialize Squad team state and Rally directories')
  .option('--dir <path>', 'Where to create external team state')
  .action(async (options) => {
    try {
      await setup(options);
    } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('onboard')
  .description('Onboard a repo to Rally (local path, GitHub URL, or owner/repo)')
  .argument('[path]', 'Path, GitHub URL, or owner/repo (defaults to current directory)')
  .option('--team <name>', 'Use a named team (skips interactive prompt)')
  .action(async (pathArg, opts) => {
    try {
      await onboard({ path: pathArg, team: opts.team });
    } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show Rally configuration and active dispatches for debugging')
  .option('--json', 'Output as JSON')
  .action((opts) => {
    const status = getStatus();
    if (opts.json) {
      console.log(JSON.stringify(status, null, 2));
    } else {
      console.log(formatStatus(status));
    }
  });

program
  .command('dashboard')
  .description('Show active dispatch dashboard')
  .option('--json', 'Output as JSON instead of interactive UI')
  .option('--project <name>', 'Filter by project (repo name)')
  .action(async (opts) => {
    try {
      if (opts.json) {
        const { getDashboardData } = await import('../lib/ui/Dashboard.jsx');
        const data = getDashboardData({ project: opts.project });
        console.log(JSON.stringify(data, null, 2));
      } else if (!process.stdout.isTTY) {
        const { renderPlainDashboard } = await import('../lib/ui/Dashboard.jsx');
        console.log(renderPlainDashboard({ project: opts.project }));
      } else {
        const React = await import('react');
        const { render } = await import('ink');
        const { default: Dashboard } = await import('../lib/ui/Dashboard.jsx');
        render(React.createElement(Dashboard, { project: opts.project }));
      }
    } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
