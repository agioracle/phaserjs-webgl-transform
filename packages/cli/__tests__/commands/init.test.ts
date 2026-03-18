import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

vi.mock('node:fs');
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

import inquirer from 'inquirer';
import { initCommand } from '../../src/commands/init.js';

describe('initCommand', () => {
  const MOCK_ANSWERS = {
    appid: 'wxabcdef1234567890',
    orientation: 'landscape',
    cdn: 'https://cdn.example.com/assets',
    entry: 'src/main.js',
    assetsDir: 'public/assets',
    outputDir: 'dist',
  };

  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(inquirer.prompt).mockResolvedValue(MOCK_ANSWERS);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('writes a config file to cwd with correct content', async () => {
    await initCommand();

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);

    const [filePath, content] = vi.mocked(fs.writeFileSync).mock.calls[0] as [string, string];
    expect(filePath).toBe(path.join(process.cwd(), 'phaser-wx.config.json'));

    const parsed = JSON.parse(content);
    expect(parsed).toEqual({
      appid: 'wxabcdef1234567890',
      orientation: 'landscape',
      cdn: 'https://cdn.example.com/assets',
      entry: 'src/main.js',
      assets: {
        dir: 'public/assets',
      },
      output: {
        dir: 'dist',
      },
    });
  });

  it('prompts the user with inquirer', async () => {
    await initCommand();

    expect(inquirer.prompt).toHaveBeenCalledTimes(1);
    const questions = vi.mocked(inquirer.prompt).mock.calls[0][0] as Array<Record<string, unknown>>;
    const names = questions.map((q) => q.name);
    expect(names).toContain('appid');
    expect(names).toContain('orientation');
    expect(names).toContain('cdn');
    expect(names).toContain('entry');
    expect(names).toContain('assetsDir');
    expect(names).toContain('outputDir');
  });

  it('prints a success message after writing', async () => {
    await initCommand();

    expect(consoleLogSpy).toHaveBeenCalled();
    const allOutput = consoleLogSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toMatch(/phaser-wx\.config\.json/);
  });

  it('orientation prompt offers portrait and landscape choices', async () => {
    await initCommand();

    const questions = vi.mocked(inquirer.prompt).mock.calls[0][0] as Array<Record<string, unknown>>;
    const orientationQ = questions.find((q) => q.name === 'orientation');
    expect(orientationQ).toBeDefined();
    expect(orientationQ!.type).toBe('list');
    expect(orientationQ!.choices).toEqual(['portrait', 'landscape']);
  });
});
