import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/commands/init.js', () => ({
  initCommand: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/commands/build.js', () => ({
  buildCommand: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/commands/new.js', () => ({
  newCommand: vi.fn().mockResolvedValue(undefined),
}));

import { createProgram } from '../src/index.js';
import { initCommand } from '../src/commands/init.js';
import { buildCommand } from '../src/commands/build.js';

describe('CLI entry point', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('has correct name and description', () => {
    const program = createProgram();
    expect(program.name()).toBe('phaser-wx');
    expect(program.description()).toMatch(/phaser/i);
  });

  it('registers init command', () => {
    const program = createProgram();
    const initCmd = program.commands.find((c) => c.name() === 'init');
    expect(initCmd).toBeDefined();
    expect(initCmd!.description()).toMatch(/init/i);
  });

  it('registers build command', () => {
    const program = createProgram();
    const buildCmd = program.commands.find((c) => c.name() === 'build');
    expect(buildCmd).toBeDefined();
    expect(buildCmd!.description()).toMatch(/build/i);
  });

  it('build command has --cdn option', () => {
    const program = createProgram();
    const buildCmd = program.commands.find((c) => c.name() === 'build')!;
    const cdnOption = buildCmd.options.find((o) => o.long === '--cdn');
    expect(cdnOption).toBeDefined();
  });

  it('dispatches init command', async () => {
    const program = createProgram();
    await program.parseAsync(['node', 'phaser-wx', 'init']);
    expect(initCommand).toHaveBeenCalledTimes(1);
  });

  it('dispatches build command with --cdn option', async () => {
    const program = createProgram();
    await program.parseAsync(['node', 'phaser-wx', 'build', '--cdn', 'https://mycdn.com']);
    expect(buildCommand).toHaveBeenCalled();
    const firstArg = vi.mocked(buildCommand).mock.calls[0][0] as Record<string, unknown>;
    expect(firstArg.cdn).toBe('https://mycdn.com');
  });
});
