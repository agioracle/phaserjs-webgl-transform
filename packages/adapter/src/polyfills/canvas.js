const _canvasListeners = new Map();

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

export function createPrimaryCanvas() {
  const canvas = wx.createCanvas();
  addEventSupport(canvas);
  canvas.style = { width: '', height: '' };
  GameGlobal.__wxCanvas = canvas;
  return canvas;
}

export function createOffscreenCanvas() {
  const canvas = wx.createCanvas();
  addEventSupport(canvas);
  canvas.style = { width: '', height: '' };
  return canvas;
}
