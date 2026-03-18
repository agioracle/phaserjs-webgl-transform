import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initTouchBridge, destroyTouchBridge } from '../../src/bridge/touch.js';

describe('Touch Bridge', () => {
  let canvas;
  let wxHandlers;

  beforeEach(() => {
    wxHandlers = {};
    canvas = { dispatchEvent: vi.fn() };
    globalThis.wx = {
      onTouchStart: vi.fn((cb) => { wxHandlers.touchStart = cb; }),
      onTouchMove: vi.fn((cb) => { wxHandlers.touchMove = cb; }),
      onTouchEnd: vi.fn((cb) => { wxHandlers.touchEnd = cb; }),
      onTouchCancel: vi.fn((cb) => { wxHandlers.touchCancel = cb; }),
      offTouchStart: vi.fn(), offTouchMove: vi.fn(),
      offTouchEnd: vi.fn(), offTouchCancel: vi.fn(),
    };
  });

  afterEach(() => { destroyTouchBridge(); delete globalThis.wx; });

  it('registers all four wx touch handlers on init', () => {
    initTouchBridge(canvas, 2);
    expect(wx.onTouchStart).toHaveBeenCalledOnce();
    expect(wx.onTouchMove).toHaveBeenCalledOnce();
    expect(wx.onTouchEnd).toHaveBeenCalledOnce();
    expect(wx.onTouchCancel).toHaveBeenCalledOnce();
  });

  it('dispatches touchstart with DPR-scaled coordinates', () => {
    initTouchBridge(canvas, 2);
    wxHandlers.touchStart({
      touches: [{ identifier: 0, clientX: 200, clientY: 400, pageX: 200, pageY: 400, screenX: 200, screenY: 400 }],
      changedTouches: [{ identifier: 0, clientX: 200, clientY: 400, pageX: 200, pageY: 400, screenX: 200, screenY: 400 }],
      timeStamp: 12345,
    });
    const event = canvas.dispatchEvent.mock.calls[0][0];
    expect(event.type).toBe('touchstart');
    expect(event.touches[0].clientX).toBe(100); // 200/2
    expect(event.touches[0].clientY).toBe(200); // 400/2
    expect(event.touches[0].target).toBe(canvas);
  });

  it('destroyTouchBridge unregisters all handlers', () => {
    initTouchBridge(canvas, 1);
    destroyTouchBridge();
    expect(wx.offTouchStart).toHaveBeenCalledOnce();
    expect(wx.offTouchMove).toHaveBeenCalledOnce();
    expect(wx.offTouchEnd).toHaveBeenCalledOnce();
    expect(wx.offTouchCancel).toHaveBeenCalledOnce();
  });
});
