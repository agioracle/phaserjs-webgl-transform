const _gScope = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;
const _safeSetTimeout = _gScope.setTimeout ? _gScope.setTimeout.bind(_gScope) : globalThis.setTimeout.bind(globalThis);

const _audioListeners = Symbol('listeners');

class WxAudio {
  constructor() {
    this._inner = wx.createInnerAudioContext();
    this[_audioListeners] = new Map();
    this._paused = true;

    // dataset — Phaser's HTML5AudioFile/HTML5AudioSound uses dataset.used,
    // dataset.locked, dataset.name extensively for audio tag pooling.
    this.dataset = {};

    // preload — Phaser sets audio.preload = 'auto'
    this.preload = 'auto';

    this._inner.onCanplay(() => this._emit('canplaythrough'));
    this._inner.onPlay(() => { this._paused = false; this._emit('play'); });
    this._inner.onPause(() => { this._paused = true; this._emit('pause'); });
    this._inner.onEnded(() => { this._paused = true; this._emit('ended'); });
    this._inner.onError((err) => this._emit('error', err));
  }

  get src() { return this._inner.src; }
  set src(val) { this._inner.src = val; }

  get volume() { return this._inner.volume; }
  set volume(val) { this._inner.volume = val; }

  get loop() { return this._inner.loop; }
  set loop(val) { this._inner.loop = val; }

  get currentTime() { return this._inner.currentTime; }
  set currentTime(val) { this._inner.seek(val); }

  get duration() { return this._inner.duration; }
  get paused() { return this._paused; }
  get readyState() { return this.src ? 4 : 0; }

  get muted() { return this._inner.volume === 0; }
  set muted(val) { if (val) this._inner.volume = 0; }

  play() { this._inner.play(); return Promise.resolve(); }
  pause() { this._inner.pause(); }

  /**
   * load — Phaser calls this to preload audio. When src is already set,
   * WeChat's InnerAudioContext starts loading automatically on src assignment.
   * We fire 'canplaythrough' asynchronously so Phaser's onProgress callback
   * gets called and the file loading completes.
   */
  load() {
    if (this._inner.src) {
      // Fire canplaythrough in next tick — InnerAudioContext loads on src set
      _safeSetTimeout(() => this._emit('canplaythrough'), 0);
    }
  }

  /**
   * canPlayType — Phaser calls this at boot to detect supported audio formats.
   * WeChat InnerAudioContext supports mp3, aac, wav, ogg, etc.
   */
  canPlayType(mimeType) {
    if (!mimeType || typeof mimeType !== 'string') return '';
    const mime = mimeType.toLowerCase();
    // mp3
    if (mime.includes('mpeg') || mime.includes('mp3')) return 'probably';
    // aac / m4a
    if (mime.includes('aac') || mime.includes('mp4') || mime.includes('x-m4a')) return 'probably';
    // wav
    if (mime.includes('wav')) return 'probably';
    // ogg
    if (mime.includes('ogg')) return 'maybe';
    return '';
  }

  cloneNode() {
    const clone = new WxAudio();
    clone.src = this.src;
    return clone;
  }

  addEventListener(type, listener) {
    if (!this[_audioListeners].has(type)) this[_audioListeners].set(type, []);
    this[_audioListeners].get(type).push(listener);
  }
  removeEventListener(type, listener) {
    const list = this[_audioListeners].get(type);
    if (!list) return;
    const idx = list.indexOf(listener);
    if (idx !== -1) list.splice(idx, 1);
  }

  _emit(type, data) {
    const event = { type, target: this, data };
    // onXxx callback
    const prop = `on${type}`;
    if (typeof this[prop] === 'function') this[prop](event);
    // addEventListener listeners
    const list = this[_audioListeners].get(type);
    if (list) list.forEach(fn => fn(event));
  }
}

// AudioContext stub — logs warning, prevents crashes
class WxAudioContext {
  constructor() {
    console.warn('[PhaserWxAdapter] Web Audio API is not supported. Use HTML5 Audio (disableWebAudio: true).');
    this.destination = {};
    this.sampleRate = 44100;
    this.state = 'suspended';
  }
  createBufferSource() { return { connect() {}, start() {}, stop() {}, buffer: null }; }
  createGain() { return { connect() {}, gain: { value: 1 } }; }
  decodeAudioData() { return Promise.reject(new Error('Web Audio not supported in WeChat Mini-Game')); }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}

export { WxAudio, WxAudioContext };
