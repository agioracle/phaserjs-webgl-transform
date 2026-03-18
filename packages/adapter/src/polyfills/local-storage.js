const wxLocalStorage = {
  getItem(key) {
    try { const val = wx.getStorageSync(key); return val !== undefined && val !== '' ? val : null; }
    catch { return null; }
  },
  setItem(key, value) {
    wx.setStorageSync(key, String(value));
  },
  removeItem(key) {
    try { wx.removeStorageSync(key); } catch {}
  },
  clear() {
    try { wx.clearStorageSync(); } catch {}
  },
  key(index) {
    try {
      const { keys } = wx.getStorageInfoSync();
      return index < keys.length ? keys[index] : null;
    } catch { return null; }
  },
  get length() {
    try { return wx.getStorageInfoSync().keys.length; } catch { return 0; }
  },
};

export default wxLocalStorage;
