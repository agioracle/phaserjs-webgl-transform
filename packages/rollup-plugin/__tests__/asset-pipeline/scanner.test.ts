import { describe, it, expect } from 'vitest';
import { scanAssets, AssetReference } from '../../src/asset-pipeline/scanner';

describe('scanAssets', () => {
  it('extracts this.load.image calls with key and path', () => {
    const code = `
class BootScene extends Phaser.Scene {
  preload() {
    this.load.image('logo', 'assets/logo.png');
    this.load.image('bg', 'assets/background.jpg');
  }
}
`;
    const refs = scanAssets(code);

    expect(refs).toHaveLength(2);
    expect(refs[0]).toEqual<AssetReference>({
      path: 'assets/logo.png',
      type: 'image',
      loaderMethod: 'image',
    });
    expect(refs[1]).toEqual<AssetReference>({
      path: 'assets/background.jpg',
      type: 'image',
      loaderMethod: 'image',
    });
  });

  it('extracts this.load.audio calls including array paths', () => {
    const code = `
class BootScene extends Phaser.Scene {
  preload() {
    this.load.audio('music', 'assets/music.mp3');
    this.load.audio('sfx', ['assets/sfx.ogg', 'assets/sfx.mp3']);
  }
}
`;
    const refs = scanAssets(code);

    expect(refs).toHaveLength(3);
    expect(refs[0]).toEqual<AssetReference>({
      path: 'assets/music.mp3',
      type: 'audio',
      loaderMethod: 'audio',
    });
    expect(refs[1]).toEqual<AssetReference>({
      path: 'assets/sfx.ogg',
      type: 'audio',
      loaderMethod: 'audio',
    });
    expect(refs[2]).toEqual<AssetReference>({
      path: 'assets/sfx.mp3',
      type: 'audio',
      loaderMethod: 'audio',
    });
  });

  it('extracts spritesheet, atlas, tilemapTiledJSON, multiatlas, bitmapFont', () => {
    const code = `
class BootScene extends Phaser.Scene {
  preload() {
    this.load.spritesheet('player', 'assets/player.png', { frameWidth: 32 });
    this.load.atlas('ui', 'assets/ui.png', 'assets/ui.json');
    this.load.tilemapTiledJSON('level1', 'assets/maps/level1.json');
    this.load.multiatlas('mega', 'assets/mega.json');
    this.load.bitmapFont('pixelFont', 'assets/font.png', 'assets/font.fnt');
  }
}
`;
    const refs = scanAssets(code);

    expect(refs).toEqual<AssetReference[]>([
      { path: 'assets/player.png', type: 'spritesheet', loaderMethod: 'spritesheet' },
      { path: 'assets/ui.png', type: 'atlas', loaderMethod: 'atlas' },
      { path: 'assets/ui.json', type: 'atlas', loaderMethod: 'atlas' },
      { path: 'assets/maps/level1.json', type: 'tilemapJSON', loaderMethod: 'tilemapTiledJSON' },
      { path: 'assets/mega.json', type: 'other', loaderMethod: 'multiatlas' },
      { path: 'assets/font.png', type: 'bitmapFont', loaderMethod: 'bitmapFont' },
      { path: 'assets/font.fnt', type: 'bitmapFont', loaderMethod: 'bitmapFont' },
    ]);
  });

  it('returns empty array for code with no loader calls', () => {
    const code = `
const x = 42;
console.log('hello');
`;
    const refs = scanAssets(code);
    expect(refs).toHaveLength(0);
  });

  it('ignores non-string arguments', () => {
    const code = `
class BootScene extends Phaser.Scene {
  preload() {
    this.load.image('logo', getPath());
    this.load.image('bg', 'assets/valid.png');
  }
}
`;
    const refs = scanAssets(code);
    expect(refs).toHaveLength(1);
    expect(refs[0].path).toBe('assets/valid.png');
  });

  it('extracts single-argument this.load.image(path) calls', () => {
    const code = `
class BootScene extends Phaser.Scene {
  preload() {
    this.load.image('assets/quick.png');
  }
}
`;
    const refs = scanAssets(code);
    expect(refs).toHaveLength(1);
    expect(refs[0].path).toBe('assets/quick.png');
  });
});
