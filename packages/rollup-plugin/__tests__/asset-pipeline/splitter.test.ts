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
});
