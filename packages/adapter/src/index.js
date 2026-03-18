import window, { screenShim as screen } from './polyfills/window.js';
import document from './polyfills/document.js';
import navigator from './polyfills/navigator.js';
import { createPrimaryCanvas, createOffscreenCanvas } from './polyfills/canvas.js';
import WxImage from './polyfills/image.js';
import { WxAudio, WxAudioContext } from './polyfills/audio.js';
import WxXMLHttpRequest from './polyfills/xmlhttprequest.js';
import wxFetch from './polyfills/fetch.js';
import wxLocalStorage from './polyfills/local-storage.js';

/**
 * Safely set a property on an object, using Object.defineProperty to
 * override read-only getters (e.g., globalThis.window in WeChat Mini-Game).
 */
function safeSet(obj, key, value) {
  try {
    obj[key] = value;
    if (obj[key] !== value) {
      throw new Error('Assignment silently failed');
    }
  } catch {
    try {
      Object.defineProperty(obj, key, {
        value,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch {
      try {
        delete obj[key];
        obj[key] = value;
      } catch {
        // Property is truly non-configurable; skip silently
      }
    }
  }
}

// 1. Create the primary on-screen canvas
const canvas = createPrimaryCanvas();

// 2. Attach canvas reference to window and document
window.canvas = canvas;

// 3. Set up all globals via GameGlobal (WeChat's global scope)
const _global = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;

// Core DOM-like globals
safeSet(_global, 'window', window);
safeSet(_global, 'document', document);
safeSet(_global, 'navigator', navigator);
safeSet(_global, 'canvas', canvas);

// Constructors
safeSet(_global, 'Image', WxImage);
safeSet(_global, 'Audio', WxAudio);
safeSet(_global, 'AudioContext', WxAudioContext);
safeSet(_global, 'webkitAudioContext', WxAudioContext);
safeSet(_global, 'XMLHttpRequest', WxXMLHttpRequest);

// Functions
safeSet(_global, 'fetch', wxFetch);
safeSet(_global, 'localStorage', wxLocalStorage);

// Stub HTML element constructors that Phaser may check for
safeSet(_global, 'HTMLElement', _global.HTMLElement || function HTMLElement() {});
safeSet(_global, 'HTMLCanvasElement', _global.HTMLCanvasElement || function HTMLCanvasElement() {});

// Also set on globalThis for Node-style access
safeSet(globalThis, 'window', window);
safeSet(globalThis, 'document', document);
safeSet(globalThis, 'navigator', navigator);
safeSet(globalThis, 'canvas', canvas);
safeSet(globalThis, 'Image', WxImage);
safeSet(globalThis, 'Audio', WxAudio);
safeSet(globalThis, 'AudioContext', WxAudioContext);
safeSet(globalThis, 'webkitAudioContext', WxAudioContext);
safeSet(globalThis, 'XMLHttpRequest', WxXMLHttpRequest);
safeSet(globalThis, 'fetch', wxFetch);
safeSet(globalThis, 'localStorage', wxLocalStorage);
safeSet(globalThis, 'HTMLElement', _global.HTMLElement);
safeSet(globalThis, 'HTMLCanvasElement', _global.HTMLCanvasElement);

// Window self-references
window.document = document;
window.navigator = navigator;
window.Image = WxImage;
window.Audio = WxAudio;
window.AudioContext = WxAudioContext;
window.XMLHttpRequest = WxXMLHttpRequest;
window.fetch = wxFetch;
window.localStorage = wxLocalStorage;

// Export polyfill objects so they can be used directly as module-scope
// var aliases, bypassing any issues with GameGlobal property assignment.
export {
  window,
  document,
  navigator,
  canvas,
  screen,
  WxImage as Image,
  WxAudio as Audio,
  WxAudioContext as AudioContext,
  WxXMLHttpRequest as XMLHttpRequest,
  wxFetch as fetch,
  wxLocalStorage as localStorage,
};
