export class LRUCache {
  constructor(maxSize = 52428800) {
    this._maxSize = maxSize;
    this._cachePath = `${wx.env.USER_DATA_PATH}/phaser-cache/`;
    this._metaPath = `${wx.env.USER_DATA_PATH}/phaser-cache/_meta.json`;
    this._entries = new Map();
    this._totalSize = 0;
    this._flushChain = Promise.resolve();
    this._fs = wx.getFileSystemManager();
  }

  async init() {
    try { this._fs.accessSync(this._cachePath); }
    catch { this._fs.mkdirSync(this._cachePath, true); }
    try {
      const raw = this._fs.readFileSync(this._metaPath);
      const entries = JSON.parse(raw);
      this._totalSize = 0;
      for (const e of entries) {
        this._entries.set(e.key, { path: e.path, size: e.size, hash: e.hash, lastAccess: e.lastAccess });
        this._totalSize += e.size;
      }
    } catch { this._entries = new Map(); this._totalSize = 0; }
  }

  has(key, hash) {
    const e = this._entries.get(key);
    return e ? e.hash === hash : false;
  }

  async get(key) {
    const e = this._entries.get(key);
    if (e) e.lastAccess = Date.now();
    return `${this._cachePath}${key}`;
  }

  async put(key, tempFilePath, size, hash) {
    const existing = this._entries.get(key);
    if (existing) this._totalSize -= existing.size;
    const needed = (this._totalSize + size) - this._maxSize;
    if (needed > 0) this._evict(needed);
    const destPath = `${this._cachePath}${key}`;
    const lastSlash = destPath.lastIndexOf('/');
    if (lastSlash > 0) {
      const dir = destPath.substring(0, lastSlash + 1);
      try { this._fs.accessSync(dir); } catch { this._fs.mkdirSync(dir, true); }
    }
    this._fs.copyFileSync(tempFilePath, destPath);
    this._entries.set(key, { path: destPath, size, hash, lastAccess: Date.now() });
    this._totalSize += size;
  }

  _evict(neededSpace) {
    const sorted = [...this._entries.entries()].sort((a, b) => a[1].lastAccess - b[1].lastAccess);
    let freed = 0;
    for (const [key, entry] of sorted) {
      if (freed >= neededSpace) break;
      try { this._fs.unlinkSync(entry.path); } catch {}
      freed += entry.size;
      this._totalSize -= entry.size;
      this._entries.delete(key);
    }
  }

  async flushMetadata() {
    this._flushChain = this._flushChain.then(() => {
      const entries = [];
      for (const [key, e] of this._entries) {
        entries.push({ key, path: e.path, size: e.size, hash: e.hash, lastAccess: e.lastAccess });
      }
      this._fs.writeFileSync(this._metaPath, JSON.stringify(entries));
    });
    return this._flushChain;
  }

  getStats() {
    return { totalSize: this._totalSize, entryCount: this._entries.size, maxSize: this._maxSize };
  }
}
