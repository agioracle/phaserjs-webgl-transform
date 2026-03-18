import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let wxLocalStorage;

beforeEach(async () => {
  const store = {};
  globalThis.wx = {
    getStorageSync: vi.fn(key => store[key]),
    setStorageSync: vi.fn((key, val) => { store[key] = val; }),
    removeStorageSync: vi.fn(key => { delete store[key]; }),
    clearStorageSync: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    getStorageInfoSync: vi.fn(() => ({ keys: Object.keys(store) })),
  };
  vi.resetModules();
  const mod = await import('../../src/polyfills/local-storage.js');
  wxLocalStorage = mod.default;
});
afterEach(() => { delete globalThis.wx; });

describe('wxLocalStorage', () => {
  it('setItem and getItem', () => {
    wxLocalStorage.setItem('key1', 'value1');
    expect(wxLocalStorage.getItem('key1')).toBe('value1');
  });

  it('getItem returns null for missing key', () => {
    expect(wxLocalStorage.getItem('missing')).toBeNull();
  });

  it('removeItem deletes key', () => {
    wxLocalStorage.setItem('key1', 'val');
    wxLocalStorage.removeItem('key1');
    expect(wxLocalStorage.getItem('key1')).toBeNull();
  });

  it('clear removes all', () => {
    wxLocalStorage.setItem('a', '1');
    wxLocalStorage.setItem('b', '2');
    wxLocalStorage.clear();
    expect(wxLocalStorage.length).toBe(0);
  });

  it('length returns count', () => {
    wxLocalStorage.setItem('x', '1');
    wxLocalStorage.setItem('y', '2');
    expect(wxLocalStorage.length).toBe(2);
  });

  it('key returns key at index', () => {
    wxLocalStorage.setItem('alpha', '1');
    expect(wxLocalStorage.key(0)).toBe('alpha');
    expect(wxLocalStorage.key(999)).toBeNull();
  });
});
