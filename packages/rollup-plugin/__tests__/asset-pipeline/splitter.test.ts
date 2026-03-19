import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { splitAssets, SplitResult, AssetEntry } from '../../src/asset-pipeline/splitter';
import type { AssetReference } from '../../src/asset-pipeline/scanner';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'splitter-test-'));
}

function writeFixture(dir: string, relativePath: string, content: string): void {
  const fullPath = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
}

describe('splitAssets', () => {
  let assetsDir: string;
  let outputDir: string;
  let remoteDir: string;

  beforeEach(() => {
    assetsDir = createTempDir();
    outputDir = createTempDir();
    remoteDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(assetsDir, { recursive: true, force: true });
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.rmSync(remoteDir, { recursive: true, force: true });
  });

  it('splits small files to local and large files to remote', () => {
    writeFixture(assetsDir, 'small.png', '0123456789');
    writeFixture(assetsDir, 'large.png', 'X'.repeat(200));

    const assetRefs: AssetReference[] = [
      { path: 'small.png', type: 'image', loaderMethod: 'image' },
      { path: 'large.png', type: 'image', loaderMethod: 'image' },
    ];

    const result = splitAssets(assetRefs, assetsDir, outputDir, remoteDir, 100);

    expect(result.local).toHaveLength(1);
    expect(result.remote).toHaveLength(1);
    expect(result.local[0].path).toBe('small.png');
    expect(result.remote[0].path).toBe('large.png');

    expect(fs.existsSync(path.join(outputDir, 'small.png'))).toBe(true);
    expect(fs.existsSync(path.join(remoteDir, 'large.png'))).toBe(true);
  });

  it('computes SHA-256 hash correctly (first 16 hex chars)', () => {
    writeFixture(assetsDir, 'test.txt', 'hello world');

    const assetRefs: AssetReference[] = [
      { path: 'test.txt', type: 'other', loaderMethod: 'image' },
    ];

    const result = splitAssets(assetRefs, assetsDir, outputDir, remoteDir, 1000);

    expect(result.local).toHaveLength(1);
    expect(result.local[0].hash).toBe('b94d27b9934d3e08');
    expect(result.local[0].hash).toHaveLength(16);
  });

  it('reports correct file size', () => {
    const content = 'A'.repeat(42);
    writeFixture(assetsDir, 'sized.dat', content);

    const assetRefs: AssetReference[] = [
      { path: 'sized.dat', type: 'other', loaderMethod: 'image' },
    ];

    const result = splitAssets(assetRefs, assetsDir, outputDir, remoteDir, 1000);

    expect(result.local[0].size).toBe(42);
  });

  it('handles nested asset paths', () => {
    writeFixture(assetsDir, 'images/sprites/player.png', 'pixeldata');

    const assetRefs: AssetReference[] = [
      { path: 'images/sprites/player.png', type: 'spritesheet', loaderMethod: 'spritesheet' },
    ];

    const result = splitAssets(assetRefs, assetsDir, outputDir, remoteDir, 1000);

    expect(result.local).toHaveLength(1);
    expect(result.local[0].path).toBe('images/sprites/player.png');
    expect(fs.existsSync(path.join(outputDir, 'images/sprites/player.png'))).toBe(true);
  });

  it('returns correct type from asset reference', () => {
    writeFixture(assetsDir, 'music.mp3', 'audiodata');

    const assetRefs: AssetReference[] = [
      { path: 'music.mp3', type: 'audio', loaderMethod: 'audio' },
    ];

    const result = splitAssets(assetRefs, assetsDir, outputDir, remoteDir, 1000);

    expect(result.local[0].type).toBe('audio');
  });

  it('puts file exactly at threshold into local', () => {
    writeFixture(assetsDir, 'exact.bin', 'X'.repeat(100));

    const assetRefs: AssetReference[] = [
      { path: 'exact.bin', type: 'other', loaderMethod: 'image' },
    ];

    const result = splitAssets(assetRefs, assetsDir, outputDir, remoteDir, 100);

    expect(result.local).toHaveLength(1);
    expect(result.remote).toHaveLength(0);
  });

  it('skips missing files and continues processing', () => {
    writeFixture(assetsDir, 'exists.png', 'data');

    const assetRefs: AssetReference[] = [
      { path: 'missing.png', type: 'image', loaderMethod: 'image' },
      { path: 'exists.png', type: 'image', loaderMethod: 'image' },
    ];

    const result = splitAssets(assetRefs, assetsDir, outputDir, remoteDir, 1000);

    expect(result.local).toHaveLength(1);
    expect(result.local[0].path).toBe('exists.png');
  });

  describe('remoteAssetsDir', () => {
    let remoteAssetsDir: string;

    beforeEach(() => {
      remoteAssetsDir = createTempDir();
    });

    afterEach(() => {
      fs.rmSync(remoteAssetsDir, { recursive: true, force: true });
    });

    it('forces files under remoteAssetsDir to remote regardless of size', () => {
      // Small file in remoteAssetsDir (would be local by size threshold)
      writeFixture(remoteAssetsDir, 'audio/bgm.mp3', 'small-audio');

      // In real usage, loader path includes the remote-assets dir prefix
      // e.g. this.load.audio('bgm', 'remote-assets/audio/bgm.mp3')
      const remoteAssetsDirName = path.basename(remoteAssetsDir);
      const assetRefs: AssetReference[] = [
        { path: `${remoteAssetsDirName}/audio/bgm.mp3`, type: 'audio', loaderMethod: 'audio' },
      ];

      // The splitter resolves paths from dirname(remoteAssetsDir) (the web root)
      const result = splitAssets(assetRefs, assetsDir, outputDir, remoteDir, 10000, remoteAssetsDir);

      expect(result.remote).toHaveLength(1);
      expect(result.local).toHaveLength(0);
      expect(result.remote[0].path).toBe(`${remoteAssetsDirName}/audio/bgm.mp3`);
      // Remote-assets are also copied to outputDir for local DevTools preview
      expect(fs.existsSync(path.join(outputDir, `${remoteAssetsDirName}/audio/bgm.mp3`))).toBe(true);
    });

    it('scans remoteAssetsDir for files not referenced by loader calls', () => {
      // File exists in remoteAssetsDir but not in assetRefs
      writeFixture(remoteAssetsDir, 'images/bg.png', 'background-data');
      writeFixture(remoteAssetsDir, 'audio/music.mp3', 'music-data');
      // .gitkeep should be skipped
      writeFixture(remoteAssetsDir, '.gitkeep', '');

      const assetRefs: AssetReference[] = [];

      // The parent of remoteAssetsDir is the "web root"
      const webRoot = path.dirname(remoteAssetsDir);
      const remoteAssetsDirName = path.basename(remoteAssetsDir);

      const result = splitAssets(assetRefs, assetsDir, outputDir, remoteDir, 10000, remoteAssetsDir);

      expect(result.remote).toHaveLength(2);
      expect(result.local).toHaveLength(0);

      const remotePaths = result.remote.map(e => e.path).sort();
      expect(remotePaths).toContain(`${remoteAssetsDirName}/audio/music.mp3`);
      expect(remotePaths).toContain(`${remoteAssetsDirName}/images/bg.png`);
    });

    it('infers asset type from file extension for auto-scanned remote files', () => {
      writeFixture(remoteAssetsDir, 'images/photo.jpg', 'jpeg-data');
      writeFixture(remoteAssetsDir, 'audio/sfx.wav', 'wav-data');

      const result = splitAssets([], assetsDir, outputDir, remoteDir, 10000, remoteAssetsDir);

      const imageEntry = result.remote.find(e => e.path.includes('photo.jpg'));
      const audioEntry = result.remote.find(e => e.path.includes('sfx.wav'));

      expect(imageEntry?.type).toBe('image');
      expect(audioEntry?.type).toBe('audio');
    });

    it('does not duplicate files referenced both by loader and auto-scan', () => {
      writeFixture(remoteAssetsDir, 'audio/bgm.mp3', 'bgm-data');

      const remoteAssetsDirName = path.basename(remoteAssetsDir);
      const assetRefs: AssetReference[] = [
        { path: `${remoteAssetsDirName}/audio/bgm.mp3`, type: 'audio', loaderMethod: 'audio' },
      ];

      const result = splitAssets(assetRefs, assetsDir, outputDir, remoteDir, 10000, remoteAssetsDir);

      // Should appear only once (from the loader ref resolution, not duplicated by auto-scan)
      const bgmEntries = result.remote.filter(e => e.path.includes('bgm.mp3'));
      expect(bgmEntries).toHaveLength(1);
    });

    it('mixes local assets and remote-dir assets correctly', () => {
      writeFixture(assetsDir, 'images/logo.png', 'logo-data');
      writeFixture(remoteAssetsDir, 'audio/bgm.mp3', 'bgm-data');

      const assetRefs: AssetReference[] = [
        { path: 'images/logo.png', type: 'image', loaderMethod: 'image' },
      ];

      const result = splitAssets(assetRefs, assetsDir, outputDir, remoteDir, 10000, remoteAssetsDir);

      expect(result.local).toHaveLength(1);
      expect(result.local[0].path).toBe('images/logo.png');

      expect(result.remote).toHaveLength(1);
      expect(result.remote[0].path).toContain('bgm.mp3');
    });
  });
});
