import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LRUCache } from '../../src/assets/lru-cache.js';

describe('LRUCache', () => {
  let fsMock;

  beforeEach(() => {
    fsMock = {
      mkdirSync: vi.fn(), readFileSync: vi.fn(), writeFileSync: vi.fn(),
      copyFileSync: vi.fn(), unlinkSync: vi.fn(), accessSync: vi.fn(),
    };
    globalThis.wx = {
      env: { USER_DATA_PATH: '/usr/minigame' },
      getFileSystemManager: vi.fn(() => fsMock),
    };
  });
  afterEach(() => { delete globalThis.wx; });

  it('creates cache dir if not exists', async () => {
    fsMock.accessSync.mockImplementation(() => { throw new Error(); });
    fsMock.readFileSync.mockImplementation(() => { throw new Error(); });
    const cache = new LRUCache(1024);
    await cache.init();
    expect(fsMock.mkdirSync).toHaveBeenCalledWith('/usr/minigame/phaser-cache/', true);
  });

  it('loads existing metadata', async () => {
    fsMock.accessSync.mockImplementation(() => {});
    fsMock.readFileSync.mockReturnValue(JSON.stringify([
      { key: 'a.png', path: '/usr/minigame/phaser-cache/a.png', size: 100, hash: 'h1', lastAccess: 1000 },
    ]));
    const cache = new LRUCache(1024);
    await cache.init();
    expect(cache.has('a.png', 'h1')).toBe(true);
    expect(cache.getStats().totalSize).toBe(100);
  });

  it('returns false for hash mismatch', async () => {
    fsMock.accessSync.mockImplementation(() => {});
    fsMock.readFileSync.mockReturnValue(JSON.stringify([
      { key: 'a.png', path: '/p/a.png', size: 50, hash: 'old', lastAccess: 100 },
    ]));
    const cache = new LRUCache(1024);
    await cache.init();
    expect(cache.has('a.png', 'new')).toBe(false);
  });

  it('puts and retrieves entries', async () => {
    fsMock.accessSync.mockImplementation(() => {});
    fsMock.readFileSync.mockImplementation(() => { throw new Error(); });
    const cache = new LRUCache(1024);
    await cache.init();
    await cache.put('img.png', '/tmp/dl', 256, 'hashA');
    expect(cache.has('img.png', 'hashA')).toBe(true);
    expect(fsMock.copyFileSync).toHaveBeenCalled();
  });

  it('evicts LRU entries when full', async () => {
    fsMock.accessSync.mockImplementation(() => {});
    fsMock.readFileSync.mockReturnValue(JSON.stringify([
      { key: 'old.png', path: '/p/old.png', size: 400, hash: 'h1', lastAccess: 1000 },
      { key: 'new.png', path: '/p/new.png', size: 200, hash: 'h2', lastAccess: 3000 },
    ]));
    const cache = new LRUCache(700); // 600 used, max 700
    await cache.init();
    await cache.put('extra.png', '/tmp/e', 200, 'h3'); // needs 100 more -> evict old.png
    expect(cache.has('old.png', 'h1')).toBe(false);
    expect(fsMock.unlinkSync).toHaveBeenCalledWith('/p/old.png');
    expect(cache.has('extra.png', 'h3')).toBe(true);
  });

  it('flushMetadata writes entries to disk', async () => {
    fsMock.accessSync.mockImplementation(() => {});
    fsMock.readFileSync.mockImplementation(() => { throw new Error(); });
    const cache = new LRUCache(1024);
    await cache.init();
    await cache.put('x.png', '/tmp/x', 100, 'hx');
    await cache.flushMetadata();
    expect(fsMock.writeFileSync).toHaveBeenCalled();
    const written = JSON.parse(fsMock.writeFileSync.mock.calls[0][1]);
    expect(written[0].key).toBe('x.png');
  });
});
