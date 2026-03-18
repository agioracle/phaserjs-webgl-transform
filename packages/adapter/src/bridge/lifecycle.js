export function initLifecycleBridge(documentShim, windowShim) {
  wx.onShow(() => {
    documentShim.hidden = false;
    documentShim.dispatchEvent({ type: 'visibilitychange' });
    windowShim.dispatchEvent({ type: 'focus' });
  });
  wx.onHide(() => {
    documentShim.hidden = true;
    documentShim.dispatchEvent({ type: 'visibilitychange' });
    windowShim.dispatchEvent({ type: 'blur' });
  });
}
