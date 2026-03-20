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

  // NOTE: 'ontouchstart' is intentionally NOT set here.
  // Phaser's touch detection uses 'ontouchstart' in document.documentElement
  // (set in document.js), which works fine. But Phaser's HTML5AudioSoundManager
  // and HTML5AudioFile use 'ontouchstart' in window to lock audio playback,
  // requiring a user gesture to unlock. WeChat Mini-Game has no autoplay
  // restriction, so we avoid setting it here to prevent unnecessary audio locking.

  location: { href: 'game.js', protocol: 'https:', host: 'minigame', hostname: 'minigame', pathname: '/game.js', search: '', hash: '' },

  performance: typeof performance !== 'undefined' ? performance : { now: () => Date.now() },

  // Timer functions — on iOS real devices, timer functions may not be properties
  // of GameGlobal but still exist in the JavaScript global scope. We try _gScope
  // first, then fall back to globalThis. Use explicit references to avoid
  // var-hoisting issues (the CLI's intro creates `var setTimeout = ...` which
  // hoists and shadows bare references at adapter-evaluation time).
  setTimeout: (_gScope.setTimeout || globalThis.setTimeout).bind(_gScope),
  clearTimeout: (_gScope.clearTimeout || globalThis.clearTimeout).bind(_gScope),
  setInterval: (_gScope.setInterval || globalThis.setInterval).bind(_gScope),
  clearInterval: (_gScope.clearInterval || globalThis.clearInterval).bind(_gScope),

  // Animation frame — WeChat provides requestAnimationFrame globally
  requestAnimationFrame: (_gScope.requestAnimationFrame || globalThis.requestAnimationFrame)
    ? (_gScope.requestAnimationFrame || globalThis.requestAnimationFrame).bind(_gScope)
    : (cb) => (_gScope.setTimeout || globalThis.setTimeout).call(_gScope, cb, 1000 / 60),
  cancelAnimationFrame: (_gScope.cancelAnimationFrame || globalThis.cancelAnimationFrame)
    ? (_gScope.cancelAnimationFrame || globalThis.cancelAnimationFrame).bind(_gScope)
    : (id) => (_gScope.clearTimeout || globalThis.clearTimeout).call(_gScope, id),

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
