import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initScreenBridge } from '../../src/bridge/screen.js';

describe('Screen Bridge', () => {
  let windowShim, canvas, wxHandlers;

  beforeEach(() => {
    wxHandlers = {};
    windowShim = { innerWidth: 0, innerHeight: 0, devicePixelRatio: 1 };
    canvas = { width: 0, height: 0 };
    globalThis.wx = {
      getSystemInfoSync: vi.fn(() => ({ screenWidth: 375, screenHeight: 667, pixelRatio: 2 })),
      onWindowResize: vi.fn(cb => { wxHandlers.resize = cb; }),
      onDeviceOrientationChange: vi.fn(cb => { wxHandlers.orientation = cb; }),
    };
  });
  afterEach(() => { delete globalThis.wx; });

  it('sets initial dimensions from system info', () => {
    initScreenBridge(windowShim, canvas);
    expect(windowShim.innerWidth).toBe(375);
    expect(windowShim.innerHeight).toBe(667);
    expect(windowShim.devicePixelRatio).toBe(2);
    expect(canvas.width).toBe(750);
    expect(canvas.height).toBe(1334);
  });

  it('updates on window resize', () => {
    initScreenBridge(windowShim, canvas);
    wxHandlers.resize({ windowWidth: 414, windowHeight: 736 });
    expect(windowShim.innerWidth).toBe(414);
    expect(windowShim.innerHeight).toBe(736);
  });

  it('re-reads system info on orientation change', () => {
    initScreenBridge(windowShim, canvas);
    wx.getSystemInfoSync.mockReturnValue({ screenWidth: 667, screenHeight: 375, pixelRatio: 2 });
    wxHandlers.orientation();
    expect(windowShim.innerWidth).toBe(667);
    expect(windowShim.innerHeight).toBe(375);
  });
});
