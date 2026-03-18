const _listeners = new Map();

const info = typeof wx !== 'undefined' ? wx.getSystemInfoSync() : { screenWidth: 375, screenHeight: 667 };

const bodyStub = {
  clientWidth: info.screenWidth || 375,
  clientHeight: info.screenHeight || 667,
  appendChild() {},
  removeChild() {},
  insertBefore() {},
  style: {},
  tagName: 'BODY',
};

const documentShim = {
  body: bodyStub,
  documentElement: { ...bodyStub, tagName: 'HTML' },
  hidden: false,
  readyState: 'complete',

  get visibilityState() {
    return this.hidden ? 'hidden' : 'visible';
  },

  createElement(tagName) {
    const tag = tagName.toLowerCase();
    if (tag === 'canvas') {
      return wx.createCanvas();
    }
    if (tag === 'img' || tag === 'image') {
      return wx.createImage();
    }
    // Stub element for anything else (style, div, etc.)
    return {
      tagName: tagName.toUpperCase(),
      style: {},
      childNodes: [],
      children: [],
      appendChild(child) { this.childNodes.push(child); this.children.push(child); },
      removeChild(child) {
        const idx = this.childNodes.indexOf(child);
        if (idx !== -1) { this.childNodes.splice(idx, 1); this.children.splice(idx, 1); }
      },
      insertBefore(newNode, refNode) { this.childNodes.unshift(newNode); this.children.unshift(newNode); },
      setAttribute() {},
      getAttribute() { return null; },
      addEventListener() {},
      removeEventListener() {},
      innerHTML: '',
      textContent: '',
    };
  },

  createElementNS(ns, tagName) {
    return this.createElement(tagName);
  },

  getElementById(id) {
    if (typeof GameGlobal !== 'undefined' && GameGlobal.__wxCanvas) {
      return GameGlobal.__wxCanvas;
    }
    return null;
  },

  getElementsByTagName(tag) {
    if (tag.toLowerCase() === 'canvas' && typeof GameGlobal !== 'undefined' && GameGlobal.__wxCanvas) {
      return [GameGlobal.__wxCanvas];
    }
    return [];
  },

  querySelector() { return null; },
  querySelectorAll() { return []; },

  createTextNode(text) {
    return { textContent: text, nodeType: 3 };
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

export default documentShim;
