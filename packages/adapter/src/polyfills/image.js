/**
 * Image polyfill for WeChat Mini-Game.
 *
 * Follows the official weapp-adapter pattern: just return wx.createImage()
 * with a crossOrigin stub. Image loading works natively via Image.src = 'path'
 * when Phaser is configured with loader.imageLoadType: 'HTMLImageElement'.
 */
export default function WxImage() {
  const img = wx.createImage();

  // --- crossOrigin stub ---
  // Phaser sets crossOrigin = 'anonymous' on images. wx.createImage() may not
  // support this property, so we add a no-op to avoid errors.
  if (!('crossOrigin' in img)) {
    let _crossOrigin = '';
    Object.defineProperty(img, 'crossOrigin', {
      get() { return _crossOrigin; },
      set(val) { _crossOrigin = val || ''; },
      configurable: true,
      enumerable: true,
    });
  }

  return img;
}
