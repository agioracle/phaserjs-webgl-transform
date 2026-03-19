import { describe, it, expect } from 'vitest';
import { generateFullTemplate } from '../../src/templates/full.js';

describe('generateFullTemplate', () => {
  const ctx = {
    projectName: 'test-game',
    appid: 'wx1234567890abcdef',
    orientation: 'portrait' as const,
    cdn: 'https://cdn.test.com',
  };

  it('returns all expected file paths', () => {
    const files = generateFullTemplate(ctx);
    const paths = Array.from(files.keys());

    expect(paths).toContain('package.json');
    expect(paths).toContain('phaser-wx.config.json');
    expect(paths).toContain('README.md');
    expect(paths).toContain('src/main.js');
    expect(paths).toContain('src/scenes/BootScene.js');
    expect(paths).toContain('src/scenes/MenuScene.js');
    expect(paths).toContain('src/scenes/GameScene.js');
    expect(paths).toContain('src/utils/safe-area.js');
    expect(paths).toContain('public/assets/images/.gitkeep');
    expect(paths).toContain('public/assets/audio/.gitkeep');
    expect(paths).toContain('public/remote-assets/images/.gitkeep');
    expect(paths).toContain('public/remote-assets/audio/.gitkeep');
  });

  it('interpolates project name into package.json', () => {
    const files = generateFullTemplate(ctx);
    const pkg = JSON.parse(files.get('package.json')!);
    expect(pkg.name).toBe('test-game');
    expect(pkg.dependencies.phaser).toBeDefined();
    expect(pkg.scripts.dev).toBeDefined();
    expect(pkg.scripts.build).toBe('pnpm exec phaser-wx build');
  });

  it('writes config with correct appid, orientation, cdn, remoteAssetsDir', () => {
    const files = generateFullTemplate(ctx);
    const config = JSON.parse(files.get('phaser-wx.config.json')!);
    expect(config.appid).toBe('wx1234567890abcdef');
    expect(config.orientation).toBe('portrait');
    expect(config.cdn).toBe('https://cdn.test.com');
    expect(config.entry).toBe('src/main.js');
    expect(config.assets.remoteAssetsDir).toBe('public/remote-assets');
  });

  it('uses portrait dimensions (750x1334) in main.js', () => {
    const files = generateFullTemplate(ctx);
    const main = files.get('src/main.js')!;
    expect(main).toContain('width: 750');
    expect(main).toContain('height: 1334');
  });

  it('uses landscape dimensions (1334x750) when orientation is landscape', () => {
    const files = generateFullTemplate({ ...ctx, orientation: 'landscape' });
    const main = files.get('src/main.js')!;
    expect(main).toContain('width: 1334');
    expect(main).toContain('height: 750');
  });

  it('main.js imports all three scenes', () => {
    const files = generateFullTemplate(ctx);
    const main = files.get('src/main.js')!;
    expect(main).toContain('BootScene');
    expect(main).toContain('MenuScene');
    expect(main).toContain('GameScene');
  });

  it('README contains project name and quick start instructions', () => {
    const files = generateFullTemplate(ctx);
    const readme = files.get('README.md')!;
    expect(readme).toContain('# test-game');
    expect(readme).toContain('npm install');
    expect(readme).toContain('npm run dev');
    expect(readme).toContain('npm run build');
  });

  it('BootScene loads assets and transitions to MenuScene', () => {
    const files = generateFullTemplate(ctx);
    const boot = files.get('src/scenes/BootScene.js')!;
    expect(boot).toContain("'MenuScene'");
    expect(boot).toContain("'ball'");
    expect(boot).toContain("'ball_hit'");
    expect(boot).toContain('remote-assets');
  });

  it('MenuScene uses safe area and has a launch button that transitions to GameScene', () => {
    const files = generateFullTemplate(ctx);
    const menu = files.get('src/scenes/MenuScene.js')!;
    expect(menu).toContain('getSafeArea');
    expect(menu).toContain('Tap to Launch');
    expect(menu).toContain("'GameScene'");
  });

  it('GameScene uses safe area, ball image, and sound effects', () => {
    const files = generateFullTemplate(ctx);
    const game = files.get('src/scenes/GameScene.js')!;
    expect(game).toContain('getSafeArea');
    expect(game).toContain('paddle');
    expect(game).toContain("'ball'");
    expect(game).toContain('ball_hit');
    expect(game).toContain('bricks');
    expect(game).toContain('physics.add.collider');
  });
});
