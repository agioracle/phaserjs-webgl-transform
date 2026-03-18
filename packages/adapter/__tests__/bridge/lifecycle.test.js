import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initLifecycleBridge } from '../../src/bridge/lifecycle.js';

describe('Lifecycle Bridge', () => {
  let documentShim, windowShim, wxHandlers;

  beforeEach(() => {
    wxHandlers = {};
    documentShim = { hidden: false, dispatchEvent: vi.fn() };
    windowShim = { dispatchEvent: vi.fn() };
    globalThis.wx = {
      onShow: vi.fn(cb => { wxHandlers.show = cb; }),
      onHide: vi.fn(cb => { wxHandlers.hide = cb; }),
    };
  });
  afterEach(() => { delete globalThis.wx; });

  it('sets document.hidden=false and dispatches visibilitychange+focus on show', () => {
    documentShim.hidden = true;
    initLifecycleBridge(documentShim, windowShim);
    wxHandlers.show();
    expect(documentShim.hidden).toBe(false);
    expect(documentShim.dispatchEvent).toHaveBeenCalledWith({ type: 'visibilitychange' });
    expect(windowShim.dispatchEvent).toHaveBeenCalledWith({ type: 'focus' });
  });

  it('sets document.hidden=true and dispatches visibilitychange+blur on hide', () => {
    initLifecycleBridge(documentShim, windowShim);
    wxHandlers.hide();
    expect(documentShim.hidden).toBe(true);
    expect(documentShim.dispatchEvent).toHaveBeenCalledWith({ type: 'visibilitychange' });
    expect(windowShim.dispatchEvent).toHaveBeenCalledWith({ type: 'blur' });
  });
});
