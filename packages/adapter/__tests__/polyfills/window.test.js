import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  globalThis.wx = {
    getSystemInfoSync: vi.fn(() => ({
      windowWidth: 375, windowHeight: 667, pixelRatio: 2, platform: 'ios', language: 'zh_CN',
    })),
  };
  vi.resetModules();
});

describe('window polyfill', () => {
  it('has correct innerWidth and innerHeight', async () => {
    const { default: win } = await import('../../src/polyfills/window.js');
    expect(win.innerWidth).toBe(375);
    expect(win.innerHeight).toBe(667);
  });

  it('has correct devicePixelRatio', async () => {
    const { default: win } = await import('../../src/polyfills/window.js');
    expect(win.devicePixelRatio).toBe(2);
  });

  it('supports addEventListener and dispatchEvent', async () => {
    const { default: win } = await import('../../src/polyfills/window.js');
    const handler = vi.fn();
    win.addEventListener('resize', handler);
    win.dispatchEvent({ type: 'resize' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('supports removeEventListener', async () => {
    const { default: win } = await import('../../src/polyfills/window.js');
    const handler = vi.fn();
    win.addEventListener('click', handler);
    win.removeEventListener('click', handler);
    win.dispatchEvent({ type: 'click' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('has scroll offsets at zero', async () => {
    const { default: win } = await import('../../src/polyfills/window.js');
    expect(win.scrollX).toBe(0);
    expect(win.scrollY).toBe(0);
  });

  it('has self/top/parent referencing itself', async () => {
    const { default: win } = await import('../../src/polyfills/window.js');
    expect(win.self).toBe(win);
    expect(win.top).toBe(win);
    expect(win.parent).toBe(win);
  });

  it('has location stub', async () => {
    const { default: win } = await import('../../src/polyfills/window.js');
    expect(win.location.href).toBe('game.js');
    expect(win.location.protocol).toBe('https:');
  });

  it('has performance.now', async () => {
    const { default: win } = await import('../../src/polyfills/window.js');
    expect(typeof win.performance.now).toBe('function');
  });
});
