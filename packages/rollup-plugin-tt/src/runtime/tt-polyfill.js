/**
 * tt-polyfill.js — supplementary Blob + URL polyfill for Douyin Mini-Game.
 *
 * The official tt-adapter (per its docs) does NOT expose a usable `Blob` global
 * and its `URL.createObjectURL` only works with the adapter's private Blob
 * class, so from game code both are effectively unavailable. Phaser reaches for
 * `new Blob(...)` + `URL.createObjectURL(...)` on a few loader paths — notably
 * `this.load.svg()` / `this.load.htmlTexture()`, and `Features.file` detection.
 * Without this shim those paths throw `ReferenceError: Blob is not defined`.
 *
 * This file is a self-injecting script (mirrors tt-adapter.js), loaded via
 * `require('./tt-polyfill.js')` right AFTER the adapter. It EXTENDS the runtime
 * without modifying tt-adapter.js: it installs a matched TtBlob + TtURL pair on
 * the globals so the Blob → createObjectURL pipeline is internally consistent.
 *
 * Design mirrors the WeChat adapter's polyfills/blob-url.js (WxBlob / WxURL).
 */
(function () {
  'use strict';

  var _global =
    typeof GameGlobal !== 'undefined'
      ? GameGlobal
      : typeof globalThis !== 'undefined'
      ? globalThis
      : this;

  // Idempotent: requiring more than once is a no-op.
  if (_global.__ttPolyfillInjected) {
    return;
  }
  _global.__ttPolyfillInjected = true;

  var _blobCounter = 0;
  var _blobStore = new Map();

  /**
   * Minimal Blob polyfill that stores all parts merged into a single
   * ArrayBuffer. Matches the subset of the Blob API that Phaser relies on
   * (size, type, slice, arrayBuffer, text).
   */
  function TtBlob(parts, options) {
    parts = parts || [];
    options = options || {};
    this.type = options.type || '';

    var buffers = [];
    var totalLength = 0;
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      var buf;
      if (part instanceof ArrayBuffer) {
        buf = new Uint8Array(part);
      } else if (ArrayBuffer.isView(part)) {
        buf = new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
      } else if (part instanceof TtBlob) {
        buf = new Uint8Array(part._buffer);
      } else if (typeof part === 'string') {
        // The official adapter does not provide TextEncoder, so encode
        // manually (UTF-8 for ASCII, byte-truncation otherwise — sufficient
        // for the SVG/XML strings Phaser passes through Blob).
        if (typeof TextEncoder !== 'undefined') {
          buf = new TextEncoder().encode(part);
        } else {
          buf = _encodeUtf8(part);
        }
      } else {
        var str = String(part);
        buf = _encodeUtf8(str);
      }
      buffers.push(buf);
      totalLength += buf.length;
    }

    this._buffer = new ArrayBuffer(totalLength);
    var view = new Uint8Array(this._buffer);
    var offset = 0;
    for (var j = 0; j < buffers.length; j++) {
      view.set(buffers[j], offset);
      offset += buffers[j].length;
    }

    this.size = totalLength;
  }

  TtBlob.prototype.slice = function (start, end, contentType) {
    if (start === undefined) start = 0;
    if (end === undefined) end = this.size;
    var sliced = this._buffer.slice(start, end);
    return new TtBlob([sliced], { type: contentType || this.type });
  };

  TtBlob.prototype.arrayBuffer = function () {
    return Promise.resolve(this._buffer.slice(0));
  };

  TtBlob.prototype.text = function () {
    var buffer = this._buffer;
    if (typeof TextDecoder !== 'undefined') {
      return Promise.resolve(new TextDecoder().decode(buffer));
    }
    var view = new Uint8Array(buffer);
    var str = '';
    for (var i = 0; i < view.length; i++) {
      str += String.fromCharCode(view[i]);
    }
    return Promise.resolve(str);
  };

  function _encodeUtf8(str) {
    // Minimal UTF-8 encoder (covers the code points in SVG/XML markup).
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else {
        bytes.push(
          0xe0 | (code >> 12),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f)
        );
      }
    }
    return new Uint8Array(bytes);
  }

  /**
   * Retrieve the stored TtBlob for a ttblob:// URL. Exposed on the global for
   * advanced use (e.g. a custom loader that needs the raw bytes).
   */
  function getBlobData(url) {
    return _blobStore.get(url) || null;
  }

  // Preserve the adapter's existing URL (it provides instance parsing +
  // searchParams). We only augment/replace the object-URL statics so they work
  // with OUR TtBlob. If no URL exists, provide a minimal constructor.
  var _ExistingURL = _global.URL || (typeof URL !== 'undefined' ? URL : null);

  var TtURL;
  if (_ExistingURL) {
    TtURL = _ExistingURL;
  } else {
    TtURL = function (url, base) {
      if (base) {
        this.href = String(base).replace(/\/$/, '') + '/' + String(url).replace(/^\//, '');
      } else {
        this.href = String(url);
      }
    };
    TtURL.prototype.toString = function () {
      return this.href;
    };
  }

  // createObjectURL — store the blob and return a ttblob:// URI.
  TtURL.createObjectURL = function (blob) {
    var id = 'ttblob://' + (++_blobCounter);
    _blobStore.set(id, blob);
    return id;
  };

  // revokeObjectURL — drop the stored blob.
  TtURL.revokeObjectURL = function (url) {
    _blobStore.delete(url);
  };

  // --- Attach to the runtime globals (extension only) ---
  // Blob is missing entirely from the adapter — always install ours.
  // URL exists but its object-URL statics are now TtBlob-aware.
  function _attach(target) {
    if (!target) return;
    try {
      target.Blob = TtBlob;
    } catch (e) {
      /* read-only — ignore */
    }
    try {
      target.URL = TtURL;
    } catch (e) {
      /* read-only — ignore */
    }
    try {
      target.__ttGetBlobData = getBlobData;
    } catch (e) {
      /* ignore */
    }
  }

  _attach(_global);
  // On real devices the adapter sets global.window = global, so this is the
  // same object; in the developer tool `window` is the real window object.
  if (typeof window !== 'undefined' && window !== _global) {
    _attach(window);
  }
  if (typeof globalThis !== 'undefined' && globalThis !== _global) {
    _attach(globalThis);
  }
})();
