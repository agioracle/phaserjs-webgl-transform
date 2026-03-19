/**
 * Blob + URL.createObjectURL polyfill for WeChat Mini-Game.
 *
 * WeChat does not provide Blob or URL.createObjectURL. Phaser's default image
 * loader fetches images as ArrayBuffer via XHR, wraps them in a Blob, then
 * creates a blob URL with URL.createObjectURL(). This polyfill bridges that gap.
 */

let _blobCounter = 0;
const _blobStore = new Map();

/**
 * Minimal Blob polyfill that stores data parts as a single ArrayBuffer.
 */
class WxBlob {
  constructor(parts = [], options = {}) {
    this.type = options.type || '';
    // Merge all parts into a single ArrayBuffer
    const buffers = [];
    let totalLength = 0;
    for (const part of parts) {
      let buf;
      if (part instanceof ArrayBuffer) {
        buf = new Uint8Array(part);
      } else if (ArrayBuffer.isView(part)) {
        buf = new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
      } else if (part instanceof WxBlob) {
        buf = new Uint8Array(part._buffer);
      } else if (typeof part === 'string') {
        // Simple ASCII/UTF-8 encoding
        const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
        if (encoder) {
          buf = encoder.encode(part);
        } else {
          // Fallback for environments without TextEncoder
          buf = new Uint8Array(part.length);
          for (let i = 0; i < part.length; i++) {
            buf[i] = part.charCodeAt(i) & 0xff;
          }
        }
      } else {
        // Fallback: convert to string
        const str = String(part);
        buf = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
          buf[i] = str.charCodeAt(i) & 0xff;
        }
      }
      buffers.push(buf);
      totalLength += buf.length;
    }

    this._buffer = new ArrayBuffer(totalLength);
    const view = new Uint8Array(this._buffer);
    let offset = 0;
    for (const buf of buffers) {
      view.set(buf, offset);
      offset += buf.length;
    }

    this.size = totalLength;
  }

  slice(start = 0, end = this.size, contentType = '') {
    const sliced = this._buffer.slice(start, end);
    return new WxBlob([sliced], { type: contentType || this.type });
  }

  async arrayBuffer() {
    return this._buffer.slice(0);
  }

  async text() {
    const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
    if (decoder) {
      return decoder.decode(this._buffer);
    }
    // Fallback
    const view = new Uint8Array(this._buffer);
    let str = '';
    for (let i = 0; i < view.length; i++) {
      str += String.fromCharCode(view[i]);
    }
    return str;
  }
}

/**
 * Retrieve the raw ArrayBuffer data for a wxblob:// URL.
 * Used by the Image polyfill to write blob data to a temp file.
 */
function getBlobData(url) {
  return _blobStore.get(url) || null;
}

/**
 * URL polyfill with createObjectURL / revokeObjectURL support.
 * Extends the existing URL constructor if available, otherwise provides a
 * minimal shim.
 */
const _OriginalURL = typeof URL !== 'undefined' ? URL : null;

const WxURL = _OriginalURL
  ? class WxURL extends _OriginalURL {
      constructor(...args) {
        super(...args);
      }
    }
  : class WxURL {
      constructor(url, base) {
        // Minimal URL parsing for relative/absolute URLs
        if (base) {
          this.href = base.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
        } else {
          this.href = url;
        }
        this.toString = () => this.href;
      }
    };

/**
 * createObjectURL — stores the blob and returns a wxblob:// URI.
 */
WxURL.createObjectURL = function (blob) {
  const id = 'wxblob://' + (++_blobCounter);
  _blobStore.set(id, blob);
  return id;
};

/**
 * revokeObjectURL — removes the blob from the store.
 */
WxURL.revokeObjectURL = function (url) {
  _blobStore.delete(url);
};

export { WxBlob, WxURL, getBlobData };
