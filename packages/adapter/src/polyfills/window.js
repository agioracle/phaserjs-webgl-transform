const _gScope = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;
const info = wx.getSystemInfoSync();

const _listeners = new Map();

// screen object — Phaser's ScaleManager reads screen.width/height/orientation
const screenShim = {
  width: info.screenWidth || info.windowWidth,
  height: info.screenHeight || info.windowHeight,
  availWidth: info.screenWidth || info.windowWidth,
  availHeight: info.screenHeight || info.windowHeight,
  colorDepth: 24,
  pixelDepth: 24,
  get orientation() {
    return {
      type: (info.screenWidth || 375) > (info.screenHeight || 667)
        ? 'landscape-primary'
        : 'portrait-primary',
      angle: 0,
      addEventListener() {},
      removeEventListener() {},
    };
  },
};

const windowShim = {
  innerWidth: info.windowWidth || info.screenWidth,
  innerHeight: info.windowHeight || info.screenHeight,
  outerWidth: info.screenWidth || info.windowWidth,
  outerHeight: info.screenHeight || info.windowHeight,
  devicePixelRatio: info.pixelRatio || 1,
  screen: screenShim,

  scrollX: 0, scrollY: 0,
  pageXOffset: 0, pageYOffset: 0,

  // Touch support flag — Phaser checks 'ontouchstart' in window
  ontouchstart: null,

  location: { href: 'game.js', protocol: 'https:', host: 'minigame', hostname: 'minigame', pathname: '/game.js', search: '', hash: '' },

  performance: typeof performance !== 'undefined' ? performance : { now: () => Date.now() },

  // Timer functions — use _gScope explicitly to avoid var-hoisting issues
  // (the CLI's intro creates `var setTimeout = ...` which hoists and shadows
  //  bare references at adapter-evaluation time)
  setTimeout: _gScope.setTimeout.bind(_gScope),
  clearTimeout: _gScope.clearTimeout.bind(_gScope),
  setInterval: _gScope.setInterval.bind(_gScope),
  clearInterval: _gScope.clearInterval.bind(_gScope),

  // Animation frame — WeChat provides requestAnimationFrame globally
  requestAnimationFrame: _gScope.requestAnimationFrame
    ? _gScope.requestAnimationFrame.bind(_gScope)
    : (cb) => _gScope.setTimeout(cb, 1000 / 60),
  cancelAnimationFrame: _gScope.cancelAnimationFrame
    ? _gScope.cancelAnimationFrame.bind(_gScope)
    : (id) => _gScope.clearTimeout(id),

  // Focus/blur stubs
  focus() {},
  blur() {},

  // matchMedia stub — Phaser may query media features
  matchMedia() {
    return {
      matches: false,
      media: '',
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
    };
  },

  // getComputedStyle stub
  getComputedStyle() {
    return {
      getPropertyValue() { return ''; },
    };
  },

  addEventListener(type, listener) {
    if (!_listeners.has(type)) _listeners.set(type, []);
    _listeners.get(type).push(listener);
  },
  removeEventListener(type, listener) {
    const list = _listeners.get(type);
    if (!list) return;
    const idx = list.indexOf(listener);
    if (idx !== -1) list.splice(idx, 1);
  },
  dispatchEvent(event) {
    const list = _listeners.get(event.type);
    if (list) list.forEach(fn => fn(event));
  },
};

windowShim.self = windowShim;
windowShim.top = windowShim;
windowShim.parent = windowShim;
windowShim.window = windowShim;

export { screenShim };
export default windowShim;
