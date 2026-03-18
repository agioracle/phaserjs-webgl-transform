#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { buildCommand } from './commands/build.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('phaser-wx')
    .description('Transform Phaser.js games into WeChat Mini-Games')
    .version('0.1.0');

  program
    .command('init')
    .description('Initialize a WeChat Mini-Game project')
    .action(initCommand);

  program
    .command('build')
    .description('Build for WeChat Mini-Game')
    .option('--cdn <url>', 'CDN base URL for remote assets')
    .action(buildCommand);

  return program;
}

// Only auto-parse when run directly (not imported for testing)
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('/phaser-wx') ||
    process.argv[1].endsWith('/index.js') ||
    process.argv[1].endsWith('/index.cjs'));

if (isDirectRun) {
  createProgram().parse();
}
