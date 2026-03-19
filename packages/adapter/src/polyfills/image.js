import { getBlobData } from './blob-url.js';

/**
 * Image polyfill for WeChat Mini-Game.
 *
 * Wraps wx.createImage() with:
 * 1. `crossOrigin` property — no-op stub (Phaser sets image.crossOrigin = 'anonymous')
 * 2. `src` setter interception — handles wxblob:// URLs by writing blob data
 *    to a wx temp file, then setting the real src to the temp path
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

  // --- wxblob:// src handling ---
  // Phaser's XHR loader fetches images as arraybuffer, creates a Blob, then
  // uses URL.createObjectURL() to get a blob URL. Our polyfill returns
  // wxblob:// URIs. We intercept the src setter to resolve these.
  const _originalSrcDescriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(img), 'src'
  ) || Object.getOwnPropertyDescriptor(img, 'src');

  if (_originalSrcDescriptor) {
    const _originalSet = _originalSrcDescriptor.set;
    const _originalGet = _originalSrcDescriptor.get;

    Object.defineProperty(img, 'src', {
      get() {
        return _originalGet ? _originalGet.call(this) : this._wxSrc || '';
      },
      set(value) {
        if (typeof value === 'string' && value.startsWith('wxblob://')) {
          // Resolve wxblob:// URL to a temp file
          const blob = getBlobData(value);
          if (blob && blob._buffer) {
            try {
              const fsm = wx.getFileSystemManager();
              // Determine file extension from blob type
              let ext = '.bin';
              if (blob.type) {
                const match = blob.type.match(/\/(png|jpe?g|gif|webp|bmp|svg)/i);
                if (match) ext = '.' + match[1].toLowerCase().replace('jpeg', 'jpg');
              }
              const tempPath = `${wx.env.USER_DATA_PATH}/_wxblob_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
              fsm.writeFileSync(tempPath, blob._buffer);
              if (_originalSet) {
                _originalSet.call(this, tempPath);
              }
            } catch (err) {
              console.error('[WxImage] Failed to write blob to temp file:', err);
              if (this.onerror) this.onerror(err);
            }
          } else {
            console.warn('[WxImage] No blob data found for:', value);
            if (this.onerror) this.onerror(new Error('Blob data not found: ' + value));
          }
        } else {
          if (_originalSet) {
            _originalSet.call(this, value);
          }
        }
      },
      configurable: true,
      enumerable: true,
    });
  }

  return img;
}
