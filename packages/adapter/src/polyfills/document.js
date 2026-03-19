const _listeners = new Map();

const info = typeof wx !== 'undefined' ? wx.getSystemInfoSync() : { screenWidth: 375, screenHeight: 667 };

// Import WxAudio so document.createElement('audio') returns a proper audio element
import { WxAudio } from './audio.js';

// Shared helper: make a wx canvas look enough like an HTMLCanvasElement
// for Phaser's CanvasPool, feature-detection, and 2D helpers.
function patchCanvas(canvas) {
  if (!canvas._listeners) {
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
  }
  if (!canvas.style) canvas.style = { width: '', height: '' };
  if (!canvas.tagName) canvas.tagName = 'CANVAS';
  const _a = {};
  if (!canvas.setAttribute) {
    canvas.setAttribute = function(k, v) {
      _a[k] = v;
      if (k === 'width') canvas.width = parseInt(v, 10);
      if (k === 'height') canvas.height = parseInt(v, 10);
    };
  }
  if (!canvas.getAttribute) {
    canvas.getAttribute = function(k) { return _a[k] !== undefined ? _a[k] : null; };
  }
  if (!canvas.getBoundingClientRect) {
    canvas.getBoundingClientRect = function() {
      return { x: 0, y: 0, top: 0, left: 0,
        bottom: canvas.height || info.screenHeight,
        right: canvas.width || info.screenWidth,
        width: canvas.width || info.screenWidth,
        height: canvas.height || info.screenHeight };
    };
  }
  if (!canvas.focus) canvas.focus = function() {};
  if (!canvas.parentNode) {
    // WeChat canvas objects may define parentNode as a read-only getter,
    // so we must use Object.defineProperty to override it.
    const parentNodeStub = {
      tagName: 'BODY',
      appendChild() {}, removeChild() {}, insertBefore() {},
      getBoundingClientRect() {
        return { x: 0, y: 0, top: 0, left: 0,
          bottom: info.screenHeight, right: info.screenWidth,
          width: info.screenWidth, height: info.screenHeight };
      },
    };
    try {
      canvas.parentNode = parentNodeStub;
      if (canvas.parentNode !== parentNodeStub) throw new Error('setter failed');
    } catch {
      try {
        Object.defineProperty(canvas, 'parentNode', {
          value: parentNodeStub,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } catch {
        // Truly non-configurable; skip silently
      }
    }
  }
  return canvas;
}

const _bodyListeners = new Map();

const bodyStub = {
  clientWidth: info.screenWidth || 375,
  clientHeight: info.screenHeight || 667,
  appendChild() {},
  removeChild() {},
  insertBefore() {},
  style: {},
  tagName: 'BODY',
  addEventListener(type, listener) {
    if (!_bodyListeners.has(type)) _bodyListeners.set(type, []);
    _bodyListeners.get(type).push(listener);
  },
  removeEventListener(type, listener) {
    const list = _bodyListeners.get(type);
    if (!list) return;
    const idx = list.indexOf(listener);
    if (idx !== -1) list.splice(idx, 1);
  },
  dispatchEvent(event) {
    const list = _bodyListeners.get(event.type);
    if (list) list.forEach(fn => fn(event));
  },
};

// Bridge WeChat touch events to document.body so Phaser's audio unlock
// (which listens for 'touchend' on document.body) works properly.
if (typeof wx !== 'undefined' && wx.onTouchEnd) {
  wx.onTouchEnd(function () {
    bodyStub.dispatchEvent({ type: 'touchend' });
  });
  wx.onTouchMove(function () {
    bodyStub.dispatchEvent({ type: 'touchmove' });
  });
}

const documentShim = {
  body: bodyStub,
  documentElement: { ...bodyStub, tagName: 'HTML', ontouchstart: null },
  hidden: false,
  readyState: 'complete',

  get visibilityState() {
    return this.hidden ? 'hidden' : 'visible';
  },

  createElement(tagName) {
    const tag = tagName.toLowerCase();
    if (tag === 'canvas') {
      // Always create a new off-screen canvas.
      // The primary on-screen canvas is passed to Phaser via
      // config.canvas (GameGlobal.__wxCanvas), so createElement
      // must NOT return it — Phaser also uses createElement('canvas')
      // for CanvasPool (2D feature detection etc.) which would fail
      // if given a canvas that already has a WebGL context.
      return patchCanvas(wx.createCanvas());
    }
    if (tag === 'img' || tag === 'image') {
      return wx.createImage();
    }
    if (tag === 'audio') {
      return new WxAudio();
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

  // Phaser's InputManager calls elementFromPoint during touch events
  elementFromPoint() {
    if (typeof GameGlobal !== 'undefined' && GameGlobal.__wxCanvas) {
      return GameGlobal.__wxCanvas;
    }
    return null;
  },

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
