import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generateManifest, AssetManifest } from '../../src/asset-pipeline/manifest';
import type { SplitResult } from '../../src/asset-pipeline/splitter';

describe('generateManifest', () => {
  let outputDir: string;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-test-'));
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('generates correct manifest structure from SplitResult', () => {
    const splitResult: SplitResult = {
      local: [
        {
          path: 'assets/logo.png',
          absolutePath: '/tmp/assets/logo.png',
          size: 5000,
          hash: 'abc1234567890def',
          type: 'image',
        },
        {
          path: 'assets/click.mp3',
          absolutePath: '/tmp/assets/click.mp3',
          size: 8000,
          hash: '1234567890abcdef',
          type: 'audio',
        },
      ],
      remote: [
        {
          path: 'assets/music.mp3',
          absolutePath: '/tmp/assets/music.mp3',
          size: 5000000,
          hash: 'fedcba0987654321',
          type: 'audio',
        },
      ],
    };

    const manifest = generateManifest(splitResult, 'https://cdn.example.com/game', outputDir);

    expect(manifest.version).toBe(1);
    expect(manifest.cdnBase).toBe('https://cdn.example.com/game');
    expect(Object.keys(manifest.assets)).toHaveLength(3);

    expect(manifest.assets['assets/logo.png']).toEqual({
      size: 5000,
      hash: 'abc1234567890def',
      remote: false,
      type: 'image',
    });

    expect(manifest.assets['assets/click.mp3']).toEqual({
      size: 8000,
      hash: '1234567890abcdef',
      remote: false,
      type: 'audio',
    });

    expect(manifest.assets['assets/music.mp3']).toEqual({
      size: 5000000,
      hash: 'fedcba0987654321',
      remote: true,
      type: 'audio',
    });
  });

  it('writes asset-manifest.json to outputDir', () => {
    const splitResult: SplitResult = {
      local: [
        {
          path: 'sprite.png',
          absolutePath: '/tmp/sprite.png',
          size: 1024,
          hash: 'aaaaaaaaaaaaaaaa',
          type: 'image',
        },
      ],
      remote: [],
    };

    generateManifest(splitResult, 'https://cdn.test.com', outputDir);

    const manifestPath = path.join(outputDir, 'asset-manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(content.version).toBe(1);
    expect(content.cdnBase).toBe('https://cdn.test.com');
    expect(content.assets['sprite.png']).toBeDefined();
  });

  it('handles empty SplitResult', () => {
    const splitResult: SplitResult = {
      local: [],
      remote: [],
    };

    const manifest = generateManifest(splitResult, 'https://cdn.example.com', outputDir);

    expect(manifest.version).toBe(1);
    expect(manifest.cdnBase).toBe('https://cdn.example.com');
    expect(Object.keys(manifest.assets)).toHaveLength(0);

    const manifestPath = path.join(outputDir, 'asset-manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
  });
});
