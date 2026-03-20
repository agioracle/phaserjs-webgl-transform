const _gScope = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;
const _safeSetTimeout = _gScope.setTimeout ? _gScope.setTimeout.bind(_gScope) : globalThis.setTimeout.bind(globalThis);

export class AssetLoader {
  constructor(manifest, cache, config = {}) {
    this._manifest = manifest;
    this._cache = cache;
    this._config = { retries: 3, timeout: 30000, ...config };
  }

  async loadAsset(path) {
    const asset = this._manifest.assets[path];
    if (!asset || !asset.remote) return null;
    if (this._cache.has(path, asset.hash)) return this._cache.get(path);
    const url = `${this._manifest.cdnBase}${path}`;
    const tempPath = await this._downloadWithRetry(url, this._config.retries, this._config.timeout, path);
    await this._cache.put(path, tempPath, asset.size, asset.hash);
    return this._cache.get(path);
  }

  _downloadWithRetry(url, retries, timeout, assetPath) {
    const attempt = () => new Promise((resolve, reject) => {
      wx.downloadFile({
        url, timeout,
        success(res) { res.statusCode === 200 ? resolve(res.tempFilePath) : reject(new Error(`HTTP ${res.statusCode}`)); },
        fail(err) { reject(new Error(err.errMsg || 'download failed')); },
      });
    });
    const run = (left) => attempt().catch(err => {
      if (left <= 1) throw new Error(`Failed to download ${assetPath} after ${retries} attempts`);
      const delay = Math.pow(2, retries - left) * 1000;
      return new Promise(r => _safeSetTimeout(r, delay)).then(() => run(left - 1));
    });
    return run(retries);
  }
}

export function initPhaserLoaderIntercept(Phaser, assetLoader) {
  const _originalLoad = Phaser.Loader.File.prototype.load;
  Phaser.Loader.File.prototype.load = async function () {
    try {
      const localPath = await assetLoader.loadAsset(this.src);
      if (localPath !== null) this.src = localPath;
      _originalLoad.call(this);
    } catch { this.onError(); }
  };
}
