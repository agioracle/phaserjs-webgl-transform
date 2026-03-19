/**
 * Detect whether a URL is a local file path (not a remote HTTP/data/blob URL).
 */
function _isLocalPath(url) {
  if (!url || typeof url !== 'string') return false;
  if (/^https?:\/\//i.test(url)) return false;
  if (/^\/\//.test(url)) return false;        // protocol-relative
  if (/^data:/i.test(url)) return false;
  if (/^blob:/i.test(url)) return false;
  if (/^wxblob:/i.test(url)) return false;
  if (/^wxfile:/i.test(url)) return false;     // wx temp file protocol
  return true;
}

class WxResponse {
  constructor(data, status, statusText, headers = {}) {
    this._data = data;
    this.status = status;
    this.statusText = statusText;
    this.ok = status >= 200 && status < 300;
    this.headers = new Map(Object.entries(headers));
    this.type = 'basic';
    this.url = '';
  }
  async json() { return typeof this._data === 'string' ? JSON.parse(this._data) : this._data; }
  async text() { return typeof this._data === 'string' ? this._data : JSON.stringify(this._data); }
  async arrayBuffer() {
    // If already an ArrayBuffer, return it directly
    if (this._data instanceof ArrayBuffer) return this._data;
    // If it's a string, encode to ArrayBuffer
    if (typeof this._data === 'string') {
      const encoder = new TextEncoder();
      return encoder.encode(this._data).buffer;
    }
    return this._data;
  }
  clone() { return new WxResponse(this._data, this.status, this.statusText, Object.fromEntries(this.headers)); }
}

export default function wxFetch(url, options = {}) {
  // --- Local file path: read directly via wx file system ---
  if (_isLocalPath(url)) {
    return _fetchLocal(url);
  }

  const method = (options.method || 'GET').toUpperCase();
  const headers = options.headers || {};

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      header: headers,
      data: options.body,
      dataType: 'text',
      responseType: 'text',
      success(res) {
        resolve(new WxResponse(res.data, res.statusCode, res.statusCode === 200 ? 'OK' : '', res.header || {}));
      },
      fail(err) {
        reject(new TypeError(err.errMsg || 'Network request failed'));
      },
    });
  });
}

/**
 * Read a local file and return it as a WxResponse.
 * Tries text first; falls back to binary ArrayBuffer for non-text files.
 */
function _fetchLocal(url) {
  return new Promise((resolve, reject) => {
    try {
      const fsm = wx.getFileSystemManager();
      let data;
      try {
        // Try reading as text first
        data = fsm.readFileSync(url, 'utf-8');
      } catch {
        // Fall back to binary read (returns ArrayBuffer)
        data = fsm.readFileSync(url);
      }
      resolve(new WxResponse(data, 200, 'OK', {}));
    } catch (err) {
      reject(new TypeError(err.message || 'Local file read failed: ' + url));
    }
  });
}

export { WxResponse };
