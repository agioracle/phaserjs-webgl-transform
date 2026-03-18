const info = wx.getSystemInfoSync();

const _listeners = new Map();

const windowShim = {
  innerWidth: info.windowWidth || info.screenWidth,
  innerHeight: info.windowHeight || info.screenHeight,
  devicePixelRatio: info.pixelRatio || 1,

  scrollX: 0, scrollY: 0,
  pageXOffset: 0, pageYOffset: 0,

  location: { href: 'game.js', protocol: 'https:', host: 'minigame', hostname: 'minigame', pathname: '/game.js', search: '', hash: '' },

  performance: typeof performance !== 'undefined' ? performance : { now: () => Date.now() },

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

export default windowShim;
