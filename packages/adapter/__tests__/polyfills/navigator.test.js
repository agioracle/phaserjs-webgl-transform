import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  globalThis.wx = {
    getSystemInfoSync: vi.fn(() => ({ platform: 'ios', language: 'zh_CN' })),
    vibrateShort: vi.fn(),
  };
  vi.resetModules();
});

describe('navigator polyfill', () => {
  it('has userAgent identifying WeChat MiniGame', async () => {
    const { default: nav } = await import('../../src/polyfills/navigator.js');
    expect(nav.userAgent).toContain('WeChat MiniGame');
  });

  it('has platform from wx', async () => {
    const { default: nav } = await import('../../src/polyfills/navigator.js');
    expect(nav.platform).toBe('ios');
  });

  it('has language from wx', async () => {
    const { default: nav } = await import('../../src/polyfills/navigator.js');
    expect(nav.language).toBe('zh_CN');
  });

  it('vibrate calls wx.vibrateShort', async () => {
    const { default: nav } = await import('../../src/polyfills/navigator.js');
    nav.vibrate();
    expect(wx.vibrateShort).toHaveBeenCalled();
  });

  it('has maxTouchPoints', async () => {
    const { default: nav } = await import('../../src/polyfills/navigator.js');
    expect(nav.maxTouchPoints).toBe(10);
  });
});
