import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

import inquirer from 'inquirer';
import { newCommand } from '../../src/commands/new.js';

describe('newCommand', () => {
  const MOCK_ANSWERS = {
    appid: 'wxabcdef1234567890',
    orientation: 'landscape' as const,
    cdn: 'https://cdn.example.com/assets',
  };

  let originalCwd: string;
  let testDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.mocked(inquirer.prompt).mockResolvedValue(MOCK_ANSWERS);

    // Create a temp directory to scaffold projects into
    testDir = fs.mkdtempSync(path.join(tmpdir(), 'phaser-wx-test-'));
    originalCwd = process.cwd();
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    // Clean up temp directory
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('copies expected files from example directory', async () => {
    await newCommand('my-game', { template: 'full' });

    const projectDir = path.join(testDir, 'my-game');
    expect(fs.existsSync(path.join(projectDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'phaser-wx.config.json'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'README.md'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'src/main.js'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'src/scenes/BootScene.js'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'src/scenes/MenuScene.js'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'src/scenes/GameScene.js'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'src/utils/safe-area.js'))).toBe(true);
    // Asset files (not just directories) are copied
    expect(fs.existsSync(path.join(projectDir, 'public/assets/images/ball.png'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'public/assets/audio/ball_hit.mp3'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'public/remote-assets/images/game_logo.png'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'public/remote-assets/audio/bgm.mp3'))).toBe(true);
    // Verify they are actual files with content, not empty
    expect(fs.statSync(path.join(projectDir, 'public/assets/images/ball.png')).size).toBeGreaterThan(0);
    expect(fs.statSync(path.join(projectDir, 'public/assets/audio/ball_hit.mp3')).size).toBeGreaterThan(0);
  });

  it('replaces project name in package.json', async () => {
    await newCommand('my-game', { template: 'full' });

    const pkgPath = path.join(testDir, 'my-game', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.name).toBe('my-game');
    expect(pkg.dependencies.phaser).toBeDefined();
    expect(pkg.scripts.dev).toBeDefined();
  });

  it('replaces appid, orientation, and cdn in phaser-wx.config.json', async () => {
    await newCommand('my-game', { template: 'full' });

    const configPath = path.join(testDir, 'my-game', 'phaser-wx.config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.appid).toBe('wxabcdef1234567890');
    expect(config.orientation).toBe('landscape');
    expect(config.cdn).toBe('https://cdn.example.com/assets');
  });

  it('replaces project name in README.md title', async () => {
    await newCommand('my-game', { template: 'full' });

    const readmePath = path.join(testDir, 'my-game', 'README.md');
    const readme = fs.readFileSync(readmePath, 'utf-8');
    expect(readme).toMatch(/^# my-game/);
    expect(readme).not.toContain('# phaser-wx-example');
  });

  it('excludes node_modules, dist-wx, .DS_Store, and package-lock.json', async () => {
    await newCommand('my-game', { template: 'full' });

    const projectDir = path.join(testDir, 'my-game');
    expect(fs.existsSync(path.join(projectDir, 'node_modules'))).toBe(false);
    expect(fs.existsSync(path.join(projectDir, 'dist-wx'))).toBe(false);
    expect(fs.existsSync(path.join(projectDir, '.DS_Store'))).toBe(false);
    expect(fs.existsSync(path.join(projectDir, 'package-lock.json'))).toBe(false);
  });

  it('exits with error if directory already exists', async () => {
    const projectDir = path.join(testDir, 'my-game');
    fs.mkdirSync(projectDir);

    await newCommand('my-game', { template: 'full' });

    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
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

  it('keeps remote-assets files in place when CDN is provided', async () => {
    await newCommand('my-game', { template: 'full' });

    const projectDir = path.join(testDir, 'my-game');
    // remote-assets files stay where they are
    expect(fs.existsSync(path.join(projectDir, 'public/remote-assets/images/game_logo.png'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'public/remote-assets/audio/bgm.mp3'))).toBe(true);
    // assets dir does NOT contain the remote files
    expect(fs.existsSync(path.join(projectDir, 'public/assets/images/game_logo.png'))).toBe(false);
    expect(fs.existsSync(path.join(projectDir, 'public/assets/audio/bgm.mp3'))).toBe(false);
  });

  it('moves remote-assets files into assets when CDN is empty', async () => {
    vi.mocked(inquirer.prompt).mockResolvedValue({
      ...MOCK_ANSWERS,
      cdn: '',
    });

    await newCommand('my-game', { template: 'full' });

    const projectDir = path.join(testDir, 'my-game');
    // Files moved to assets
    expect(fs.existsSync(path.join(projectDir, 'public/assets/images/game_logo.png'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'public/assets/audio/bgm.mp3'))).toBe(true);
    expect(fs.statSync(path.join(projectDir, 'public/assets/images/game_logo.png')).size).toBeGreaterThan(0);
    expect(fs.statSync(path.join(projectDir, 'public/assets/audio/bgm.mp3')).size).toBeGreaterThan(0);
    // Original files removed from remote-assets
    expect(fs.existsSync(path.join(projectDir, 'public/remote-assets/images/game_logo.png'))).toBe(false);
    expect(fs.existsSync(path.join(projectDir, 'public/remote-assets/audio/bgm.mp3'))).toBe(false);
    // remote-assets directories and .gitkeep still exist
    expect(fs.existsSync(path.join(projectDir, 'public/remote-assets/images/.gitkeep'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'public/remote-assets/audio/.gitkeep'))).toBe(true);
    // Original assets still intact
    expect(fs.existsSync(path.join(projectDir, 'public/assets/images/ball.png'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'public/assets/audio/ball_hit.mp3'))).toBe(true);
  });
});
