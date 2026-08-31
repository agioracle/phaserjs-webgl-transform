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

  // ---------------------------------------------------------------------------
  // WebGL texImage2D source compatibility
  // ---------------------------------------------------------------------------
  //
  // In the Douyin developer tool, Phaser can reach WebGL texture upload with
  // adapter-created Image / Canvas wrapper objects (notably Phaser's built-in
  // base64 __DEFAULT / __MISSING / __WHITE textures). The underlying WebGL
  // implementation rejects those wrappers with:
  //
  //   TypeError: Failed to execute 'texImage2D' ... Overload resolution failed.
  //
  // Native canvases created by tt.createCanvas(), however, are accepted (the
  // splash screen already uploads one successfully). Patch WebGL contexts so
  // image-like wrapper uploads fall back through a tiny tt canvas.

  var _patchedContexts = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
  var _patchedCanvases = typeof WeakSet !== 'undefined' ? new WeakSet() : null;

  function _isWebGLContextType(type) {
    return type === 'webgl' || type === 'experimental-webgl' || type === 'webgl2';
  }

  function _isImageLike(source) {
    return !!(
      source &&
      (source.tagName === 'IMG' ||
        source.nodeName === 'IMG' ||
        typeof source.src === 'string' ||
        typeof source.onload === 'function' ||
        typeof source.naturalWidth === 'number')
    );
  }

  function _nativeCanvasFromWrapper(source) {
    if (
      source &&
      source.canvas &&
      source.canvas !== source &&
      typeof source.canvas.getContext === 'function'
    ) {
      return source.canvas;
    }
    return null;
  }

  function _createNativeCanvas(width, height) {
    var api = _global.tt || (typeof tt !== 'undefined' ? tt : null);
    var canvas = null;

    if (api && typeof api.createCanvas === 'function') {
      canvas = api.createCanvas();
    } else if (_global.document && typeof _global.document.createElement === 'function') {
      canvas = _global.document.createElement('canvas');
    } else if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      canvas = document.createElement('canvas');
    }

    if (!canvas) return null;

    canvas.width = width;
    canvas.height = height;

    // If document.createElement returned the adapter's Canvas wrapper, unwrap
    // it before giving it back to WebGL.
    return _nativeCanvasFromWrapper(canvas) || canvas;
  }

  function _sourceToTexImageCanvas(source) {
    var nativeCanvas = _nativeCanvasFromWrapper(source);
    if (nativeCanvas) {
      return nativeCanvas;
    }

    if (!_isImageLike(source)) {
      return null;
    }

    var width = source.naturalWidth || source.width || source.videoWidth || 1;
    var height = source.naturalHeight || source.height || source.videoHeight || 1;
    var canvas = _createNativeCanvas(width, height);
    if (!canvas) return null;

    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx || typeof ctx.drawImage !== 'function') {
      return null;
    }

    try {
      if (typeof ctx.clearRect === 'function') {
        ctx.clearRect(0, 0, width, height);
      }
      ctx.drawImage(source, 0, 0, width, height);
    } catch (e) {
      return null;
    }

    return canvas;
  }

  function _fallbackPixelsForImageLike(source) {
    if (!_isImageLike(source)) return null;

    // Keep this last-resort path intentionally narrow. It is only for data URL
    // bootstrap images (Phaser's built-in __DEFAULT / __MISSING / __WHITE)
    // where crashing is worse than substituting a solid texture. Real game
    // assets should normally be drawable onto the tt canvas above; if not, the
    // original WebGL error is more useful than silently blanking them.
    if (typeof source.src !== 'string' || source.src.indexOf('data:image/') !== 0) {
      return null;
    }

    var width = source.naturalWidth || source.width || source.videoWidth || 1;
    var height = source.naturalHeight || source.height || source.videoHeight || 1;
    var data = new Uint8Array(width * height * 4);

    // Phaser's __WHITE is 4x4; preserve it as white because Phaser uses it for
    // tint/fill effects. The larger default/missing placeholders are safe as
    // transparent fallback textures.
    var isLikelyWhiteTexture = width <= 4 && height <= 4;
    for (var i = 0; i < data.length; i += 4) {
      data[i] = isLikelyWhiteTexture ? 255 : 0;
      data[i + 1] = isLikelyWhiteTexture ? 255 : 0;
      data[i + 2] = isLikelyWhiteTexture ? 255 : 0;
      data[i + 3] = isLikelyWhiteTexture ? 255 : 0;
    }

    return { width: width, height: height, data: data };
  }

  function _texImage2DWithFallback(ctx, originalTexImage2D, argsLike) {
    try {
      return originalTexImage2D.apply(ctx, argsLike);
    } catch (err) {
      // Only the source-object overload has 6 arguments:
      // texImage2D(target, level, internalformat, format, type, source)
      if (argsLike.length === 6) {
        var args = Array.prototype.slice.call(argsLike);
        var originalSource = args[5];
        var replacement = _sourceToTexImageCanvas(originalSource);

        if (replacement && replacement !== args[5]) {
          args[5] = replacement;
          try {
            return originalTexImage2D.apply(ctx, args);
          } catch (replacementErr) {
            // Fall through to the data-URL bootstrap fallback below.
          }
        }

        var fallback = _fallbackPixelsForImageLike(originalSource);
        if (fallback) {
          return originalTexImage2D.call(
            ctx,
            args[0],
            args[1],
            args[2],
            fallback.width,
            fallback.height,
            0,
            args[3],
            args[4],
            fallback.data
          );
        }
      }

      throw err;
    }
  }

  function _patchWebGLContext(gl) {
    if (!gl || typeof gl.texImage2D !== 'function') return gl;
    if (_patchedContexts && _patchedContexts.has(gl)) return gl;
    if (gl.__ttTexImage2DPatched) return gl;

    var originalTexImage2D = gl.texImage2D;

    try {
      gl.texImage2D = function () {
        return _texImage2DWithFallback(this, originalTexImage2D, arguments);
      };
      gl.__ttTexImage2DPatched = true;
      if (_patchedContexts) _patchedContexts.add(gl);
    } catch (e) {
      // Some host objects expose read-only methods. In that case return a
      // proxy context whose texImage2D property provides the fallback while all
      // other methods stay bound to the native context.
      if (typeof Proxy !== 'undefined') {
        var proxy = new Proxy(gl, {
          get: function (target, prop) {
            if (prop === 'texImage2D') {
              return function () {
                return _texImage2DWithFallback(target, originalTexImage2D, arguments);
              };
            }
            var value = target[prop];
            return typeof value === 'function' ? value.bind(target) : value;
          },
          set: function (target, prop, value) {
            target[prop] = value;
            return true;
          }
        });
        if (_patchedContexts) _patchedContexts.add(proxy);
        return proxy;
      }
    }

    return gl;
  }

  function _patchCanvas(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') return canvas;
    if (_patchedCanvases && _patchedCanvases.has(canvas)) return canvas;
    if (canvas.__ttGetContextPatched) return canvas;

    var originalGetContext = canvas.getContext;

    try {
      canvas.getContext = function (type) {
        var ctx = originalGetContext.apply(this, arguments);
        if (_isWebGLContextType(type)) {
          ctx = _patchWebGLContext(ctx);
        }
        return ctx;
      };
      canvas.__ttGetContextPatched = true;
      if (_patchedCanvases) _patchedCanvases.add(canvas);
    } catch (e) {
      // Read-only getContext — leave unpatched.
    }

    return canvas;
  }

  function _patchCreateCanvas(api) {
    if (!api || typeof api.createCanvas !== 'function' || api.__ttCreateCanvasPatched) {
      return;
    }

    var originalCreateCanvas = api.createCanvas;

    try {
      api.createCanvas = function () {
        return _patchCanvas(originalCreateCanvas.apply(this, arguments));
      };
      api.__ttCreateCanvasPatched = true;
    } catch (e) {
      // Read-only API — leave unpatched.
    }
  }

  function _patchDocumentCreateElement(doc) {
    if (!doc || typeof doc.createElement !== 'function' || doc.__ttCreateElementPatched) {
      return;
    }

    var originalCreateElement = doc.createElement;

    try {
      doc.createElement = function (tagName) {
        var element = originalCreateElement.apply(this, arguments);
        if (String(tagName).toLowerCase() === 'canvas') {
          _patchCanvas(element);
        }
        return element;
      };
      doc.__ttCreateElementPatched = true;
    } catch (e) {
      // Read-only document — leave unpatched.
    }
  }

  _patchCreateCanvas(_global.tt);
  if (typeof tt !== 'undefined' && tt !== (_global && _global.tt)) {
    _patchCreateCanvas(tt);
  }

  _patchDocumentCreateElement(_global.document);
  if (typeof document !== 'undefined' && document !== (_global && _global.document)) {
    _patchDocumentCreateElement(document);
  }

  _patchCanvas(_global.canvas);
  _patchCanvas(_global.screencanvas);
  if (typeof window !== 'undefined') {
    _patchCanvas(window.canvas);
  }
})();
