import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let WxXMLHttpRequest;

beforeEach(async () => {
  globalThis.wx = {
    request: vi.fn(),
    downloadFile: vi.fn(),
    getFileSystemManager: vi.fn(() => ({
      readFileSync: vi.fn(() => new ArrayBuffer(8)),
    })),
  };
  vi.resetModules();
  const mod = await import('../../src/polyfills/xmlhttprequest.js');
  WxXMLHttpRequest = mod.default;
});
afterEach(() => { delete globalThis.wx; });

describe('WxXMLHttpRequest', () => {
  it('open sets method, url, readyState', () => {
    const xhr = new WxXMLHttpRequest();
    xhr.open('GET', 'https://example.com/data.json');
    expect(xhr.readyState).toBe(1);
  });

  it('send with text responseType uses wx.request', () => {
    const xhr = new WxXMLHttpRequest();
    xhr.open('GET', 'https://example.com/data.json');
    xhr.send();
    expect(wx.request).toHaveBeenCalledOnce();
    expect(wx.downloadFile).not.toHaveBeenCalled();
  });

  it('send with arraybuffer responseType uses wx.downloadFile', () => {
    const xhr = new WxXMLHttpRequest();
    xhr.responseType = 'arraybuffer';
    xhr.open('GET', 'https://example.com/texture.png');
    xhr.send();
    expect(wx.downloadFile).toHaveBeenCalledOnce();
    expect(wx.request).not.toHaveBeenCalled();
  });

  it('calls onload on successful text request', () => {
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: '{"key":"value"}' });
    });
    const xhr = new WxXMLHttpRequest();
    xhr.onload = vi.fn();
    xhr.open('GET', 'https://example.com/data.json');
    xhr.send();
    expect(xhr.onload).toHaveBeenCalledOnce();
    expect(xhr.status).toBe(200);
    expect(xhr.response).toBe('{"key":"value"}');
  });

  it('calls onload on successful binary download', () => {
    wx.downloadFile.mockImplementation(({ success }) => {
      success({ statusCode: 200, tempFilePath: '/tmp/file' });
    });
    const xhr = new WxXMLHttpRequest();
    xhr.responseType = 'arraybuffer';
    xhr.onload = vi.fn();
    xhr.open('GET', 'https://example.com/img.png');
    xhr.send();
    expect(xhr.onload).toHaveBeenCalledOnce();
    expect(xhr.response).toBeInstanceOf(ArrayBuffer);
  });

  it('calls onerror on failure', () => {
    wx.request.mockImplementation(({ fail }) => {
      fail({ errMsg: 'network error' });
    });
    const xhr = new WxXMLHttpRequest();
    xhr.onerror = vi.fn();
    xhr.open('GET', 'https://example.com/fail');
    xhr.send();
    expect(xhr.onerror).toHaveBeenCalledOnce();
  });

  it('abort calls task.abort', () => {
    const abortFn = vi.fn();
    wx.request.mockReturnValue({ abort: abortFn });
    const xhr = new WxXMLHttpRequest();
    xhr.onabort = vi.fn();
    xhr.open('GET', 'https://example.com/data');
    xhr.send();
    xhr.abort();
    expect(abortFn).toHaveBeenCalled();
    expect(xhr.onabort).toHaveBeenCalled();
  });
});
