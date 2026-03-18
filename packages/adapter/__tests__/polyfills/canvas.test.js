import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPrimaryCanvas, createOffscreenCanvas } from '../../src/polyfills/canvas.js';

describe('Canvas polyfill', () => {
  beforeEach(() => {
    globalThis.GameGlobal = {};
    globalThis.wx = {
      createCanvas: vi.fn(() => ({ width: 0, height: 0, getContext: vi.fn() })),
    };
  });
  afterEach(() => { delete globalThis.GameGlobal; delete globalThis.wx; });

  it('createPrimaryCanvas creates canvas and stores on GameGlobal', () => {
    const canvas = createPrimaryCanvas();
    expect(GameGlobal.__wxCanvas).toBe(canvas);
    expect(wx.createCanvas).toHaveBeenCalledOnce();
  });

  it('createOffscreenCanvas creates a new canvas each call', () => {
    const c1 = createOffscreenCanvas();
    const c2 = createOffscreenCanvas();
    expect(wx.createCanvas).toHaveBeenCalledTimes(2);
    expect(c1).not.toBe(c2);
  });

  it('canvas has addEventListener/removeEventListener/dispatchEvent', () => {
    const canvas = createPrimaryCanvas();
    const handler = vi.fn();
    canvas.addEventListener('touchstart', handler);
    canvas.dispatchEvent({ type: 'touchstart' });
    expect(handler).toHaveBeenCalledOnce();
    canvas.removeEventListener('touchstart', handler);
    canvas.dispatchEvent({ type: 'touchstart' });
    expect(handler).toHaveBeenCalledOnce(); // still 1, not called again
  });

  it('canvas has style property', () => {
    const canvas = createPrimaryCanvas();
    expect(canvas.style).toBeDefined();
  });
});
