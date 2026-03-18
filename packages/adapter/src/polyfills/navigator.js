const info = wx.getSystemInfoSync();

const navigatorShim = {
  userAgent: 'Mozilla/5.0 (WeChat MiniGame) PhaserWxAdapter/0.1.0',
  platform: info.platform || 'unknown',
  language: info.language || 'zh-CN',
  languages: [info.language || 'zh-CN'],
  onLine: true,
  maxTouchPoints: 10,
  vendor: 'WeChat',
  vibrate(pattern) {
    try { wx.vibrateShort({ type: 'medium' }); return true; } catch { return false; }
  },
};

export default navigatorShim;
