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
  // Provide a style object that reports CSS pixel dimensions (not physical pixels).
  // Phaser's ScaleManager reads style.width/height to determine the display size.
  // Touch events from WeChat are in CSS pixels, so we must report CSS dimensions
  // here for Phaser's coordinate mapping to work correctly.
  if (!canvas.style || canvas.style.width === '') {
    canvas.style = { width: info.screenWidth + 'px', height: info.screenHeight + 'px' };
  }

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

  // Phaser's ScaleManager reads getBoundingClientRect — must return CSS pixel
  // dimensions so touch coordinate mapping works correctly on high-DPR devices.
  if (!canvas.getBoundingClientRect) {
    canvas.getBoundingClientRect = function() {
      return {
        x: 0, y: 0,
        top: 0, left: 0,
        bottom: info.screenHeight,
        right: info.screenWidth,
        width: info.screenWidth,
        height: info.screenHeight,
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

  // Phaser may read offsetWidth/offsetHeight — CSS pixels
  if (canvas.offsetWidth === undefined) {
    Object.defineProperty(canvas, 'offsetWidth', {
      get() { return info.screenWidth; },
      configurable: true,
    });
  }
  if (canvas.offsetHeight === undefined) {
    Object.defineProperty(canvas, 'offsetHeight', {
      get() { return info.screenHeight; },
      configurable: true,
    });
  }

  return canvas;
}

/**
 * Bridge WeChat global touch events → DOM-like events on the canvas.
 * Phaser listens on canvas.addEventListener('touchstart', ...) etc.
 * WeChat only fires these via wx.onTouchStart / wx.onTouchMove / etc.
 */
function bridgeTouchEvents(canvas) {
  const dpr = info.pixelRatio || 1;

  function convertTouches(wxTouches) {
    return (wxTouches || []).map(t => ({
      identifier: t.identifier,
      // wx touch coords are in CSS pixels; Phaser may need them
      // relative to canvas. Since canvas fills the screen, no offset.
      pageX: t.clientX,
      pageY: t.clientY,
      clientX: t.clientX,
      clientY: t.clientY,
      screenX: t.clientX,
      screenY: t.clientY,
      // Phaser reads target
      target: canvas,
    }));
  }

  function makeTouchEvent(type, wxEvent) {
    const touches = convertTouches(wxEvent.touches);
    const changedTouches = convertTouches(wxEvent.changedTouches);
    return {
      type,
      target: canvas,
      currentTarget: canvas,
      touches,
      changedTouches,
      targetTouches: touches,
      timeStamp: Date.now(),
      preventDefault() {},
      stopPropagation() {},
    };
  }

  wx.onTouchStart(function(e) {
    canvas.dispatchEvent(makeTouchEvent('touchstart', e));
  });
  wx.onTouchMove(function(e) {
    canvas.dispatchEvent(makeTouchEvent('touchmove', e));
  });
  wx.onTouchEnd(function(e) {
    canvas.dispatchEvent(makeTouchEvent('touchend', e));
  });
  wx.onTouchCancel(function(e) {
    canvas.dispatchEvent(makeTouchEvent('touchcancel', e));
  });
}

export function createPrimaryCanvas() {
  // If the adapter runs more than once (e.g. first via require() in game.js,
  // then inline in game-bundle.js), reuse the existing on-screen canvas
  // instead of creating a new off-screen one that overwrites it.
  let canvas;
  if (typeof GameGlobal !== 'undefined' && GameGlobal.__wxCanvas) {
    canvas = GameGlobal.__wxCanvas;
  } else {
    canvas = wx.createCanvas();
  }

  // Apply patches idempotently — the canvas may have been pre-created by
  // game.js (for splash screen) without DOM-like capabilities.
  if (!canvas.__phaserPatched) {
    addEventSupport(canvas);
    // Eagerly create WebGL context on primary canvas to guarantee it's
    // available — prevents '2d' context lock-out and attrs issues.
    wrapGetContext(canvas, true);
    addDomSupport(canvas);
    // Bridge WeChat global touch events to canvas DOM events
    bridgeTouchEvents(canvas);
    canvas.__phaserPatched = true;
  }

  if (typeof GameGlobal !== 'undefined') {
    GameGlobal.__wxCanvas = canvas;
  }
  return canvas;
}

export function createOffscreenCanvas() {
  const canvas = wx.createCanvas();
  addEventSupport(canvas);
  wrapGetContext(canvas, false);
  addDomSupport(canvas);
  return canvas;
}
