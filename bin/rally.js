#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('rally')
  .description('Dispatch Squad teams to GitHub issues and PR reviews via git worktrees')
  .version('0.1.0');

program.parse();
