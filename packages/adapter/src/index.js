import window from './polyfills/window.js';
import document from './polyfills/document.js';
import navigator from './polyfills/navigator.js';
import { createPrimaryCanvas, createOffscreenCanvas } from './polyfills/canvas.js';
import WxImage from './polyfills/image.js';
import { WxAudio, WxAudioContext } from './polyfills/audio.js';
import WxXMLHttpRequest from './polyfills/xmlhttprequest.js';
import wxFetch from './polyfills/fetch.js';
import wxLocalStorage from './polyfills/local-storage.js';

// 1. Create the primary on-screen canvas
const canvas = createPrimaryCanvas();

// 2. Attach canvas reference to window and document
window.canvas = canvas;

// 3. Set up all globals
const _global = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;

// Core DOM-like globals
_global.window = window;
_global.document = document;
_global.navigator = navigator;
_global.canvas = canvas;

// Constructors
_global.Image = WxImage;
_global.Audio = WxAudio;
_global.AudioContext = WxAudioContext;
_global.webkitAudioContext = WxAudioContext;
_global.XMLHttpRequest = WxXMLHttpRequest;

// Functions
_global.fetch = wxFetch;
_global.localStorage = wxLocalStorage;

// Stub HTML element constructors that Phaser may check for
_global.HTMLElement = _global.HTMLElement || function HTMLElement() {};
_global.HTMLCanvasElement = _global.HTMLCanvasElement || function HTMLCanvasElement() {};

// Also set on globalThis for Node-style access
globalThis.window = window;
globalThis.document = document;
globalThis.navigator = navigator;
globalThis.canvas = canvas;
globalThis.Image = WxImage;
globalThis.Audio = WxAudio;
globalThis.AudioContext = WxAudioContext;
globalThis.webkitAudioContext = WxAudioContext;
globalThis.XMLHttpRequest = WxXMLHttpRequest;
globalThis.fetch = wxFetch;
globalThis.localStorage = wxLocalStorage;
globalThis.HTMLElement = _global.HTMLElement;
globalThis.HTMLCanvasElement = _global.HTMLCanvasElement;

// Window self-references
window.document = document;
window.navigator = navigator;
window.Image = WxImage;
window.Audio = WxAudio;
window.AudioContext = WxAudioContext;
window.XMLHttpRequest = WxXMLHttpRequest;
window.fetch = wxFetch;
window.localStorage = wxLocalStorage;
