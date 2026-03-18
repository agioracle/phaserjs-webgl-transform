const info = typeof wx !== 'undefined' ? wx.getSystemInfoSync() : { screenWidth: 375, screenHeight: 667 };

function addEventSupport(canvas) {
  canvas._listeners = new Map();
  canvas.addEventListener = function(type, listener) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(listener);
  };
  canvas.removeEventListener = function(type, listener) {
    const list = this._listeners.get(type);
    if (!list) return;
    const idx = list.indexOf(listener);
    if (idx !== -1) list.splice(idx, 1);
  };
  canvas.dispatchEvent = function(event) {
    const list = this._listeners.get(event.type);
    if (list) list.forEach(fn => fn(event));
  };
  return canvas;
}

/**
 * Wrap getContext so that:
 * 1. For the primary canvas, eagerly obtain and cache a WebGL context
 *    (avoids issues with attrs WeChat doesn't support).
 * 2. For any canvas, handle fallback from experimental-webgl → webgl.
 */
function wrapGetContext(canvas, eagleWebGL) {
  const _orig = canvas.getContext;

  // Eagerly create the WebGL context on primary canvas before anyone
  // else can request a '2d' context and lock it.
  let _glCache = null;
  if (eagleWebGL) {
    try { _glCache = _orig.call(canvas, 'webgl'); } catch (e) { /* ignore */ }
    if (!_glCache) {
      try { _glCache = _orig.call(canvas, 'experimental-webgl'); } catch (e) { /* ignore */ }
    }
  }

  canvas.getContext = function(type, attrs) {
    const t = (type || '').toLowerCase();

    if (t === 'webgl' || t === 'webgl2' || t === 'experimental-webgl') {
      // Return cached context if we have one
      if (_glCache) return _glCache;

      // Try all fallbacks
      let ctx = null;
      try { ctx = _orig.call(canvas, 'webgl', attrs); } catch (e) { /* ignore */ }
      if (!ctx) { try { ctx = _orig.call(canvas, 'webgl'); } catch (e) { /* ignore */ } }
      if (!ctx) { try { ctx = _orig.call(canvas, 'experimental-webgl'); } catch (e) { /* ignore */ } }
      if (ctx) _glCache = ctx;
      return ctx;
    }

    // Non-WebGL (2d, etc.)
    try { return _orig.call(canvas, t, attrs); } catch (e) {
      return _orig.call(canvas, t);
    }
  };
}

function addDomSupport(canvas) {
  if (!canvas.style) canvas.style = { width: '', height: '' };

  // Phaser reads tagName to identify element type
  if (!canvas.tagName) canvas.tagName = 'CANVAS';

  // Phaser calls setAttribute/getAttribute for width/height/id
  const _attrs = {};
  if (!canvas.setAttribute) {
    canvas.setAttribute = function(key, val) {
      _attrs[key] = val;
      if (key === 'width') canvas.width = parseInt(val, 10);
      if (key === 'height') canvas.height = parseInt(val, 10);
    };
  }
  if (!canvas.getAttribute) {
    canvas.getAttribute = function(key) {
      return _attrs[key] !== undefined ? _attrs[key] : null;
    };
  }

  // Phaser's ScaleManager reads getBoundingClientRect
  if (!canvas.getBoundingClientRect) {
    canvas.getBoundingClientRect = function() {
      return {
        x: 0, y: 0,
        top: 0, left: 0,
        bottom: canvas.height || info.screenHeight,
        right: canvas.width || info.screenWidth,
        width: canvas.width || info.screenWidth,
        height: canvas.height || info.screenHeight,
      };
    };
  }

  // Phaser checks parentNode for DOM attachment
  if (!canvas.parentNode) {
    canvas.parentNode = {
      tagName: 'BODY',
      appendChild() {},
      removeChild() {},
      insertBefore() {},
      getBoundingClientRect() {
        return {
          x: 0, y: 0, top: 0, left: 0,
          bottom: info.screenHeight, right: info.screenWidth,
          width: info.screenWidth, height: info.screenHeight,
        };
      },
    };
  }

  // Phaser may call focus on canvas
  if (!canvas.focus) canvas.focus = function() {};

  // Phaser may read offsetWidth/offsetHeight
  if (canvas.offsetWidth === undefined) {
    Object.defineProperty(canvas, 'offsetWidth', {
      get() { return canvas.width || info.screenWidth; },
      configurable: true,
    });
  }
  if (canvas.offsetHeight === undefined) {
    Object.defineProperty(canvas, 'offsetHeight', {
      get() { return canvas.height || info.screenHeight; },
      configurable: true,
    });
  }

  return canvas;
}

export function createPrimaryCanvas() {
  // If the adapter runs more than once (e.g. first via require() in game.js,
  // then inline in game-bundle.js), reuse the existing on-screen canvas
  // instead of creating a new off-screen one that overwrites it.
  if (typeof GameGlobal !== 'undefined' && GameGlobal.__wxCanvas) {
    return GameGlobal.__wxCanvas;
  }

  const canvas = wx.createCanvas();
  addEventSupport(canvas);
  // Eagerly create WebGL context on primary canvas to guarantee it's
  // available — prevents '2d' context lock-out and attrs issues.
  wrapGetContext(canvas, true);
  addDomSupport(canvas);
  GameGlobal.__wxCanvas = canvas;
  return canvas;
}

export function createOffscreenCanvas() {
  const canvas = wx.createCanvas();
  addEventSupport(canvas);
  wrapGetContext(canvas, false);
  addDomSupport(canvas);
  return canvas;
}
