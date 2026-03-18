import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

vi.mock('node:fs');
vi.mock('inquirer', () => ({
  default: { prompt: vi.fn() },
}));

import inquirer from 'inquirer';
import { newCommand } from '../../src/commands/new.js';

describe('newCommand', () => {
  const MOCK_ANSWERS = {
    appid: 'wxabcdef1234567890',
    orientation: 'landscape' as const,
    cdn: 'https://cdn.example.com/assets',
  };

  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.mocked(inquirer.prompt).mockResolvedValue(MOCK_ANSWERS);
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined as any);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('creates all expected files in the project directory', async () => {
    await newCommand('my-game', { template: 'full' });

    const writtenPaths = vi.mocked(fs.writeFileSync).mock.calls.map(
      ([p]) => path.relative(path.resolve(process.cwd(), 'my-game'), p as string)
    );

    expect(writtenPaths).toContain('package.json');
    expect(writtenPaths).toContain('phaser-wx.config.json');
    expect(writtenPaths).toContain('README.md');
    expect(writtenPaths).toContain('src/main.js');
    expect(writtenPaths).toContain('src/scenes/BootScene.js');
    expect(writtenPaths).toContain('src/scenes/MenuScene.js');
    expect(writtenPaths).toContain('src/scenes/GameScene.js');
    expect(writtenPaths).toContain('src/ui/Button.js');
  });

  it('writes valid JSON for package.json with phaser dependency', async () => {
    await newCommand('my-game', { template: 'full' });

    const pkgCall = vi.mocked(fs.writeFileSync).mock.calls.find(
      ([p]) => (p as string).endsWith('package.json') && !(p as string).includes('phaser-wx')
    );
    expect(pkgCall).toBeDefined();
    const parsed = JSON.parse(pkgCall![1] as string);
    expect(parsed.name).toBe('my-game');
    expect(parsed.dependencies.phaser).toBeDefined();
    expect(parsed.scripts.dev).toBeDefined();
  });

  it('writes config with prompted appid, orientation, and cdn', async () => {
    await newCommand('my-game', { template: 'full' });

    const cfgCall = vi.mocked(fs.writeFileSync).mock.calls.find(
      ([p]) => (p as string).endsWith('phaser-wx.config.json')
    );
    expect(cfgCall).toBeDefined();
    const parsed = JSON.parse(cfgCall![1] as string);
    expect(parsed.appid).toBe('wxabcdef1234567890');
    expect(parsed.orientation).toBe('landscape');
    expect(parsed.cdn).toBe('https://cdn.example.com/assets');
  });

  it('exits with error if directory already exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    await newCommand('my-game', { template: 'full' });

    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('creates directories with recursive flag', async () => {
    await newCommand('my-game', { template: 'full' });

    const mkdirCalls = vi.mocked(fs.mkdirSync).mock.calls;
    expect(mkdirCalls.length).toBeGreaterThan(0);
    for (const [, opts] of mkdirCalls) {
      expect(opts).toEqual({ recursive: true });
    }
  });

  it('prompts for appid, orientation, and cdn', async () => {
    await newCommand('my-game', { template: 'full' });

    expect(inquirer.prompt).toHaveBeenCalledOnce();
    const questions = vi.mocked(inquirer.prompt).mock.calls[0][0] as Array<Record<string, unknown>>;
    const names = questions.map((q) => q.name);
    expect(names).toEqual(['appid', 'orientation', 'cdn']);
  });

  it('prints next steps after scaffolding', async () => {
    await newCommand('my-game', { template: 'full' });

    const output = consoleLogSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('my-game');
    expect(output).toContain('cd my-game');
    expect(output).toContain('npm install');
    expect(output).toContain('phaser-wx build');
  });
});
