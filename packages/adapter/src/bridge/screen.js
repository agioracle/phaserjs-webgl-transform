export function initScreenBridge(windowShim, canvas) {
  const info = wx.getSystemInfoSync();
  windowShim.innerWidth = info.screenWidth;
  windowShim.innerHeight = info.screenHeight;
  windowShim.devicePixelRatio = info.pixelRatio;
  canvas.width = info.screenWidth * info.pixelRatio;
  canvas.height = info.screenHeight * info.pixelRatio;

  wx.onWindowResize(res => {
    windowShim.innerWidth = res.windowWidth;
    windowShim.innerHeight = res.windowHeight;
  });
  wx.onDeviceOrientationChange(() => {
    const updated = wx.getSystemInfoSync();
    windowShim.innerWidth = updated.screenWidth;
    windowShim.innerHeight = updated.screenHeight;
  });
}
