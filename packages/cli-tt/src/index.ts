import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { buildCommand } from './commands/build.js';
import { newCommand } from './commands/new.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('phaser-tt')
    .description('Transform Phaser.js games into Douyin Mini-Games')
    .version('0.1.0');

  program
    .command('init')
    .description('Initialize a Douyin Mini-Game project')
    .action(initCommand);

  program
    .command('build')
    .description('Build for Douyin Mini-Game or H5 browser')
    .option('--cdn <url>', 'CDN base URL for remote assets')
    .option('--target <platform>', 'Build target: tt or h5', 'tt')
    .action(buildCommand);

  program
    .command('new <project-name>')
    .description('Scaffold a new Phaser.js + Douyin Mini-Game project')
    .option('--template <name>', 'Project template to use', 'full')
    .action(newCommand);

  return program;
}

// Only auto-parse when run directly (not imported for testing)
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('/phaser-tt') ||
    process.argv[1].endsWith('/index.js') ||
    process.argv[1].endsWith('/index.cjs'));

if (isDirectRun) {
  createProgram().parse();
}
