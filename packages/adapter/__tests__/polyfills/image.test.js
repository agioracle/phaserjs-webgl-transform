import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  globalThis.wx = {
    createImage: vi.fn(() => ({ src: '', width: 0, height: 0, onload: null, onerror: null })),
  };
  vi.resetModules();
});
afterEach(() => { delete globalThis.wx; });

describe('Image polyfill', () => {
  it('calls wx.createImage()', async () => {
    const { default: WxImage } = await import('../../src/polyfills/image.js');
    const img = new WxImage();
    expect(wx.createImage).toHaveBeenCalledOnce();
  });

  it('returns object with src, width, height, onload, onerror', async () => {
    const { default: WxImage } = await import('../../src/polyfills/image.js');
    const img = new WxImage();
    expect(img).toHaveProperty('src');
    expect(img).toHaveProperty('width');
    expect(img).toHaveProperty('height');
    expect(img).toHaveProperty('onload');
    expect(img).toHaveProperty('onerror');
  });
});
