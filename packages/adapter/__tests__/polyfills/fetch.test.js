import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let wxFetch;

beforeEach(async () => {
  globalThis.wx = { request: vi.fn() };
  vi.resetModules();
  const mod = await import('../../src/polyfills/fetch.js');
  wxFetch = mod.default;
});
afterEach(() => { delete globalThis.wx; });

describe('wxFetch', () => {
  it('calls wx.request with correct params', async () => {
    wx.request.mockImplementation(({ success }) => { success({ statusCode: 200, data: '{"ok":true}', header: {} }); });
    const res = await wxFetch('https://example.com/api');
    expect(wx.request).toHaveBeenCalledOnce();
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
  });

  it('response.json() parses JSON', async () => {
    wx.request.mockImplementation(({ success }) => { success({ statusCode: 200, data: '{"key":"val"}', header: {} }); });
    const res = await wxFetch('https://example.com/api');
    const json = await res.json();
    expect(json.key).toBe('val');
  });

  it('response.text() returns string', async () => {
    wx.request.mockImplementation(({ success }) => { success({ statusCode: 200, data: 'hello', header: {} }); });
    const res = await wxFetch('https://example.com/api');
    expect(await res.text()).toBe('hello');
  });

  it('rejects on failure', async () => {
    wx.request.mockImplementation(({ fail }) => { fail({ errMsg: 'network error' }); });
    await expect(wxFetch('https://fail.com')).rejects.toThrow('network error');
  });

  it('non-200 status sets ok=false', async () => {
    wx.request.mockImplementation(({ success }) => { success({ statusCode: 404, data: 'not found', header: {} }); });
    const res = await wxFetch('https://example.com/missing');
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  });
});
