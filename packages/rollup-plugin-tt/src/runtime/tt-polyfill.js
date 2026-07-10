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
 * Critically, Phaser's `File.createObjectURL` does
 * `image.src = URL.createObjectURL(blob)`. The Douyin image (tt.createImage())
 * cannot load a synthetic `blob:`/`ttblob:` scheme, so `createObjectURL` here
 * returns a real `data:<type>;base64,<...>` URL — which the native image loads
 * directly (base64 is a supported adapter capability). This is what makes the
 * SVG / HTMLTexture load paths actually work, not just stop throwing.
 *
 * This file is a self-injecting script (mirrors tt-adapter.js), loaded via
 * `require('./tt-polyfill.js')` right AFTER the adapter. It EXTENDS the runtime
 * without modifying tt-adapter.js: it installs a matched TtBlob + TtURL pair on
 * the globals so the Blob → createObjectURL → image.src pipeline works.
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

  var _B64 =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  // Base64-encode an ArrayBuffer. Prefers the runtime's btoa when available
  // (the tt-adapter exposes it), otherwise falls back to a manual encoder.
  function _base64FromBuffer(buffer) {
    var view = new Uint8Array(buffer);
    if (typeof btoa === 'function') {
      var binary = '';
      // Chunk to avoid String.fromCharCode.apply argument-length limits.
      var CHUNK = 0x8000;
      for (var k = 0; k < view.length; k += CHUNK) {
        binary += String.fromCharCode.apply(
          null,
          view.subarray(k, k + CHUNK)
        );
      }
      return btoa(binary);
    }
    var out = '';
    var i = 0;
    for (; i + 2 < view.length; i += 3) {
      var n = (view[i] << 16) | (view[i + 1] << 8) | view[i + 2];
      out +=
        _B64[(n >> 18) & 63] +
        _B64[(n >> 12) & 63] +
        _B64[(n >> 6) & 63] +
        _B64[n & 63];
    }
    var rem = view.length - i;
    if (rem === 1) {
      var a = view[i] << 16;
      out += _B64[(a >> 18) & 63] + _B64[(a >> 12) & 63] + '==';
    } else if (rem === 2) {
      var b = (view[i] << 16) | (view[i + 1] << 8);
      out += _B64[(b >> 18) & 63] + _B64[(b >> 12) & 63] + _B64[(b >> 6) & 63] + '=';
    }
    return out;
  }

  // Preserve the adapter's existing URL (it provides instance parsing +
  // searchParams). We only augment/replace the object-URL statics. If no URL
  // exists, provide a minimal constructor.
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

  // createObjectURL — return a `data:` URL, NOT a synthetic blob scheme.
  //
  // Phaser's File.createObjectURL does `image.src = URL.createObjectURL(blob)`
  // (loader/File.js) for SVG / HTMLTexture. The Douyin image (tt.createImage())
  // cannot load a made-up `blob:`/`ttblob:` scheme, but it CAN load a data URL
  // (base64 is a supported capability). So encode the blob's bytes into a
  // `data:<type>;base64,<...>` URL that the native image loads directly.
  TtURL.createObjectURL = function (blob) {
    try {
      var buffer =
        blob && blob._buffer
          ? blob._buffer
          : blob instanceof ArrayBuffer
          ? blob
          : null;
      if (!buffer) {
        return '';
      }
      var type = (blob && blob.type) || 'application/octet-stream';
      return 'data:' + type + ';base64,' + _base64FromBuffer(buffer);
    } catch (e) {
      return '';
    }
  };

  // revokeObjectURL — data URLs hold no resources, so this is a safe no-op.
  TtURL.revokeObjectURL = function () {};

  // --- Attach to the runtime globals (extension only) ---
  // Blob is missing entirely from the adapter — always install ours.
  // URL exists but its object-URL statics now produce loadable data URLs.
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
