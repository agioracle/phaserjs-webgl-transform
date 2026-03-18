import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let WxAudio, WxAudioContext;

beforeEach(async () => {
  const innerCallbacks = {};
  globalThis.wx = {
    createInnerAudioContext: vi.fn(() => ({
      src: '', volume: 1, loop: false, currentTime: 0, duration: 0,
      play: vi.fn(), pause: vi.fn(), seek: vi.fn(), destroy: vi.fn(),
      onCanplay: vi.fn(cb => { innerCallbacks.canplay = cb; }),
      onPlay: vi.fn(cb => { innerCallbacks.play = cb; }),
      onPause: vi.fn(cb => { innerCallbacks.pause = cb; }),
      onEnded: vi.fn(cb => { innerCallbacks.ended = cb; }),
      onError: vi.fn(cb => { innerCallbacks.error = cb; }),
    })),
    _innerCallbacks: innerCallbacks,
  };
  vi.resetModules();
  const mod = await import('../../src/polyfills/audio.js');
  WxAudio = mod.WxAudio;
  WxAudioContext = mod.WxAudioContext;
});
afterEach(() => { delete globalThis.wx; });

describe('WxAudio', () => {
  it('creates an InnerAudioContext', () => {
    new WxAudio();
    expect(wx.createInnerAudioContext).toHaveBeenCalledOnce();
  });

  it('play() calls inner.play()', () => {
    const audio = new WxAudio();
    audio.play();
    expect(audio._inner.play).toHaveBeenCalled();
  });

  it('pause() calls inner.pause()', () => {
    const audio = new WxAudio();
    audio.pause();
    expect(audio._inner.pause).toHaveBeenCalled();
  });

  it('addEventListener and event dispatch works', () => {
    const audio = new WxAudio();
    const handler = vi.fn();
    audio.addEventListener('ended', handler);
    // Simulate the ended callback firing
    wx._innerCallbacks.ended();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('cloneNode creates new WxAudio', () => {
    const audio = new WxAudio();
    audio.src = 'test.mp3';
    const clone = audio.cloneNode();
    expect(clone).toBeInstanceOf(WxAudio);
  });
});

describe('WxAudioContext', () => {
  it('constructor does not throw', () => {
    expect(() => new WxAudioContext()).not.toThrow();
  });

  it('decodeAudioData rejects', async () => {
    const ctx = new WxAudioContext();
    await expect(ctx.decodeAudioData()).rejects.toThrow();
  });

  it('createBufferSource returns stub', () => {
    const ctx = new WxAudioContext();
    const src = ctx.createBufferSource();
    expect(typeof src.connect).toBe('function');
    expect(typeof src.start).toBe('function');
  });
});
