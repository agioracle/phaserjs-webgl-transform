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
  const canvas = wx.createCanvas();
  addEventSupport(canvas);
  addDomSupport(canvas);
  GameGlobal.__wxCanvas = canvas;
  return canvas;
}

export function createOffscreenCanvas() {
  const canvas = wx.createCanvas();
  addEventSupport(canvas);
  addDomSupport(canvas);
  return canvas;
}
