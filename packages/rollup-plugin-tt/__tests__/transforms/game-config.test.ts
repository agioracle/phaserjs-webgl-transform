import { describe, it, expect } from 'vitest';
import { transformGameConfig } from '../../src/transforms/game-config';

describe('transformGameConfig (Douyin)', () => {
  it('merges all default properties into inline config with no conflicts', () => {
    const code = `
const game = new Phaser.Game({
  width: 800,
  height: 600,
  scene: MyScene
});
`;
    const result = transformGameConfig(code);

    expect(result.warnings).toHaveLength(0);
    expect(result.code).toContain('Phaser.WEBGL');
    // Douyin: canvas resolves to window.canvas — the on-screen canvas the
    // tt-adapter mounts on the global window (works in devtools AND on device),
    // NOT the WeChat-specific GameGlobal.__wxCanvas.
    expect(result.code).toContain('window.canvas');
    expect(result.code).not.toContain('__wxCanvas');
    expect(result.code).not.toContain('GameGlobal.canvas');
    expect(result.code).toContain('parent: null');
    expect(result.code).toContain('disableWebAudio: true');
    expect(result.code).toContain('Phaser.Scale.NONE');
    expect(result.code).toContain('Phaser.Scale.NO_CENTER');
    expect(result.code).toContain('imageLoadType: "HTMLImageElement"');
    expect(result.code).toContain('width: 800');
    expect(result.code).toContain('__initRemoteAssetLoader(Phaser)');
    const initIdx = result.code.indexOf('__initRemoteAssetLoader(Phaser)');
    const newGameIdx = result.code.indexOf('new Phaser.Game');
    expect(initIdx).toBeLessThan(newGameIdx);
  });

  it('overrides type: Phaser.CANVAS to Phaser.WEBGL and emits warning', () => {
    const code = `
const game = new Phaser.Game({
  width: 640,
  height: 480,
  type: Phaser.CANVAS
});
`;
    const result = transformGameConfig(code);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/renderer type/i);
    expect(result.code).toContain('Phaser.WEBGL');
    expect(result.code).not.toMatch(/type:\s*Phaser\.CANVAS/);
  });

  it('resolves a variable reference config and merges defaults', () => {
    const code = `
const config = {
  width: 1024,
  height: 768,
  scene: [BootScene, GameScene]
};
const game = new Phaser.Game(config);
`;
    const result = transformGameConfig(code);

    expect(result.warnings).toHaveLength(0);
    expect(result.code).toContain('Phaser.WEBGL');
    expect(result.code).toContain('window.canvas');
    expect(result.code).toContain('parent: null');
    expect(result.code).toContain('disableWebAudio: true');
    expect(result.code).toContain('imageLoadType: "HTMLImageElement"');
    expect(result.code).toContain('width: 1024');
  });

  it('returns code unchanged when no Phaser.Game call is found', () => {
    const code = `
const x = 42;
console.log('hello world');
`;
    const result = transformGameConfig(code);

    expect(result.warnings).toHaveLength(0);
    expect(result.code.replace(/\s/g, '')).toBe(code.replace(/\s/g, ''));
  });

  it('injects H5 scale for the h5 target and does not touch canvas', () => {
    const code = `
const game = new Phaser.Game({
  width: 800,
  height: 600
});
`;
    const result = transformGameConfig(code, 'h5');

    expect(result.warnings).toHaveLength(0);
    expect(result.code).toContain('Phaser.Scale.FIT');
    expect(result.code).toContain('Phaser.Scale.CENTER_BOTH');
    expect(result.code).not.toContain('window.canvas');
    expect(result.code).not.toContain('GameGlobal.canvas');
    expect(result.code).not.toContain('disableWebAudio');
  });
});
