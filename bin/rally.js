#!/usr/bin/env node
import { Command } from 'commander';
import { setup } from '../lib/setup.js';

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

program.parse();
