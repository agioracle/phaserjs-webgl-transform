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

  it('createObjectURL returns a ttblob:// id that round-trips via getBlobData', () => {
    const g = loadInSandbox();
    const blob = new g.Blob(['data']);
    const url = g.URL.createObjectURL(blob);
    expect(url).toMatch(/^ttblob:\/\//);
    expect(g.__ttGetBlobData(url)).toBe(blob);
  });

  it('revokeObjectURL removes the stored blob', () => {
    const g = loadInSandbox();
    const blob = new g.Blob(['data']);
    const url = g.URL.createObjectURL(blob);
    g.URL.revokeObjectURL(url);
    expect(g.__ttGetBlobData(url)).toBeNull();
  });

  it('issues distinct ids for successive createObjectURL calls', () => {
    const g = loadInSandbox();
    const u1 = g.URL.createObjectURL(new g.Blob(['a']));
    const u2 = g.URL.createObjectURL(new g.Blob(['b']));
    expect(u1).not.toBe(u2);
  });

  it('Blob.slice and Blob.text work', async () => {
    const g = loadInSandbox();
    const blob = new g.Blob(['hello world']);
    const sliced = blob.slice(0, 5);
    expect(sliced.size).toBe(5);
    await expect(blob.text()).resolves.toBe('hello world');
  });

  it('is idempotent — re-running the script does not reset the store', () => {
    const g = loadInSandbox();
    const url = g.URL.createObjectURL(new g.Blob(['x']));
    // Run the self-injecting script again in the same context.
    vm.runInNewContext(POLYFILL_SRC, g, { filename: 'tt-polyfill.js' });
    expect(g.__ttGetBlobData(url)).not.toBeNull();
    expect(g.__ttPolyfillInjected).toBe(true);
  });
});
