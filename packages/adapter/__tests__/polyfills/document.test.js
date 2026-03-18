import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  globalThis.GameGlobal = { __wxCanvas: { id: 'testCanvas' } };
  globalThis.wx = {
    getSystemInfoSync: vi.fn(() => ({ screenWidth: 375, screenHeight: 667 })),
    createCanvas: vi.fn(() => ({ tagName: 'CANVAS', getContext: vi.fn() })),
    createImage: vi.fn(() => ({ src: '', onload: null, onerror: null })),
  };
  vi.resetModules();
});
afterEach(() => { delete globalThis.GameGlobal; delete globalThis.wx; });

describe('document polyfill', () => {
  it('createElement("canvas") calls wx.createCanvas', async () => {
    const { default: doc } = await import('../../src/polyfills/document.js');
    doc.createElement('canvas');
    expect(wx.createCanvas).toHaveBeenCalled();
  });

  it('createElement("img") calls wx.createImage', async () => {
    const { default: doc } = await import('../../src/polyfills/document.js');
    doc.createElement('img');
    expect(wx.createImage).toHaveBeenCalled();
  });

  it('createElement("div") returns stub element', async () => {
    const { default: doc } = await import('../../src/polyfills/document.js');
    const div = doc.createElement('div');
    expect(div.tagName).toBe('DIV');
    expect(div.style).toBeDefined();
  });

  it('getElementById returns GameGlobal.__wxCanvas', async () => {
    const { default: doc } = await import('../../src/polyfills/document.js');
    expect(doc.getElementById('game')).toBe(GameGlobal.__wxCanvas);
  });

  it('body has clientWidth/clientHeight', async () => {
    const { default: doc } = await import('../../src/polyfills/document.js');
    expect(doc.body.clientWidth).toBe(375);
    expect(doc.body.clientHeight).toBe(667);
  });

  it('visibilityState reflects hidden', async () => {
    const { default: doc } = await import('../../src/polyfills/document.js');
    expect(doc.visibilityState).toBe('visible');
    doc.hidden = true;
    expect(doc.visibilityState).toBe('hidden');
  });

  it('supports addEventListener/dispatchEvent', async () => {
    const { default: doc } = await import('../../src/polyfills/document.js');
    const handler = vi.fn();
    doc.addEventListener('visibilitychange', handler);
    doc.dispatchEvent({ type: 'visibilitychange' });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('readyState is complete', async () => {
    const { default: doc } = await import('../../src/polyfills/document.js');
    expect(doc.readyState).toBe('complete');
  });
});
