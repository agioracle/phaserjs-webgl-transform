import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';

/**
 * Tests for the tt-polyfill.js runtime (supplementary Blob + URL).
 *
 * The polyfill is a self-injecting script that reads/writes the runtime
 * globals. We run its real source in a fresh V8 context per test (via node:vm)
 * so we can simulate the Douyin runtime precisely: GameGlobal is the global
 * scope, the tt-adapter has already set global.window = global and installed
 * its own (externally unusable) URL, and Blob is absent. Using vm (rather than
 * require) both isolates state and avoids the test runner transforming the
 * runtime file.
 */

const POLYFILL_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../src/runtime/tt-polyfill.js'),
  'utf-8'
);

/**
 * Build a sandbox that mimics the post-adapter Douyin global scope and run the
 * polyfill in it. Returns the sandbox (which doubles as GameGlobal/window).
 */
function loadInSandbox(): any {
  const sandbox: any = {};
  // In the runtime, GameGlobal === globalThis === window all reference the one
  // global object. Model that with a single sandbox object.
  sandbox.GameGlobal = sandbox;
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.Map = Map;
  sandbox.Uint8Array = Uint8Array;
  sandbox.ArrayBuffer = ArrayBuffer;
  sandbox.Promise = Promise;
  sandbox.String = String;
  sandbox.TextEncoder = TextEncoder;
  sandbox.TextDecoder = TextDecoder;
  // The tt-adapter exposes btoa/atob; the polyfill prefers btoa for base64.
  sandbox.btoa = (s: string) => Buffer.from(s, 'binary').toString('base64');
  sandbox.atob = (s: string) => Buffer.from(s, 'base64').toString('binary');
  // tt-adapter-style URL: its object-URL statics only work with the adapter's
  // private Blob, so from game code they are effectively unusable.
  sandbox.URL = class {
    static createObjectURL() {
      return '';
    }
    static revokeObjectURL() {}
  };
  // Blob is intentionally absent (the adapter does not expose a usable one).

  vm.runInNewContext(POLYFILL_SRC, sandbox, { filename: 'tt-polyfill.js' });
  return sandbox;
}

/** Decode a data:<type>;base64,<...> URL back to its UTF-8 text. */
function decodeDataUrl(url: string): { type: string; text: string } {
  const m = /^data:(.*);base64,(.*)$/.exec(url);
  if (!m) throw new Error('not a base64 data URL: ' + url);
  return { type: m[1], text: Buffer.from(m[2], 'base64').toString('utf-8') };
}

describe('tt-polyfill runtime (Blob + URL)', () => {
  it('installs a usable Blob global', () => {
    const g = loadInSandbox();
    expect(typeof g.Blob).toBe('function');
    const blob = new g.Blob(['<svg/>'], { type: 'image/svg+xml' });
    expect(blob.size).toBe('<svg/>'.length);
    expect(blob.type).toBe('image/svg+xml');
  });

  it('merges multiple parts (string + ArrayBuffer) into one buffer', () => {
    const g = loadInSandbox();
    const ab = new Uint8Array([1, 2, 3]).buffer;
    const blob = new g.Blob(['ab', ab]);
    expect(blob.size).toBe(2 + 3);
  });

  it('createObjectURL returns a loadable data: URL carrying the blob bytes', () => {
    const g = loadInSandbox();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    const blob = new g.Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = g.URL.createObjectURL(blob);
    // Must be a data URL (native tt.createImage() can load it), NOT a synthetic
    // blob:/ttblob: scheme that the Douyin image cannot resolve.
    expect(url).toMatch(/^data:image\/svg\+xml;charset=utf-8;base64,/);
    const decoded = decodeDataUrl(url);
    expect(decoded.type).toBe('image/svg+xml;charset=utf-8');
    expect(decoded.text).toBe(svg);
  });

  it('createObjectURL round-trips binary bytes exactly', () => {
    const g = loadInSandbox();
    const bytes = new Uint8Array([0, 255, 16, 128, 1, 2, 3, 254]);
    const blob = new g.Blob([bytes.buffer], { type: 'application/octet-stream' });
    const url = g.URL.createObjectURL(blob);
    const m = /^data:application\/octet-stream;base64,(.*)$/.exec(url)!;
    expect(m).toBeTruthy();
    const back = new Uint8Array(Buffer.from(m[1], 'base64'));
    expect(Array.from(back)).toEqual(Array.from(bytes));
  });

  it('revokeObjectURL is a safe no-op (data URLs hold no resources)', () => {
    const g = loadInSandbox();
    const url = g.URL.createObjectURL(new g.Blob(['data']));
    expect(() => g.URL.revokeObjectURL(url)).not.toThrow();
  });

  it('does not leave a ttblob:// scheme or a blob store on the global', () => {
    const g = loadInSandbox();
    const url = g.URL.createObjectURL(new g.Blob(['x']));
    expect(url.startsWith('ttblob://')).toBe(false);
    expect(g.__ttGetBlobData).toBeUndefined();
  });

  it('Blob.slice and Blob.text work', async () => {
    const g = loadInSandbox();
    const blob = new g.Blob(['hello world']);
    const sliced = blob.slice(0, 5);
    expect(sliced.size).toBe(5);
    await expect(blob.text()).resolves.toBe('hello world');
  });

  it('base64-encodes without btoa (manual fallback path)', () => {
    // Build a sandbox WITHOUT btoa to exercise the manual encoder.
    const sandbox: any = {};
    sandbox.GameGlobal = sandbox;
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.Uint8Array = Uint8Array;
    sandbox.ArrayBuffer = ArrayBuffer;
    sandbox.Promise = Promise;
    sandbox.String = String;
    sandbox.TextEncoder = TextEncoder;
    sandbox.TextDecoder = TextDecoder;
    // No btoa / atob on purpose.
    vm.runInNewContext(POLYFILL_SRC, sandbox, { filename: 'tt-polyfill.js' });

    const blob = new sandbox.Blob(['hello'], { type: 'text/plain' });
    const url = sandbox.URL.createObjectURL(blob);
    expect(url).toBe('data:text/plain;base64,' + Buffer.from('hello').toString('base64'));
  });

  it('is idempotent — re-running the script does not throw or reset globals', () => {
    const g = loadInSandbox();
    const firstBlob = g.Blob;
    // Run the self-injecting script again in the same context.
    vm.runInNewContext(POLYFILL_SRC, g, { filename: 'tt-polyfill.js' });
    expect(g.__ttPolyfillInjected).toBe(true);
    expect(g.Blob).toBe(firstBlob);
  });
});
