import { describe, it, expect } from 'vitest';
import { transformGameConfig } from '../../src/transforms/game-config';

describe('transformGameConfig', () => {
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
    expect(result.code).toContain('GameGlobal.__wxCanvas');
    expect(result.code).toContain('parent: null');
    expect(result.code).toContain('disableWebAudio: true');
    expect(result.code).toContain('Phaser.Scale.NONE');
    expect(result.code).toContain('Phaser.Scale.NO_CENTER');
    expect(result.code).toContain('imageLoadType: "HTMLImageElement"');
    expect(result.code).toContain('width: 800');
    // Verify __initRemoteAssetLoader is injected before new Phaser.Game
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
    expect(result.code).toContain('GameGlobal.__wxCanvas');
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

  it('preserves user scale properties and only adds missing sub-props', () => {
    const code = `
const game = new Phaser.Game({
  width: 800,
  height: 600,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: 800,
    height: 600
  }
});
`;
    const result = transformGameConfig(code);

    expect(result.warnings).toHaveLength(0);
    expect(result.code).toContain('Phaser.Scale.NONE');
    expect(result.code).toContain('Phaser.Scale.NO_CENTER');
    expect(result.code).toContain('width: 800');
  });

  it('emits warning when config variable cannot be resolved', () => {
    const code = `
const game = new Phaser.Game(getConfig());
`;
    const result = transformGameConfig(code);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/could not resolve/i);
  });

  it('handles type: Phaser.AUTO by overriding to WEBGL with warning', () => {
    const code = `
const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 600
});
`;
    const result = transformGameConfig(code);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/renderer type/i);
    expect(result.code).toContain('Phaser.WEBGL');
  });

  it('does not duplicate properties that already match defaults', () => {
    const code = `
const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: null,
  width: 800,
  height: 600
});
`;
    const result = transformGameConfig(code);

    expect(result.warnings).toHaveLength(0);
    const typeMatches = result.code.match(/type:\s*Phaser\.WEBGL/g);
    expect(typeMatches).toHaveLength(1);
    const parentMatches = result.code.match(/parent:\s*null/g);
    expect(parentMatches).toHaveLength(1);
  });

  it('merges imageLoadType into existing loader config', () => {
    const code = `
const game = new Phaser.Game({
  width: 800,
  height: 600,
  loader: {
    baseURL: 'assets/',
    path: 'images/'
  }
});
`;
    const result = transformGameConfig(code);

    expect(result.warnings).toHaveLength(0);
    expect(result.code).toContain('imageLoadType: "HTMLImageElement"');
    expect(result.code).toContain('baseURL');
    expect(result.code).toContain('path');
  });

  it('does not override existing imageLoadType in loader config', () => {
    const code = `
const game = new Phaser.Game({
  width: 800,
  height: 600,
  loader: {
    imageLoadType: 'XHR'
  }
});
`;
    const result = transformGameConfig(code);

    expect(result.warnings).toHaveLength(0);
    // Should keep the user's existing imageLoadType, not add a duplicate
    const matches = result.code.match(/imageLoadType/g);
    expect(matches).toHaveLength(1);
  });
});
