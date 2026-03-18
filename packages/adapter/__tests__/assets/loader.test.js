import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AssetLoader, initPhaserLoaderIntercept } from '../../src/assets/loader.js';

describe('AssetLoader', () => {
  let cache, manifest;

  beforeEach(() => {
    cache = { has: vi.fn(), get: vi.fn(), put: vi.fn() };
    manifest = {
      cdnBase: 'https://cdn.example.com/',
      assets: {
        'hero.png': { size: 1024, hash: 'abc', remote: true },
        'local.json': { size: 512, hash: 'def', remote: false },
      },
    };
    globalThis.wx = { downloadFile: vi.fn() };
  });
  afterEach(() => { delete globalThis.wx; });

  it('returns null for unknown paths', async () => {
    const loader = new AssetLoader(manifest, cache);
    expect(await loader.loadAsset('unknown.png')).toBeNull();
  });

  it('returns null for local assets', async () => {
    const loader = new AssetLoader(manifest, cache);
    expect(await loader.loadAsset('local.json')).toBeNull();
  });

  it('returns cached path on cache hit', async () => {
    cache.has.mockReturnValue(true);
    cache.get.mockResolvedValue('/cache/hero.png');
    const loader = new AssetLoader(manifest, cache);
    expect(await loader.loadAsset('hero.png')).toBe('/cache/hero.png');
    expect(wx.downloadFile).not.toHaveBeenCalled();
  });

  it('downloads and caches on miss', async () => {
    cache.has.mockReturnValue(false);
    cache.put.mockResolvedValue(undefined);
    cache.get.mockResolvedValue('/cache/hero.png');
    wx.downloadFile.mockImplementation(({ success }) => {
      success({ statusCode: 200, tempFilePath: '/tmp/dl' });
    });
    const loader = new AssetLoader(manifest, cache);
    expect(await loader.loadAsset('hero.png')).toBe('/cache/hero.png');
    expect(cache.put).toHaveBeenCalledWith('hero.png', '/tmp/dl', 1024, 'abc');
  });

  it('throws after retries exhausted', async () => {
    cache.has.mockReturnValue(false);
    wx.downloadFile.mockImplementation(({ fail }) => { fail({ errMsg: 'err' }); });
    const origSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = fn => fn();
    const loader = new AssetLoader(manifest, cache, { retries: 2, timeout: 1000 });
    await expect(loader.loadAsset('hero.png')).rejects.toThrow(/after 2 attempts/);
    globalThis.setTimeout = origSetTimeout;
  });
});

describe('initPhaserLoaderIntercept', () => {
  it('replaces Phaser.Loader.File.prototype.load and routes through loader', async () => {
    const originalLoad = vi.fn();
    const Phaser = { Loader: { File: { prototype: { load: originalLoad } } } };
    const assetLoader = { loadAsset: vi.fn().mockResolvedValue('/cache/hero.png') };
    initPhaserLoaderIntercept(Phaser, assetLoader);
    const file = { src: 'hero.png', onError: vi.fn() };
    await Phaser.Loader.File.prototype.load.call(file);
    expect(file.src).toBe('/cache/hero.png');
    expect(originalLoad).toHaveBeenCalled();
  });
});
