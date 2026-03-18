import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockCanvas = {
  id: 'gameCanvas',
  width: 375,
  height: 667,
  getContext: vi.fn(() => ({})),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  style: {},
  getBoundingClientRect: vi.fn(() => ({
    x: 0,
    y: 0,
    width: 375,
    height: 667,
    top: 0,
    right: 375,
    bottom: 667,
    left: 0,
  })),
  focus: vi.fn(),
};

const mockImage = {
  src: '',
  width: 0,
  height: 0,
  onload: null,
  onerror: null,
};

const mockInnerAudio = {
  src: '',
  volume: 1,
  loop: false,
  currentTime: 0,
  duration: 0,
  paused: true,
  play: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  destroy: vi.fn(),
  seek: vi.fn(),
  onCanplay: vi.fn(),
  onPlay: vi.fn(),
  onPause: vi.fn(),
  onStop: vi.fn(),
  onEnded: vi.fn(),
  onError: vi.fn(),
  onTimeUpdate: vi.fn(),
  offCanplay: vi.fn(),
  offPlay: vi.fn(),
  offEnded: vi.fn(),
  offError: vi.fn(),
};

beforeEach(() => {
  // Clean up any previous global assignments
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.navigator;
  delete globalThis.Image;
  delete globalThis.Audio;
  delete globalThis.AudioContext;
  delete globalThis.webkitAudioContext;
  delete globalThis.XMLHttpRequest;
  delete globalThis.fetch;
  delete globalThis.localStorage;
  delete globalThis.HTMLElement;
  delete globalThis.HTMLCanvasElement;

  globalThis.GameGlobal = {};
  globalThis.wx = {
    getSystemInfoSync: vi.fn(() => ({
      windowWidth: 375,
      windowHeight: 667,
      screenWidth: 375,
      screenHeight: 812,
      pixelRatio: 2,
      platform: 'ios',
      language: 'zh_CN',
    })),
    createCanvas: vi.fn(() => ({ ...mockCanvas })),
    createImage: vi.fn(() => ({ ...mockImage })),
    createInnerAudioContext: vi.fn(() => ({ ...mockInnerAudio })),
    request: vi.fn(),
    downloadFile: vi.fn(),
    getFileSystemManager: vi.fn(() => ({ readFile: vi.fn() })),
    getStorageSync: vi.fn(() => ''),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
    clearStorageSync: vi.fn(),
    getStorageInfoSync: vi.fn(() => ({ keys: [], currentSize: 0, limitSize: 10240 })),
    vibrateShort: vi.fn(),
  };

  vi.resetModules();
});

describe('adapter bootstrap (index.js)', () => {
  it('should set global.window to the window polyfill', async () => {
    await import('../src/index.js');
    expect(globalThis.window).toBeDefined();
    expect(globalThis.window.innerWidth).toBe(375);
    expect(globalThis.window.innerHeight).toBe(667);
  });

  it('should set global.document to the document polyfill', async () => {
    await import('../src/index.js');
    expect(globalThis.document).toBeDefined();
    expect(globalThis.document.readyState).toBe('complete');
    expect(typeof globalThis.document.createElement).toBe('function');
  });

  it('should set global.navigator to the navigator polyfill', async () => {
    await import('../src/index.js');
    expect(globalThis.navigator).toBeDefined();
    expect(globalThis.navigator.userAgent).toContain('WeChat MiniGame');
  });

  it('should set global.Image constructor', async () => {
    await import('../src/index.js');
    expect(globalThis.Image).toBeDefined();
    const img = new globalThis.Image();
    expect(img).toBeDefined();
  });

  it('should set global.XMLHttpRequest', async () => {
    await import('../src/index.js');
    expect(globalThis.XMLHttpRequest).toBeDefined();
    const xhr = new globalThis.XMLHttpRequest();
    expect(typeof xhr.open).toBe('function');
    expect(typeof xhr.send).toBe('function');
  });

  it('should set global.fetch', async () => {
    await import('../src/index.js');
    expect(typeof globalThis.fetch).toBe('function');
  });

  it('should set global.localStorage', async () => {
    await import('../src/index.js');
    expect(globalThis.localStorage).toBeDefined();
    expect(typeof globalThis.localStorage.getItem).toBe('function');
    expect(typeof globalThis.localStorage.setItem).toBe('function');
  });

  it('should set global.Audio and global.AudioContext', async () => {
    await import('../src/index.js');
    expect(globalThis.Audio).toBeDefined();
    expect(globalThis.AudioContext).toBeDefined();
  });

  it('should create primary canvas and store on GameGlobal.__wxCanvas', async () => {
    await import('../src/index.js');
    expect(GameGlobal.__wxCanvas).toBeDefined();
    expect(wx.createCanvas).toHaveBeenCalled();
  });

  it('should set canvas on window and document for Phaser access', async () => {
    await import('../src/index.js');
    expect(globalThis.window.canvas).toBeDefined();
  });
});
