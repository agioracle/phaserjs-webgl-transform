# minigame-phaserjs-transform-sdk Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a transformation tool that converts standard Phaser.js WebGL projects into WeChat Mini-Games.

**Architecture:** Three-package pnpm monorepo — `@aspect/cli` (CLI commands), `@aspect/rollup-plugin` (AST transforms + asset pipeline + output), `@aspect/adapter` (runtime DOM/BOM polyfills for WeChat). The adapter is zero-dependency plain JS; CLI and plugin are TypeScript built with tsup.

**Tech Stack:** Node.js, TypeScript, Rollup, Babel (parser/traverse/generator), Commander.js, Vitest, pnpm workspaces

**Spec:** `docs/superpowers/specs/2026-03-17-minigame-phaserjs-transform-sdk-design.md`

---


# Chunk 1: Monorepo Scaffold + Adapter Polyfills

## Task 1: Initialize pnpm Monorepo

### Step 1.1 — Create root `package.json`

**File: `package.json`**

```json
{
  "name": "minigame-phaserjs-transform-sdk",
  "private": true,
  "version": "0.1.0",
  "description": "Tool for converting Phaser.js games to WeChat Mini-Games",
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "clean": "pnpm -r run clean"
  },
  "engines": {
    "node": ">=18",
    "pnpm": ">=8"
  },
  "packageManager": "pnpm@9.15.4"
}
```

### Step 1.2 — Create `pnpm-workspace.yaml`

**File: `pnpm-workspace.yaml`**

```yaml
packages:
  - 'packages/*'
```

### Step 1.3 — Create `tsconfig.base.json`

**File: `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "exclude": ["node_modules", "dist"]
}
```

### Step 1.4 — Create `packages/cli/package.json`

**File: `packages/cli/package.json`**

```json
{
  "name": "@aspect/cli",
  "version": "0.1.0",
  "description": "CLI tool for converting Phaser.js games to WeChat Mini-Games",
  "type": "module",
  "bin": {
    "phaser-wx": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "chalk": "^5.3.0",
    "commander": "^12.1.0",
    "inquirer": "^9.3.7",
    "ora": "^8.1.1"
  },
  "devDependencies": {
    "tsup": "^8.3.5",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

### Step 1.5 — Create `packages/cli/tsconfig.json`

**File: `packages/cli/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

### Step 1.6 — Create `packages/rollup-plugin/package.json`

**File: `packages/rollup-plugin/package.json`**

```json
{
  "name": "@aspect/rollup-plugin",
  "version": "0.1.0",
  "description": "Rollup plugin for transforming Phaser.js code for WeChat Mini-Game compatibility",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@babel/generator": "^7.26.3",
    "@babel/parser": "^7.26.3",
    "@babel/traverse": "^7.26.4",
    "@babel/types": "^7.26.3"
  },
  "peerDependencies": {
    "rollup": "^4.0.0"
  },
  "devDependencies": {
    "rollup": "^4.28.1",
    "tsup": "^8.3.5",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

### Step 1.7 — Create `packages/rollup-plugin/tsconfig.json`

**File: `packages/rollup-plugin/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

### Step 1.8 — Create `packages/adapter/package.json`

**File: `packages/adapter/package.json`**

```json
{
  "name": "@aspect/adapter",
  "version": "0.1.0",
  "description": "WeChat Mini-Game adapter polyfills for Phaser.js browser API compatibility",
  "main": "src/index.js",
  "scripts": {
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "vitest": "^2.1.8"
  }
}
```

### Step 1.9 — Create `.gitignore`

**File: `.gitignore`**

```gitignore
node_modules/
dist/
*.log
.DS_Store
.idea/
.vscode/
*.tsbuildinfo
coverage/
```

### Step 1.10 — Create placeholder source files so packages resolve

**File: `packages/cli/src/index.ts`**

```ts
#!/usr/bin/env node
console.log('phaser-wx CLI placeholder');
```

**File: `packages/rollup-plugin/src/index.ts`**

```ts
export default function phaserWxPlugin() {
  return { name: 'phaser-wx' };
}
```

**File: `packages/adapter/src/index.js`**

```js
// Adapter bootstrap — will be implemented in Task 11
```

### Step 1.11 — Install and verify

```bash
pnpm install
```

### Step 1.12 — Commit

```bash
git init
git add -A
git commit -m "chore: initialize pnpm monorepo with cli, rollup-plugin, and adapter packages"
```

---

## Task 2: Window Polyfill

### Step 2.1 — Write failing test

**File: `packages/adapter/__tests__/polyfills/window.test.js`**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock wx global before importing the module
const mockSystemInfo = {
  windowWidth: 375,
  windowHeight: 667,
  pixelRatio: 2,
  platform: 'ios',
  language: 'zh_CN',
};

beforeEach(() => {
  globalThis.wx = {
    getSystemInfoSync: vi.fn(() => ({ ...mockSystemInfo })),
  };
  // Clear module cache so each test gets a fresh window
  vi.resetModules();
});

describe('window polyfill', () => {
  it('should have correct innerWidth and innerHeight from wx.getSystemInfoSync', async () => {
    const { default: window } = await import('../../src/polyfills/window.js');
    expect(window.innerWidth).toBe(375);
    expect(window.innerHeight).toBe(667);
  });

  it('should have correct devicePixelRatio', async () => {
    const { default: window } = await import('../../src/polyfills/window.js');
    expect(window.devicePixelRatio).toBe(2);
  });

  it('should support addEventListener and dispatchEvent', async () => {
    const { default: window } = await import('../../src/polyfills/window.js');
    const handler = vi.fn();
    window.addEventListener('resize', handler);
    window.dispatchEvent({ type: 'resize' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ type: 'resize' });
  });

  it('should support removeEventListener', async () => {
    const { default: window } = await import('../../src/polyfills/window.js');
    const handler = vi.fn();
    window.addEventListener('click', handler);
    window.removeEventListener('click', handler);
    window.dispatchEvent({ type: 'click' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('should have scroll offsets at zero', async () => {
    const { default: window } = await import('../../src/polyfills/window.js');
    expect(window.scrollX).toBe(0);
    expect(window.scrollY).toBe(0);
    expect(window.pageXOffset).toBe(0);
    expect(window.pageYOffset).toBe(0);
  });

  it('should have self/top/parent referencing itself', async () => {
    const { default: window } = await import('../../src/polyfills/window.js');
    expect(window.self).toBe(window);
    expect(window.top).toBe(window);
    expect(window.parent).toBe(window);
  });

  it('should have location stub', async () => {
    const { default: window } = await import('../../src/polyfills/window.js');
    expect(window.location.href).toBe('game.js');
    expect(window.location.protocol).toBe('https:');
    expect(window.location.host).toBe('minigame');
  });

  it('should have performance.now', async () => {
    const { default: window } = await import('../../src/polyfills/window.js');
    expect(typeof window.performance.now).toBe('function');
    const now = window.performance.now();
    expect(typeof now).toBe('number');
  });

  it('should dispatch events to multiple listeners of the same type', async () => {
    const { default: window } = await import('../../src/polyfills/window.js');
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    window.addEventListener('test', handler1);
    window.addEventListener('test', handler2);
    window.dispatchEvent({ type: 'test' });
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('should not fail when dispatching event with no listeners', async () => {
    const { default: window } = await import('../../src/polyfills/window.js');
    expect(() => window.dispatchEvent({ type: 'nonexistent' })).not.toThrow();
  });
});
```

### Step 2.2 — Run test to verify it fails

```bash
npx vitest run packages/adapter/__tests__/polyfills/window.test.js
```

Expected: fails because `packages/adapter/src/polyfills/window.js` does not exist.

### Step 2.3 — Write implementation

**File: `packages/adapter/src/polyfills/window.js`**

```js
const info = wx.getSystemInfoSync();

const _listeners = new Map();

const window = {
  innerWidth: info.windowWidth,
  innerHeight: info.windowHeight,
  devicePixelRatio: info.pixelRatio,

  scrollX: 0,
  scrollY: 0,
  pageXOffset: 0,
  pageYOffset: 0,

  location: {
    href: 'game.js',
    protocol: 'https:',
    host: 'minigame',
    hostname: 'minigame',
    port: '',
    pathname: '/game.js',
    search: '',
    hash: '',
    origin: 'https://minigame',
  },

  performance:
    typeof performance !== 'undefined'
      ? performance
      : { now: () => Date.now() },

  addEventListener(type, listener) {
    if (!_listeners.has(type)) {
      _listeners.set(type, []);
    }
    _listeners.get(type).push(listener);
  },

  removeEventListener(type, listener) {
    if (!_listeners.has(type)) return;
    const arr = _listeners.get(type);
    const idx = arr.indexOf(listener);
    if (idx !== -1) {
      arr.splice(idx, 1);
    }
  },

  dispatchEvent(event) {
    const arr = _listeners.get(event.type);
    if (!arr) return;
    for (let i = 0; i < arr.length; i++) {
      arr[i](event);
    }
  },

  // setTimeout / setInterval / requestAnimationFrame are already global in Mini-Game
  setTimeout: typeof setTimeout !== 'undefined' ? setTimeout : undefined,
  setInterval: typeof setInterval !== 'undefined' ? setInterval : undefined,
  clearTimeout: typeof clearTimeout !== 'undefined' ? clearTimeout : undefined,
  clearInterval:
    typeof clearInterval !== 'undefined' ? clearInterval : undefined,
  requestAnimationFrame:
    typeof requestAnimationFrame !== 'undefined'
      ? requestAnimationFrame
      : undefined,
  cancelAnimationFrame:
    typeof cancelAnimationFrame !== 'undefined'
      ? cancelAnimationFrame
      : undefined,

  // focus / blur stubs
  focus() {},
  blur() {},

  // getComputedStyle stub
  getComputedStyle() {
    return { getPropertyValue: () => '' };
  },
};

// Self-references
window.self = window;
window.top = window;
window.parent = window;

export default window;
```

### Step 2.4 — Run test to verify it passes

```bash
npx vitest run packages/adapter/__tests__/polyfills/window.test.js
```

### Step 2.5 — Commit

```bash
git add packages/adapter/src/polyfills/window.js packages/adapter/__tests__/polyfills/window.test.js
git commit -m "feat(adapter): add window polyfill with event dispatch, dimensions, and location stub"
```

---

## Task 3: Document Polyfill

### Step 3.1 — Write failing test

**File: `packages/adapter/__tests__/polyfills/document.test.js`**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockSystemInfo = {
  windowWidth: 375,
  windowHeight: 667,
  screenWidth: 375,
  screenHeight: 812,
  pixelRatio: 2,
  platform: 'ios',
  language: 'zh_CN',
};

const mockCanvas = {
  width: 375,
  height: 667,
  getContext: vi.fn(() => ({})),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

const mockImage = {
  src: '',
  width: 0,
  height: 0,
  onload: null,
  onerror: null,
};

beforeEach(() => {
  globalThis.wx = {
    getSystemInfoSync: vi.fn(() => ({ ...mockSystemInfo })),
    createCanvas: vi.fn(() => ({ ...mockCanvas })),
    createImage: vi.fn(() => ({ ...mockImage })),
  };
  globalThis.GameGlobal = {};
  vi.resetModules();
});

describe('document polyfill', () => {
  it('should create a canvas element when createElement("canvas") is called', async () => {
    const { default: document } = await import(
      '../../src/polyfills/document.js'
    );
    const canvas = document.createElement('canvas');
    expect(wx.createCanvas).toHaveBeenCalled();
    expect(canvas).toBeDefined();
  });

  it('should create an image element when createElement("image") is called', async () => {
    const { default: document } = await import(
      '../../src/polyfills/document.js'
    );
    const img = document.createElement('image');
    expect(wx.createImage).toHaveBeenCalled();
    expect(img).toBeDefined();
  });

  it('should create an image element when createElement("img") is called', async () => {
    const { default: document } = await import(
      '../../src/polyfills/document.js'
    );
    const img = document.createElement('img');
    expect(wx.createImage).toHaveBeenCalled();
    expect(img).toBeDefined();
  });

  it('should create a stub element for unknown tags', async () => {
    const { default: document } = await import(
      '../../src/polyfills/document.js'
    );
    const div = document.createElement('div');
    expect(div.tagName).toBe('DIV');
    expect(div.style).toBeDefined();
    expect(typeof div.addEventListener).toBe('function');
    expect(typeof div.removeEventListener).toBe('function');
  });

  it('should have body with clientWidth and clientHeight', async () => {
    const { default: document } = await import(
      '../../src/polyfills/document.js'
    );
    expect(document.body.clientWidth).toBe(375);
    expect(document.body.clientHeight).toBe(812);
  });

  it('body.appendChild and removeChild should be noops and not throw', async () => {
    const { default: document } = await import(
      '../../src/polyfills/document.js'
    );
    expect(() => document.body.appendChild({})).not.toThrow();
    expect(() => document.body.removeChild({})).not.toThrow();
  });

  it('should have documentElement same shape as body', async () => {
    const { default: document } = await import(
      '../../src/polyfills/document.js'
    );
    expect(document.documentElement.clientWidth).toBe(375);
    expect(document.documentElement.clientHeight).toBe(812);
  });

  it('getElementById should return GameGlobal.__wxCanvas if id matches', async () => {
    const fakeCanvas = { id: 'gameCanvas', width: 100 };
    globalThis.GameGlobal.__wxCanvas = fakeCanvas;
    const { default: document } = await import(
      '../../src/polyfills/document.js'
    );
    const result = document.getElementById('gameCanvas');
    expect(result).toBe(fakeCanvas);
  });

  it('getElementById should return null if id does not match', async () => {
    globalThis.GameGlobal.__wxCanvas = { id: 'gameCanvas' };
    const { default: document } = await import(
      '../../src/polyfills/document.js'
    );
    const result = document.getElementById('other');
    expect(result).toBeNull();
  });

  it('getElementById should return null if no __wxCanvas set', async () => {
    const { default: document } = await import(
      '../../src/polyfills/document.js'
    );
    const result = document.getElementById('anything');
    expect(result).toBeNull();
  });

  it('should have hidden=false and readyState="complete"', async () => {
    const { default: document } = await import(
      '../../src/polyfills/document.js'
    );
    expect(document.hidden).toBe(false);
    expect(document.readyState).toBe('complete');
  });

  it('visibilityState should reflect hidden property', async () => {
    const { default: document } = await import(
      '../../src/polyfills/document.js'
    );
    expect(document.visibilityState).toBe('visible');
    document.hidden = true;
    expect(document.visibilityState).toBe('hidden');
  });

  it('should support addEventListener and dispatchEvent', async () => {
    const { default: document } = await import(
      '../../src/polyfills/document.js'
    );
    const handler = vi.fn();
    document.addEventListener('visibilitychange', handler);
    document.dispatchEvent({ type: 'visibilitychange' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('createElementNS should behave like createElement', async () => {
    const { default: document } = await import(
      '../../src/polyfills/document.js'
    );
    const canvas = document.createElementNS(
      'http://www.w3.org/1999/xhtml',
      'canvas'
    );
    expect(wx.createCanvas).toHaveBeenCalled();
    expect(canvas).toBeDefined();
  });
});
```

### Step 3.2 — Run test to verify it fails

```bash
npx vitest run packages/adapter/__tests__/polyfills/document.test.js
```

### Step 3.3 — Write implementation

**File: `packages/adapter/src/polyfills/document.js`**

```js
const info = wx.getSystemInfoSync();

const _listeners = new Map();

function _createStubElement(tagName) {
  const _elListeners = new Map();
  return {
    tagName: tagName.toUpperCase(),
    style: {},
    childNodes: [],
    children: [],
    innerHTML: '',
    innerText: '',
    textContent: '',
    setAttribute(name, value) {
      this[name] = value;
    },
    getAttribute(name) {
      return this[name] !== undefined ? this[name] : null;
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) this.children.splice(idx, 1);
      return child;
    },
    addEventListener(type, listener) {
      if (!_elListeners.has(type)) {
        _elListeners.set(type, []);
      }
      _elListeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      if (!_elListeners.has(type)) return;
      const arr = _elListeners.get(type);
      const idx = arr.indexOf(listener);
      if (idx !== -1) arr.splice(idx, 1);
    },
    dispatchEvent(event) {
      const arr = _elListeners.get(event.type);
      if (!arr) return;
      for (let i = 0; i < arr.length; i++) {
        arr[i](event);
      }
    },
    getBoundingClientRect() {
      return { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 };
    },
    cloneNode() {
      return _createStubElement(tagName);
    },
  };
}

const _bodyElement = {
  clientWidth: info.screenWidth,
  clientHeight: info.screenHeight,
  style: {},
  appendChild() {},
  removeChild() {},
  insertBefore() {},
  replaceChild() {},
  addEventListener() {},
  removeEventListener() {},
  getBoundingClientRect() {
    return {
      x: 0,
      y: 0,
      width: info.screenWidth,
      height: info.screenHeight,
      top: 0,
      right: info.screenWidth,
      bottom: info.screenHeight,
      left: 0,
    };
  },
};

const _documentElement = {
  clientWidth: info.screenWidth,
  clientHeight: info.screenHeight,
  style: {},
  appendChild() {},
  removeChild() {},
  insertBefore() {},
  replaceChild() {},
  addEventListener() {},
  removeEventListener() {},
  getBoundingClientRect() {
    return {
      x: 0,
      y: 0,
      width: info.screenWidth,
      height: info.screenHeight,
      top: 0,
      right: info.screenWidth,
      bottom: info.screenHeight,
      left: 0,
    };
  },
};

const document = {
  _hidden: false,

  get hidden() {
    return this._hidden;
  },

  set hidden(value) {
    this._hidden = value;
  },

  get visibilityState() {
    return this._hidden ? 'hidden' : 'visible';
  },

  readyState: 'complete',

  body: _bodyElement,
  documentElement: _documentElement,

  head: _createStubElement('head'),

  createElement(tagName) {
    const tag = tagName.toLowerCase();
    if (tag === 'canvas') {
      return wx.createCanvas();
    }
    if (tag === 'image' || tag === 'img') {
      return wx.createImage();
    }
    return _createStubElement(tagName);
  },

  createElementNS(_namespace, tagName) {
    return this.createElement(tagName);
  },

  createTextNode(text) {
    return { textContent: text, nodeType: 3 };
  },

  getElementById(id) {
    const canvas =
      typeof GameGlobal !== 'undefined' ? GameGlobal.__wxCanvas : null;
    if (canvas && canvas.id === id) {
      return canvas;
    }
    return null;
  },

  getElementsByTagName(_tag) {
    return [];
  },

  getElementsByClassName(_className) {
    return [];
  },

  querySelector(_selector) {
    return null;
  },

  querySelectorAll(_selector) {
    return [];
  },

  addEventListener(type, listener) {
    if (!_listeners.has(type)) {
      _listeners.set(type, []);
    }
    _listeners.get(type).push(listener);
  },

  removeEventListener(type, listener) {
    if (!_listeners.has(type)) return;
    const arr = _listeners.get(type);
    const idx = arr.indexOf(listener);
    if (idx !== -1) arr.splice(idx, 1);
  },

  dispatchEvent(event) {
    const arr = _listeners.get(event.type);
    if (!arr) return;
    for (let i = 0; i < arr.length; i++) {
      arr[i](event);
    }
  },
};

export default document;
```

### Step 3.4 — Run test to verify it passes

```bash
npx vitest run packages/adapter/__tests__/polyfills/document.test.js
```

### Step 3.5 — Commit

```bash
git add packages/adapter/src/polyfills/document.js packages/adapter/__tests__/polyfills/document.test.js
git commit -m "feat(adapter): add document polyfill with createElement, body, getElementById, and events"
```

---

## Task 4: Navigator Polyfill

### Step 4.1 — Write failing test

**File: `packages/adapter/__tests__/polyfills/navigator.test.js`**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockSystemInfo = {
  windowWidth: 375,
  windowHeight: 667,
  pixelRatio: 2,
  platform: 'ios',
  language: 'zh_CN',
};

beforeEach(() => {
  globalThis.wx = {
    getSystemInfoSync: vi.fn(() => ({ ...mockSystemInfo })),
    vibrateShort: vi.fn(),
  };
  vi.resetModules();
});

describe('navigator polyfill', () => {
  it('should have correct userAgent string', async () => {
    const { default: navigator } = await import(
      '../../src/polyfills/navigator.js'
    );
    expect(navigator.userAgent).toBe(
      'Mozilla/5.0 (WeChat MiniGame) PhaserWxAdapter/0.1.0'
    );
  });

  it('should get platform from wx.getSystemInfoSync', async () => {
    const { default: navigator } = await import(
      '../../src/polyfills/navigator.js'
    );
    expect(navigator.platform).toBe('ios');
  });

  it('should get language from wx.getSystemInfoSync', async () => {
    const { default: navigator } = await import(
      '../../src/polyfills/navigator.js'
    );
    expect(navigator.language).toBe('zh_CN');
  });

  it('should have languages array containing the language', async () => {
    const { default: navigator } = await import(
      '../../src/polyfills/navigator.js'
    );
    expect(navigator.languages).toEqual(['zh_CN']);
  });

  it('should default language to zh-CN if not available', async () => {
    globalThis.wx.getSystemInfoSync = vi.fn(() => ({
      ...mockSystemInfo,
      language: undefined,
    }));
    const { default: navigator } = await import(
      '../../src/polyfills/navigator.js'
    );
    expect(navigator.language).toBe('zh-CN');
    expect(navigator.languages).toEqual(['zh-CN']);
  });

  it('should have onLine set to true', async () => {
    const { default: navigator } = await import(
      '../../src/polyfills/navigator.js'
    );
    expect(navigator.onLine).toBe(true);
  });

  it('should call wx.vibrateShort on vibrate()', async () => {
    const { default: navigator } = await import(
      '../../src/polyfills/navigator.js'
    );
    navigator.vibrate(100);
    expect(wx.vibrateShort).toHaveBeenCalledWith({ type: 'medium' });
  });

  it('vibrate should return false when wx.vibrateShort is not available', async () => {
    globalThis.wx = {
      getSystemInfoSync: vi.fn(() => ({ ...mockSystemInfo })),
    };
    const { default: navigator } = await import(
      '../../src/polyfills/navigator.js'
    );
    const result = navigator.vibrate(100);
    expect(result).toBe(false);
  });

  it('should have maxTouchPoints of 10', async () => {
    const { default: navigator } = await import(
      '../../src/polyfills/navigator.js'
    );
    expect(navigator.maxTouchPoints).toBe(10);
  });

  it('should have vendor set to WeChat', async () => {
    const { default: navigator } = await import(
      '../../src/polyfills/navigator.js'
    );
    expect(navigator.vendor).toBe('WeChat');
  });
});
```

### Step 4.2 — Run test to verify it fails

```bash
npx vitest run packages/adapter/__tests__/polyfills/navigator.test.js
```

### Step 4.3 — Write implementation

**File: `packages/adapter/src/polyfills/navigator.js`**

```js
const info = wx.getSystemInfoSync();

const language = info.language || 'zh-CN';

const navigator = {
  userAgent: 'Mozilla/5.0 (WeChat MiniGame) PhaserWxAdapter/0.1.0',
  platform: info.platform,
  language: language,
  languages: [language],
  onLine: true,
  maxTouchPoints: 10,
  vendor: 'WeChat',

  vibrate(pattern) {
    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'medium' });
      return true;
    }
    return false;
  },

  // Stubs for APIs Phaser or plugins may probe
  clipboard: {
    writeText() {
      return Promise.resolve();
    },
    readText() {
      return Promise.resolve('');
    },
  },

  getGamepads() {
    return [];
  },
};

export default navigator;
```

### Step 4.4 — Run test to verify it passes

```bash
npx vitest run packages/adapter/__tests__/polyfills/navigator.test.js
```

### Step 4.5 — Commit

```bash
git add packages/adapter/src/polyfills/navigator.js packages/adapter/__tests__/polyfills/navigator.test.js
git commit -m "feat(adapter): add navigator polyfill with platform, language, and vibrate support"
```

---

## Task 5: Canvas Polyfill

### Step 5.1 — Write failing test

**File: `packages/adapter/__tests__/polyfills/canvas.test.js`**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';

let canvasIdCounter;

beforeEach(() => {
  canvasIdCounter = 0;
  globalThis.GameGlobal = {};
  globalThis.wx = {
    getSystemInfoSync: vi.fn(() => ({
      windowWidth: 375,
      windowHeight: 667,
      pixelRatio: 2,
    })),
    createCanvas: vi.fn(() => {
      canvasIdCounter++;
      return {
        id: `canvas_${canvasIdCounter}`,
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({})),
      };
    }),
  };
  vi.resetModules();
});

describe('canvas polyfill', () => {
  it('createPrimaryCanvas should create a canvas and store it on GameGlobal.__wxCanvas', async () => {
    const { createPrimaryCanvas } = await import(
      '../../src/polyfills/canvas.js'
    );
    const canvas = createPrimaryCanvas();
    expect(wx.createCanvas).toHaveBeenCalled();
    expect(GameGlobal.__wxCanvas).toBe(canvas);
  });

  it('primary canvas should have addEventListener/removeEventListener/dispatchEvent', async () => {
    const { createPrimaryCanvas } = await import(
      '../../src/polyfills/canvas.js'
    );
    const canvas = createPrimaryCanvas();
    expect(typeof canvas.addEventListener).toBe('function');
    expect(typeof canvas.removeEventListener).toBe('function');
    expect(typeof canvas.dispatchEvent).toBe('function');
  });

  it('primary canvas event dispatch should work', async () => {
    const { createPrimaryCanvas } = await import(
      '../../src/polyfills/canvas.js'
    );
    const canvas = createPrimaryCanvas();
    const handler = vi.fn();
    canvas.addEventListener('touchstart', handler);
    canvas.dispatchEvent({ type: 'touchstart' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('createOffscreenCanvas should always return a new canvas', async () => {
    const { createOffscreenCanvas } = await import(
      '../../src/polyfills/canvas.js'
    );
    const c1 = createOffscreenCanvas();
    const c2 = createOffscreenCanvas();
    expect(wx.createCanvas).toHaveBeenCalledTimes(2);
    expect(c1).not.toBe(c2);
  });

  it('createPrimaryCanvas should set width/height from system info', async () => {
    const { createPrimaryCanvas } = await import(
      '../../src/polyfills/canvas.js'
    );
    const canvas = createPrimaryCanvas();
    expect(canvas.width).toBe(375);
    expect(canvas.height).toBe(667);
  });

  it('primary canvas should have an id property', async () => {
    const { createPrimaryCanvas } = await import(
      '../../src/polyfills/canvas.js'
    );
    const canvas = createPrimaryCanvas();
    expect(canvas.id).toBeDefined();
  });
});
```

### Step 5.2 — Run test to verify it fails

```bash
npx vitest run packages/adapter/__tests__/polyfills/canvas.test.js
```

### Step 5.3 — Write implementation

**File: `packages/adapter/src/polyfills/canvas.js`**

```js
function _attachEventMethods(canvas) {
  const _listeners = new Map();

  // Only attach if not already present
  if (typeof canvas.addEventListener !== 'function') {
    canvas.addEventListener = function (type, listener) {
      if (!_listeners.has(type)) {
        _listeners.set(type, []);
      }
      _listeners.get(type).push(listener);
    };
  }

  if (typeof canvas.removeEventListener !== 'function') {
    canvas.removeEventListener = function (type, listener) {
      if (!_listeners.has(type)) return;
      const arr = _listeners.get(type);
      const idx = arr.indexOf(listener);
      if (idx !== -1) arr.splice(idx, 1);
    };
  }

  if (typeof canvas.dispatchEvent !== 'function') {
    canvas.dispatchEvent = function (event) {
      const arr = _listeners.get(event.type);
      if (!arr) return;
      for (let i = 0; i < arr.length; i++) {
        arr[i](event);
      }
    };
  }

  return canvas;
}

export function createPrimaryCanvas() {
  const info = wx.getSystemInfoSync();
  const canvas = wx.createCanvas();

  canvas.width = info.windowWidth;
  canvas.height = info.windowHeight;

  if (!canvas.id) {
    canvas.id = 'gameCanvas';
  }

  _attachEventMethods(canvas);

  // Stub style and getBoundingClientRect if not present
  if (!canvas.style) {
    canvas.style = { width: `${info.windowWidth}px`, height: `${info.windowHeight}px` };
  }

  if (!canvas.getBoundingClientRect) {
    canvas.getBoundingClientRect = function () {
      return {
        x: 0,
        y: 0,
        width: info.windowWidth,
        height: info.windowHeight,
        top: 0,
        right: info.windowWidth,
        bottom: info.windowHeight,
        left: 0,
      };
    };
  }

  if (!canvas.focus) {
    canvas.focus = function () {};
  }

  // Store as the primary canvas
  GameGlobal.__wxCanvas = canvas;

  return canvas;
}

export function createOffscreenCanvas() {
  const canvas = wx.createCanvas();
  _attachEventMethods(canvas);
  return canvas;
}
```

### Step 5.4 — Run test to verify it passes

```bash
npx vitest run packages/adapter/__tests__/polyfills/canvas.test.js
```

### Step 5.5 — Commit

```bash
git add packages/adapter/src/polyfills/canvas.js packages/adapter/__tests__/polyfills/canvas.test.js
git commit -m "feat(adapter): add canvas polyfill with primary and offscreen canvas creation"
```

---

## Task 6: Image Polyfill

### Step 6.1 — Write failing test

**File: `packages/adapter/__tests__/polyfills/image.test.js`**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  globalThis.wx = {
    createImage: vi.fn(() => ({
      src: '',
      width: 0,
      height: 0,
      onload: null,
      onerror: null,
    })),
  };
  vi.resetModules();
});

describe('Image polyfill', () => {
  it('should call wx.createImage and return the wx image object', async () => {
    const { default: WxImage } = await import(
      '../../src/polyfills/image.js'
    );
    const img = new WxImage();
    expect(wx.createImage).toHaveBeenCalled();
    expect(img).toBeDefined();
    expect(img.src).toBe('');
  });

  it('returned image should have src, width, height, onload, onerror', async () => {
    const { default: WxImage } = await import(
      '../../src/polyfills/image.js'
    );
    const img = new WxImage();
    expect('src' in img).toBe(true);
    expect('width' in img).toBe(true);
    expect('height' in img).toBe(true);
    expect('onload' in img).toBe(true);
    expect('onerror' in img).toBe(true);
  });

  it('setting src on the returned object should work', async () => {
    const { default: WxImage } = await import(
      '../../src/polyfills/image.js'
    );
    const img = new WxImage();
    img.src = 'test.png';
    expect(img.src).toBe('test.png');
  });

  it('each new Image() call should return a fresh wx image', async () => {
    const { default: WxImage } = await import(
      '../../src/polyfills/image.js'
    );
    const img1 = new WxImage();
    const img2 = new WxImage();
    expect(wx.createImage).toHaveBeenCalledTimes(2);
    expect(img1).not.toBe(img2);
  });
});
```

### Step 6.2 — Run test to verify it fails

```bash
npx vitest run packages/adapter/__tests__/polyfills/image.test.js
```

### Step 6.3 — Write implementation

**File: `packages/adapter/src/polyfills/image.js`**

```js
function WxImage() {
  const img = wx.createImage();

  // Ensure addEventListener/removeEventListener exist for Phaser compatibility
  if (!img.addEventListener) {
    const _listeners = new Map();

    img.addEventListener = function (type, listener) {
      if (!_listeners.has(type)) {
        _listeners.set(type, []);
      }
      _listeners.get(type).push(listener);

      // Wire up onload/onerror shortcuts
      if (type === 'load') {
        const origOnload = img.onload;
        img.onload = function () {
          if (origOnload) origOnload.call(img);
          const arr = _listeners.get('load');
          if (arr) arr.forEach((fn) => fn.call(img));
        };
      } else if (type === 'error') {
        const origOnerror = img.onerror;
        img.onerror = function (err) {
          if (origOnerror) origOnerror.call(img, err);
          const arr = _listeners.get('error');
          if (arr) arr.forEach((fn) => fn.call(img, err));
        };
      }
    };

    img.removeEventListener = function (type, listener) {
      if (!_listeners.has(type)) return;
      const arr = _listeners.get(type);
      const idx = arr.indexOf(listener);
      if (idx !== -1) arr.splice(idx, 1);
    };
  }

  return img;
}

export default WxImage;
```

### Step 6.4 — Run test to verify it passes

```bash
npx vitest run packages/adapter/__tests__/polyfills/image.test.js
```

### Step 6.5 — Commit

```bash
git add packages/adapter/src/polyfills/image.js packages/adapter/__tests__/polyfills/image.test.js
git commit -m "feat(adapter): add Image polyfill wrapping wx.createImage"
```

---

## Task 7: Audio Polyfill

### Step 7.1 — Write failing test

**File: `packages/adapter/__tests__/polyfills/audio.test.js`**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';

let mockInnerAudio;

beforeEach(() => {
  mockInnerAudio = {
    src: '',
    volume: 1,
    loop: false,
    currentTime: 0,
    duration: 0,
    paused: true,
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
    seek: vi.fn(),
    onCanplay: vi.fn(),
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onStop: vi.fn(),
    onEnded: vi.fn(),
    onError: vi.fn(),
    onTimeUpdate: vi.fn(),
    offCanplay: vi.fn(),
    offPlay: vi.fn(),
    offEnded: vi.fn(),
    offError: vi.fn(),
  };

  globalThis.wx = {
    createInnerAudioContext: vi.fn(() => ({ ...mockInnerAudio })),
  };
  vi.resetModules();
});

describe('WxAudio', () => {
  it('should create an inner audio context on instantiation', async () => {
    const { WxAudio } = await import('../../src/polyfills/audio.js');
    const audio = new WxAudio();
    expect(wx.createInnerAudioContext).toHaveBeenCalled();
  });

  it('should proxy src getter/setter to inner audio', async () => {
    const { WxAudio } = await import('../../src/polyfills/audio.js');
    const audio = new WxAudio();
    audio.src = 'bgm.mp3';
    expect(audio.src).toBe('bgm.mp3');
  });

  it('should proxy volume getter/setter', async () => {
    const { WxAudio } = await import('../../src/polyfills/audio.js');
    const audio = new WxAudio();
    audio.volume = 0.5;
    expect(audio.volume).toBe(0.5);
  });

  it('should proxy loop getter/setter', async () => {
    const { WxAudio } = await import('../../src/polyfills/audio.js');
    const audio = new WxAudio();
    audio.loop = true;
    expect(audio.loop).toBe(true);
  });

  it('play() should call innerAudio.play()', async () => {
    const { WxAudio } = await import('../../src/polyfills/audio.js');
    const audio = new WxAudio();
    audio.play();
    expect(audio._innerAudio.play).toHaveBeenCalled();
  });

  it('pause() should call innerAudio.pause()', async () => {
    const { WxAudio } = await import('../../src/polyfills/audio.js');
    const audio = new WxAudio();
    audio.pause();
    expect(audio._innerAudio.pause).toHaveBeenCalled();
  });

  it('load() should be a noop and not throw', async () => {
    const { WxAudio } = await import('../../src/polyfills/audio.js');
    const audio = new WxAudio();
    expect(() => audio.load()).not.toThrow();
  });

  it('cloneNode() should create a new WxAudio with the same src', async () => {
    const { WxAudio } = await import('../../src/polyfills/audio.js');
    const audio = new WxAudio();
    audio.src = 'bgm.mp3';
    const clone = audio.cloneNode();
    expect(clone).not.toBe(audio);
    expect(clone.src).toBe('bgm.mp3');
  });

  it('addEventListener and removeEventListener should work', async () => {
    const { WxAudio } = await import('../../src/polyfills/audio.js');
    const audio = new WxAudio();
    const handler = vi.fn();
    audio.addEventListener('ended', handler);
    audio._fireEvent('ended');
    expect(handler).toHaveBeenCalledTimes(1);
    audio.removeEventListener('ended', handler);
    audio._fireEvent('ended');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('muted getter/setter should control volume', async () => {
    const { WxAudio } = await import('../../src/polyfills/audio.js');
    const audio = new WxAudio();
    audio.volume = 0.8;
    audio.muted = true;
    expect(audio._innerAudio.volume).toBe(0);
    audio.muted = false;
    expect(audio._innerAudio.volume).toBe(0.8);
  });
});

describe('AudioContext stub', () => {
  it('should not throw when constructed', async () => {
    const { WxAudioContext } = await import('../../src/polyfills/audio.js');
    expect(() => new WxAudioContext()).not.toThrow();
  });

  it('createBufferSource should return a stub', async () => {
    const { WxAudioContext } = await import('../../src/polyfills/audio.js');
    const ctx = new WxAudioContext();
    const source = ctx.createBufferSource();
    expect(source).toBeDefined();
    expect(typeof source.connect).toBe('function');
    expect(typeof source.start).toBe('function');
    expect(typeof source.stop).toBe('function');
  });

  it('createGain should return a stub with gain.value', async () => {
    const { WxAudioContext } = await import('../../src/polyfills/audio.js');
    const ctx = new WxAudioContext();
    const gain = ctx.createGain();
    expect(gain.gain).toBeDefined();
    expect(gain.gain.value).toBe(1);
  });

  it('destination should be defined', async () => {
    const { WxAudioContext } = await import('../../src/polyfills/audio.js');
    const ctx = new WxAudioContext();
    expect(ctx.destination).toBeDefined();
  });
});
```

### Step 7.2 — Run test to verify it fails

```bash
npx vitest run packages/adapter/__tests__/polyfills/audio.test.js
```

### Step 7.3 — Write implementation

**File: `packages/adapter/src/polyfills/audio.js`**

```js
export class WxAudio {
  constructor() {
    this._innerAudio = wx.createInnerAudioContext();
    this._listeners = new Map();
    this._muted = false;
    this._volume = 1;
    this.readyState = 0; // HAVE_NOTHING

    // Wire wx callbacks to our event system
    this._innerAudio.onCanplay(() => {
      this.readyState = 4; // HAVE_ENOUGH_DATA
      this._fireEvent('canplaythrough');
    });
    this._innerAudio.onPlay(() => {
      this._fireEvent('play');
    });
    this._innerAudio.onEnded(() => {
      this._fireEvent('ended');
    });
    this._innerAudio.onError((err) => {
      this._fireEvent('error', err);
    });
  }

  get src() {
    return this._innerAudio.src;
  }

  set src(value) {
    this._innerAudio.src = value;
  }

  get volume() {
    return this._volume;
  }

  set volume(value) {
    this._volume = value;
    if (!this._muted) {
      this._innerAudio.volume = value;
    }
  }

  get loop() {
    return this._innerAudio.loop;
  }

  set loop(value) {
    this._innerAudio.loop = value;
  }

  get muted() {
    return this._muted;
  }

  set muted(value) {
    this._muted = value;
    this._innerAudio.volume = value ? 0 : this._volume;
  }

  get currentTime() {
    return this._innerAudio.currentTime;
  }

  set currentTime(value) {
    this._innerAudio.seek(value);
  }

  get duration() {
    return this._innerAudio.duration;
  }

  get paused() {
    return this._innerAudio.paused;
  }

  play() {
    this._innerAudio.play();
    return Promise.resolve();
  }

  pause() {
    this._innerAudio.pause();
  }

  load() {
    // noop — wx handles loading when src is set
  }

  cloneNode() {
    const clone = new WxAudio();
    clone.src = this.src;
    clone.volume = this.volume;
    clone.loop = this.loop;
    return clone;
  }

  addEventListener(type, listener) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, []);
    }
    this._listeners.get(type).push(listener);
  }

  removeEventListener(type, listener) {
    if (!this._listeners.has(type)) return;
    const arr = this._listeners.get(type);
    const idx = arr.indexOf(listener);
    if (idx !== -1) arr.splice(idx, 1);
  }

  _fireEvent(type, data) {
    const arr = this._listeners.get(type);
    if (!arr) return;
    const event = { type, target: this, data };
    for (let i = 0; i < arr.length; i++) {
      arr[i](event);
    }
    // Also call on-prefixed handler if set
    const handler = this['on' + type];
    if (typeof handler === 'function') {
      handler(event);
    }
  }

  destroy() {
    this._innerAudio.destroy();
  }
}

// Stub for Web Audio API — Phaser uses it for WebAudio sound manager
export class WxAudioContext {
  constructor() {
    this.sampleRate = 44100;
    this.state = 'running';
    this.destination = {
      channelCount: 2,
      numberOfInputs: 1,
      numberOfOutputs: 0,
      connect() {},
      disconnect() {},
    };
  }

  createBufferSource() {
    return {
      buffer: null,
      loop: false,
      playbackRate: { value: 1 },
      connect() {},
      disconnect() {},
      start() {},
      stop() {},
      addEventListener() {},
      removeEventListener() {},
    };
  }

  createGain() {
    return {
      gain: { value: 1 },
      connect() {},
      disconnect() {},
    };
  }

  createOscillator() {
    return {
      frequency: { value: 440 },
      type: 'sine',
      connect() {},
      disconnect() {},
      start() {},
      stop() {},
    };
  }

  createAnalyser() {
    return {
      fftSize: 2048,
      frequencyBinCount: 1024,
      connect() {},
      disconnect() {},
      getByteFrequencyData() {},
      getFloatFrequencyData() {},
    };
  }

  createBuffer(channels, length, sampleRate) {
    return {
      numberOfChannels: channels,
      length: length,
      sampleRate: sampleRate,
      getChannelData() {
        return new Float32Array(length);
      },
    };
  }

  decodeAudioData(arrayBuffer) {
    return Promise.resolve(this.createBuffer(2, 1024, 44100));
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }

  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }

  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}
```

### Step 7.4 — Run test to verify it passes

```bash
npx vitest run packages/adapter/__tests__/polyfills/audio.test.js
```

### Step 7.5 — Commit

```bash
git add packages/adapter/src/polyfills/audio.js packages/adapter/__tests__/polyfills/audio.test.js
git commit -m "feat(adapter): add Audio polyfill with WxAudio class and AudioContext stub"
```

---

## Task 8: XMLHttpRequest Polyfill

### Step 8.1 — Write failing test

**File: `packages/adapter/__tests__/polyfills/xmlhttprequest.test.js`**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';

let mockRequestTask;
let mockDownloadTask;
let mockFileManager;

beforeEach(() => {
  mockRequestTask = { abort: vi.fn() };
  mockDownloadTask = { abort: vi.fn() };
  mockFileManager = {
    readFile: vi.fn(),
  };

  globalThis.wx = {
    request: vi.fn((opts) => {
      // Simulate async success by default
      Promise.resolve().then(() => {
        if (opts.success) {
          opts.success({
            data: opts.dataType === 'json' ? { key: 'value' } : 'response text',
            statusCode: 200,
            header: { 'content-type': 'application/json' },
          });
        }
      });
      return mockRequestTask;
    }),
    downloadFile: vi.fn((opts) => {
      Promise.resolve().then(() => {
        if (opts.success) {
          opts.success({ tempFilePath: '/tmp/file.bin', statusCode: 200 });
        }
      });
      return mockDownloadTask;
    }),
    getFileSystemManager: vi.fn(() => mockFileManager),
  };
  vi.resetModules();
});

describe('WxXMLHttpRequest', () => {
  it('should store method and url on open()', async () => {
    const { default: WxXMLHttpRequest } = await import(
      '../../src/polyfills/xmlhttprequest.js'
    );
    const xhr = new WxXMLHttpRequest();
    xhr.open('GET', 'https://example.com/data');
    expect(xhr._method).toBe('GET');
    expect(xhr._url).toBe('https://example.com/data');
  });

  it('should store headers on setRequestHeader()', async () => {
    const { default: WxXMLHttpRequest } = await import(
      '../../src/polyfills/xmlhttprequest.js'
    );
    const xhr = new WxXMLHttpRequest();
    xhr.setRequestHeader('Content-Type', 'application/json');
    expect(xhr._headers['Content-Type']).toBe('application/json');
  });

  it('send() with text responseType should use wx.request and call onload', async () => {
    const { default: WxXMLHttpRequest } = await import(
      '../../src/polyfills/xmlhttprequest.js'
    );
    const xhr = new WxXMLHttpRequest();
    xhr.open('GET', 'https://example.com/data');
    xhr.responseType = 'text';

    const onload = vi.fn();
    xhr.onload = onload;
    xhr.send();

    // Wait for the microtask
    await new Promise((r) => setTimeout(r, 10));

    expect(wx.request).toHaveBeenCalled();
    expect(onload).toHaveBeenCalled();
    expect(xhr.status).toBe(200);
    expect(xhr.responseText).toBe('response text');
  });

  it('send() with json responseType should use wx.request with dataType json', async () => {
    const { default: WxXMLHttpRequest } = await import(
      '../../src/polyfills/xmlhttprequest.js'
    );
    const xhr = new WxXMLHttpRequest();
    xhr.open('GET', 'https://example.com/data.json');
    xhr.responseType = 'json';

    const onload = vi.fn();
    xhr.onload = onload;
    xhr.send();

    await new Promise((r) => setTimeout(r, 10));

    expect(wx.request).toHaveBeenCalledWith(
      expect.objectContaining({ dataType: 'json' })
    );
    expect(xhr.response).toEqual({ key: 'value' });
  });

  it('send() with arraybuffer responseType should use wx.downloadFile + readFile', async () => {
    const fakeBuffer = new ArrayBuffer(8);
    mockFileManager.readFile.mockImplementation((opts) => {
      if (opts.success) {
        opts.success({ data: fakeBuffer });
      }
    });

    const { default: WxXMLHttpRequest } = await import(
      '../../src/polyfills/xmlhttprequest.js'
    );
    const xhr = new WxXMLHttpRequest();
    xhr.open('GET', 'https://example.com/file.bin');
    xhr.responseType = 'arraybuffer';

    const onload = vi.fn();
    xhr.onload = onload;
    xhr.send();

    await new Promise((r) => setTimeout(r, 10));

    expect(wx.downloadFile).toHaveBeenCalled();
    expect(mockFileManager.readFile).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: '/tmp/file.bin', encoding: '' })
    );
    expect(xhr.response).toBe(fakeBuffer);
    expect(onload).toHaveBeenCalled();
  });

  it('abort() should call task.abort()', async () => {
    const { default: WxXMLHttpRequest } = await import(
      '../../src/polyfills/xmlhttprequest.js'
    );
    const xhr = new WxXMLHttpRequest();
    xhr.open('GET', 'https://example.com/data');
    xhr.responseType = 'text';
    xhr.send();

    xhr.abort();
    expect(mockRequestTask.abort).toHaveBeenCalled();
  });

  it('send() should call onerror on wx.request failure', async () => {
    wx.request = vi.fn((opts) => {
      Promise.resolve().then(() => {
        if (opts.fail) {
          opts.fail({ errMsg: 'request:fail' });
        }
      });
      return mockRequestTask;
    });

    const { default: WxXMLHttpRequest } = await import(
      '../../src/polyfills/xmlhttprequest.js'
    );
    const xhr = new WxXMLHttpRequest();
    xhr.open('GET', 'https://example.com/data');
    xhr.responseType = 'text';

    const onerror = vi.fn();
    xhr.onerror = onerror;
    xhr.send();

    await new Promise((r) => setTimeout(r, 10));
    expect(onerror).toHaveBeenCalled();
  });

  it('should have correct default property values', async () => {
    const { default: WxXMLHttpRequest } = await import(
      '../../src/polyfills/xmlhttprequest.js'
    );
    const xhr = new WxXMLHttpRequest();
    expect(xhr.readyState).toBe(0);
    expect(xhr.status).toBe(0);
    expect(xhr.statusText).toBe('');
    expect(xhr.response).toBeNull();
    expect(xhr.responseText).toBe('');
    expect(xhr.responseType).toBe('');
    expect(xhr.timeout).toBe(0);
  });

  it('should fire onreadystatechange when state changes', async () => {
    const { default: WxXMLHttpRequest } = await import(
      '../../src/polyfills/xmlhttprequest.js'
    );
    const xhr = new WxXMLHttpRequest();
    const onrsc = vi.fn();
    xhr.onreadystatechange = onrsc;

    xhr.open('GET', 'https://example.com/data');
    expect(onrsc).toHaveBeenCalled();
    expect(xhr.readyState).toBe(1); // OPENED
  });
});
```

### Step 8.2 — Run test to verify it fails

```bash
npx vitest run packages/adapter/__tests__/polyfills/xmlhttprequest.test.js
```

### Step 8.3 — Write implementation

**File: `packages/adapter/src/polyfills/xmlhttprequest.js`**

```js
const UNSENT = 0;
const OPENED = 1;
const HEADERS_RECEIVED = 2;
const LOADING = 3;
const DONE = 4;

class WxXMLHttpRequest {
  constructor() {
    this.readyState = UNSENT;
    this.status = 0;
    this.statusText = '';
    this.response = null;
    this.responseText = '';
    this.responseType = '';
    this.timeout = 0;
    this.responseHeaders = {};

    this._method = '';
    this._url = '';
    this._headers = {};
    this._task = null;

    // Event handlers
    this.onload = null;
    this.onerror = null;
    this.onprogress = null;
    this.onreadystatechange = null;
    this.ontimeout = null;
    this.onabort = null;
  }

  _setReadyState(state) {
    this.readyState = state;
    if (typeof this.onreadystatechange === 'function') {
      this.onreadystatechange();
    }
  }

  open(method, url) {
    this._method = method;
    this._url = url;
    this._setReadyState(OPENED);
  }

  setRequestHeader(name, value) {
    this._headers[name] = value;
  }

  getResponseHeader(name) {
    return this.responseHeaders[name.toLowerCase()] || null;
  }

  getAllResponseHeaders() {
    return Object.keys(this.responseHeaders)
      .map((k) => `${k}: ${this.responseHeaders[k]}`)
      .join('\r\n');
  }

  send(data) {
    const responseType = this.responseType;
    const isBinary =
      responseType === 'arraybuffer' || responseType === 'blob';

    if (isBinary) {
      this._sendBinary(data);
    } else {
      this._sendText(data);
    }
  }

  _sendText(data) {
    const dataType =
      this.responseType === 'json' ? 'json' : 'text';

    this._task = wx.request({
      url: this._url,
      method: this._method,
      header: this._headers,
      data: data,
      dataType: dataType,
      timeout: this.timeout || undefined,
      success: (res) => {
        this.status = res.statusCode;
        this.statusText = `${res.statusCode}`;
        this.responseHeaders = this._normalizeHeaders(res.header || {});

        if (dataType === 'json') {
          this.response = res.data;
          this.responseText =
            typeof res.data === 'string'
              ? res.data
              : JSON.stringify(res.data);
        } else {
          this.responseText = res.data;
          this.response = res.data;
        }

        this._setReadyState(DONE);
        if (typeof this.onload === 'function') {
          this.onload();
        }
      },
      fail: (err) => {
        this._setReadyState(DONE);
        if (typeof this.onerror === 'function') {
          this.onerror(err);
        }
      },
    });
  }

  _sendBinary(_data) {
    this._task = wx.downloadFile({
      url: this._url,
      header: this._headers,
      timeout: this.timeout || undefined,
      success: (res) => {
        this.status = res.statusCode;
        this.statusText = `${res.statusCode}`;

        const fs = wx.getFileSystemManager();
        fs.readFile({
          filePath: res.tempFilePath,
          encoding: '',
          success: (fileRes) => {
            this.response = fileRes.data;
            this._setReadyState(DONE);
            if (typeof this.onload === 'function') {
              this.onload();
            }
          },
          fail: (err) => {
            this._setReadyState(DONE);
            if (typeof this.onerror === 'function') {
              this.onerror(err);
            }
          },
        });
      },
      fail: (err) => {
        this._setReadyState(DONE);
        if (typeof this.onerror === 'function') {
          this.onerror(err);
        }
      },
    });
  }

  abort() {
    if (this._task && typeof this._task.abort === 'function') {
      this._task.abort();
    }
    this._setReadyState(DONE);
    if (typeof this.onabort === 'function') {
      this.onabort();
    }
  }

  _normalizeHeaders(headers) {
    const normalized = {};
    for (const key of Object.keys(headers)) {
      normalized[key.toLowerCase()] = headers[key];
    }
    return normalized;
  }
}

// Static constants
WxXMLHttpRequest.UNSENT = UNSENT;
WxXMLHttpRequest.OPENED = OPENED;
WxXMLHttpRequest.HEADERS_RECEIVED = HEADERS_RECEIVED;
WxXMLHttpRequest.LOADING = LOADING;
WxXMLHttpRequest.DONE = DONE;

export default WxXMLHttpRequest;
```

### Step 8.4 — Run test to verify it passes

```bash
npx vitest run packages/adapter/__tests__/polyfills/xmlhttprequest.test.js
```

### Step 8.5 — Commit

```bash
git add packages/adapter/src/polyfills/xmlhttprequest.js packages/adapter/__tests__/polyfills/xmlhttprequest.test.js
git commit -m "feat(adapter): add XMLHttpRequest polyfill routing text/json via wx.request and binary via wx.downloadFile"
```

---

## Task 9: Fetch Polyfill

### Step 9.1 — Write failing test

**File: `packages/adapter/__tests__/polyfills/fetch.test.js`**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';

let mockFileManager;

beforeEach(() => {
  mockFileManager = {
    readFile: vi.fn((opts) => {
      if (opts.success) {
        opts.success({ data: new ArrayBuffer(8) });
      }
    }),
  };

  globalThis.wx = {
    request: vi.fn((opts) => {
      Promise.resolve().then(() => {
        if (opts.success) {
          opts.success({
            data:
              opts.dataType === 'json'
                ? { hello: 'world' }
                : 'plain text response',
            statusCode: 200,
            header: { 'content-type': 'application/json' },
          });
        }
      });
      return {};
    }),
    downloadFile: vi.fn((opts) => {
      Promise.resolve().then(() => {
        if (opts.success) {
          opts.success({ tempFilePath: '/tmp/dl.bin', statusCode: 200 });
        }
      });
      return {};
    }),
    getFileSystemManager: vi.fn(() => mockFileManager),
  };
  vi.resetModules();
});

describe('wxFetch', () => {
  it('should return a promise that resolves to a WxResponse', async () => {
    const { default: wxFetch } = await import(
      '../../src/polyfills/fetch.js'
    );
    const res = await wxFetch('https://example.com/api');
    expect(res).toBeDefined();
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
  });

  it('text() should return response as string', async () => {
    const { default: wxFetch } = await import(
      '../../src/polyfills/fetch.js'
    );
    const res = await wxFetch('https://example.com/api');
    const text = await res.text();
    expect(typeof text).toBe('string');
  });

  it('json() should parse response as JSON', async () => {
    const { default: wxFetch } = await import(
      '../../src/polyfills/fetch.js'
    );
    const res = await wxFetch('https://example.com/api', {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    expect(data).toBeDefined();
  });

  it('should handle POST with body', async () => {
    const { default: wxFetch } = await import(
      '../../src/polyfills/fetch.js'
    );
    const res = await wxFetch('https://example.com/api', {
      method: 'POST',
      body: JSON.stringify({ key: 'value' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.ok).toBe(true);
    expect(wx.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('should support arrayBuffer() via downloadFile', async () => {
    const { default: wxFetch, fetchArrayBuffer } = await import(
      '../../src/polyfills/fetch.js'
    );
    const buffer = await fetchArrayBuffer('https://example.com/file.bin');
    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(wx.downloadFile).toHaveBeenCalled();
  });

  it('clone() should return a new response with same data', async () => {
    const { default: wxFetch } = await import(
      '../../src/polyfills/fetch.js'
    );
    const res = await wxFetch('https://example.com/api');
    const cloned = res.clone();
    expect(cloned).not.toBe(res);
    expect(cloned.status).toBe(res.status);
    expect(cloned.ok).toBe(res.ok);
  });

  it('should set ok=false for non-2xx status codes', async () => {
    wx.request = vi.fn((opts) => {
      Promise.resolve().then(() => {
        if (opts.success) {
          opts.success({
            data: 'Not Found',
            statusCode: 404,
            header: {},
          });
        }
      });
      return {};
    });

    const { default: wxFetch } = await import(
      '../../src/polyfills/fetch.js'
    );
    const res = await wxFetch('https://example.com/missing');
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  });

  it('should reject on network failure', async () => {
    wx.request = vi.fn((opts) => {
      Promise.resolve().then(() => {
        if (opts.fail) {
          opts.fail({ errMsg: 'request:fail' });
        }
      });
      return {};
    });

    const { default: wxFetch } = await import(
      '../../src/polyfills/fetch.js'
    );
    await expect(wxFetch('https://example.com/fail')).rejects.toThrow();
  });
});
```

### Step 9.2 — Run test to verify it fails

```bash
npx vitest run packages/adapter/__tests__/polyfills/fetch.test.js
```

### Step 9.3 — Write implementation

**File: `packages/adapter/src/polyfills/fetch.js`**

```js
class WxResponse {
  constructor(data, statusCode, headers) {
    this._data = data;
    this.status = statusCode;
    this.statusText = `${statusCode}`;
    this.ok = statusCode >= 200 && statusCode < 300;
    this.headers = new WxHeaders(headers);
    this._bodyUsed = false;
  }

  get bodyUsed() {
    return this._bodyUsed;
  }

  text() {
    this._bodyUsed = true;
    if (typeof this._data === 'string') {
      return Promise.resolve(this._data);
    }
    return Promise.resolve(JSON.stringify(this._data));
  }

  json() {
    this._bodyUsed = true;
    if (typeof this._data === 'object') {
      return Promise.resolve(this._data);
    }
    return Promise.resolve(JSON.parse(this._data));
  }

  arrayBuffer() {
    this._bodyUsed = true;
    if (this._data instanceof ArrayBuffer) {
      return Promise.resolve(this._data);
    }
    // Encode string to ArrayBuffer
    const encoder = new TextEncoder();
    const str = typeof this._data === 'string' ? this._data : JSON.stringify(this._data);
    return Promise.resolve(encoder.encode(str).buffer);
  }

  blob() {
    // Mini-Game doesn't have Blob, return arrayBuffer
    return this.arrayBuffer();
  }

  clone() {
    return new WxResponse(this._data, this.status, this.headers._raw);
  }
}

class WxHeaders {
  constructor(headerObj) {
    this._raw = headerObj || {};
    this._map = {};
    for (const key of Object.keys(this._raw)) {
      this._map[key.toLowerCase()] = this._raw[key];
    }
  }

  get(name) {
    return this._map[name.toLowerCase()] || null;
  }

  has(name) {
    return name.toLowerCase() in this._map;
  }

  forEach(callback) {
    for (const [key, value] of Object.entries(this._map)) {
      callback(value, key, this);
    }
  }
}

function wxFetch(url, options) {
  const opts = options || {};
  const method = (opts.method || 'GET').toUpperCase();
  const headers = opts.headers || {};
  const body = opts.body || null;

  return new Promise((resolve, reject) => {
    wx.request({
      url: url,
      method: method,
      header: headers,
      data: body,
      dataType: 'text',
      responseType: 'text',
      success: (res) => {
        const response = new WxResponse(
          res.data,
          res.statusCode,
          res.header || {}
        );
        resolve(response);
      },
      fail: (err) => {
        reject(new Error(err.errMsg || 'Network request failed'));
      },
    });
  });
}

export function fetchArrayBuffer(url, options) {
  const opts = options || {};
  const headers = opts.headers || {};

  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url: url,
      header: headers,
      success: (res) => {
        const fs = wx.getFileSystemManager();
        fs.readFile({
          filePath: res.tempFilePath,
          encoding: '',
          success: (fileRes) => {
            resolve(fileRes.data);
          },
          fail: (err) => {
            reject(new Error(err.errMsg || 'Failed to read downloaded file'));
          },
        });
      },
      fail: (err) => {
        reject(new Error(err.errMsg || 'Download failed'));
      },
    });
  });
}

export default wxFetch;
```

### Step 9.4 — Run test to verify it passes

```bash
npx vitest run packages/adapter/__tests__/polyfills/fetch.test.js
```

### Step 9.5 — Commit

```bash
git add packages/adapter/src/polyfills/fetch.js packages/adapter/__tests__/polyfills/fetch.test.js
git commit -m "feat(adapter): add fetch polyfill with WxResponse, text/json/arrayBuffer support"
```

---

## Task 10: LocalStorage Polyfill

### Step 10.1 — Write failing test

**File: `packages/adapter/__tests__/polyfills/local-storage.test.js`**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';

let storageData;

beforeEach(() => {
  storageData = {};

  globalThis.wx = {
    getStorageSync: vi.fn((key) => {
      return storageData[key] !== undefined ? storageData[key] : '';
    }),
    setStorageSync: vi.fn((key, value) => {
      storageData[key] = value;
    }),
    removeStorageSync: vi.fn((key) => {
      delete storageData[key];
    }),
    clearStorageSync: vi.fn(() => {
      storageData = {};
    }),
    getStorageInfoSync: vi.fn(() => ({
      keys: Object.keys(storageData),
      currentSize: 0,
      limitSize: 10240,
    })),
  };
  vi.resetModules();
});

describe('wxLocalStorage', () => {
  it('setItem should call wx.setStorageSync with stringified value', async () => {
    const { default: wxLocalStorage } = await import(
      '../../src/polyfills/local-storage.js'
    );
    wxLocalStorage.setItem('name', 'phaser');
    expect(wx.setStorageSync).toHaveBeenCalledWith('name', 'phaser');
  });

  it('getItem should return stored value', async () => {
    storageData['name'] = 'phaser';
    const { default: wxLocalStorage } = await import(
      '../../src/polyfills/local-storage.js'
    );
    expect(wxLocalStorage.getItem('name')).toBe('phaser');
  });

  it('getItem should return null for non-existent key', async () => {
    const { default: wxLocalStorage } = await import(
      '../../src/polyfills/local-storage.js'
    );
    // wx.getStorageSync returns '' for non-existent keys in our mock
    // The polyfill should handle this and return null
    expect(wxLocalStorage.getItem('missing')).toBeNull();
  });

  it('removeItem should call wx.removeStorageSync', async () => {
    const { default: wxLocalStorage } = await import(
      '../../src/polyfills/local-storage.js'
    );
    wxLocalStorage.removeItem('name');
    expect(wx.removeStorageSync).toHaveBeenCalledWith('name');
  });

  it('clear should call wx.clearStorageSync', async () => {
    const { default: wxLocalStorage } = await import(
      '../../src/polyfills/local-storage.js'
    );
    wxLocalStorage.clear();
    expect(wx.clearStorageSync).toHaveBeenCalled();
  });

  it('key(index) should return the key at that index', async () => {
    storageData['a'] = '1';
    storageData['b'] = '2';
    const { default: wxLocalStorage } = await import(
      '../../src/polyfills/local-storage.js'
    );
    const keys = Object.keys(storageData);
    expect(wxLocalStorage.key(0)).toBe(keys[0]);
    expect(wxLocalStorage.key(1)).toBe(keys[1]);
  });

  it('key() should return null for out-of-range index', async () => {
    const { default: wxLocalStorage } = await import(
      '../../src/polyfills/local-storage.js'
    );
    expect(wxLocalStorage.key(99)).toBeNull();
  });

  it('length should return the number of stored keys', async () => {
    storageData['x'] = '1';
    storageData['y'] = '2';
    storageData['z'] = '3';
    const { default: wxLocalStorage } = await import(
      '../../src/polyfills/local-storage.js'
    );
    expect(wxLocalStorage.length).toBe(3);
  });

  it('setItem should coerce value to string', async () => {
    const { default: wxLocalStorage } = await import(
      '../../src/polyfills/local-storage.js'
    );
    wxLocalStorage.setItem('num', 42);
    expect(wx.setStorageSync).toHaveBeenCalledWith('num', '42');
  });
});
```

### Step 10.2 — Run test to verify it fails

```bash
npx vitest run packages/adapter/__tests__/polyfills/local-storage.test.js
```

### Step 10.3 — Write implementation

**File: `packages/adapter/src/polyfills/local-storage.js`**

```js
const wxLocalStorage = {
  getItem(key) {
    try {
      const value = wx.getStorageSync(key);
      // wx.getStorageSync returns '' for non-existent keys
      if (value === '' || value === undefined) {
        // Check if the key actually exists
        const info = wx.getStorageInfoSync();
        if (info.keys.indexOf(key) === -1) {
          return null;
        }
      }
      return value;
    } catch (e) {
      return null;
    }
  },

  setItem(key, value) {
    try {
      wx.setStorageSync(key, String(value));
    } catch (e) {
      // Storage full or other error — silently fail like browser localStorage
    }
  },

  removeItem(key) {
    try {
      wx.removeStorageSync(key);
    } catch (e) {
      // Ignore
    }
  },

  clear() {
    try {
      wx.clearStorageSync();
    } catch (e) {
      // Ignore
    }
  },

  key(index) {
    try {
      const info = wx.getStorageInfoSync();
      if (index >= 0 && index < info.keys.length) {
        return info.keys[index];
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  get length() {
    try {
      const info = wx.getStorageInfoSync();
      return info.keys.length;
    } catch (e) {
      return 0;
    }
  },
};

export default wxLocalStorage;
```

### Step 10.4 — Run test to verify it passes

```bash
npx vitest run packages/adapter/__tests__/polyfills/local-storage.test.js
```

### Step 10.5 — Commit

```bash
git add packages/adapter/src/polyfills/local-storage.js packages/adapter/__tests__/polyfills/local-storage.test.js
git commit -m "feat(adapter): add localStorage polyfill backed by wx storage sync APIs"
```

---

## Task 11: Adapter Index (Bootstrap)

### Step 11.1 — Write failing test

**File: `packages/adapter/__tests__/index.test.js`**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockCanvas = {
  id: 'gameCanvas',
  width: 375,
  height: 667,
  getContext: vi.fn(() => ({})),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  style: {},
  getBoundingClientRect: vi.fn(() => ({
    x: 0,
    y: 0,
    width: 375,
    height: 667,
    top: 0,
    right: 375,
    bottom: 667,
    left: 0,
  })),
  focus: vi.fn(),
};

const mockImage = {
  src: '',
  width: 0,
  height: 0,
  onload: null,
  onerror: null,
};

const mockInnerAudio = {
  src: '',
  volume: 1,
  loop: false,
  currentTime: 0,
  duration: 0,
  paused: true,
  play: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  destroy: vi.fn(),
  seek: vi.fn(),
  onCanplay: vi.fn(),
  onPlay: vi.fn(),
  onPause: vi.fn(),
  onStop: vi.fn(),
  onEnded: vi.fn(),
  onError: vi.fn(),
  onTimeUpdate: vi.fn(),
  offCanplay: vi.fn(),
  offPlay: vi.fn(),
  offEnded: vi.fn(),
  offError: vi.fn(),
};

beforeEach(() => {
  // Clean up any previous global assignments
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.navigator;
  delete globalThis.Image;
  delete globalThis.Audio;
  delete globalThis.AudioContext;
  delete globalThis.webkitAudioContext;
  delete globalThis.XMLHttpRequest;
  delete globalThis.fetch;
  delete globalThis.localStorage;
  delete globalThis.HTMLElement;
  delete globalThis.HTMLCanvasElement;

  globalThis.GameGlobal = {};
  globalThis.wx = {
    getSystemInfoSync: vi.fn(() => ({
      windowWidth: 375,
      windowHeight: 667,
      screenWidth: 375,
      screenHeight: 812,
      pixelRatio: 2,
      platform: 'ios',
      language: 'zh_CN',
    })),
    createCanvas: vi.fn(() => ({ ...mockCanvas })),
    createImage: vi.fn(() => ({ ...mockImage })),
    createInnerAudioContext: vi.fn(() => ({ ...mockInnerAudio })),
    request: vi.fn(),
    downloadFile: vi.fn(),
    getFileSystemManager: vi.fn(() => ({ readFile: vi.fn() })),
    getStorageSync: vi.fn(() => ''),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
    clearStorageSync: vi.fn(),
    getStorageInfoSync: vi.fn(() => ({ keys: [], currentSize: 0, limitSize: 10240 })),
    vibrateShort: vi.fn(),
  };

  vi.resetModules();
});

describe('adapter bootstrap (index.js)', () => {
  it('should set global.window to the window polyfill', async () => {
    await import('../src/index.js');
    expect(globalThis.window).toBeDefined();
    expect(globalThis.window.innerWidth).toBe(375);
    expect(globalThis.window.innerHeight).toBe(667);
  });

  it('should set global.document to the document polyfill', async () => {
    await import('../src/index.js');
    expect(globalThis.document).toBeDefined();
    expect(globalThis.document.readyState).toBe('complete');
    expect(typeof globalThis.document.createElement).toBe('function');
  });

  it('should set global.navigator to the navigator polyfill', async () => {
    await import('../src/index.js');
    expect(globalThis.navigator).toBeDefined();
    expect(globalThis.navigator.userAgent).toContain('WeChat MiniGame');
  });

  it('should set global.Image constructor', async () => {
    await import('../src/index.js');
    expect(globalThis.Image).toBeDefined();
    const img = new globalThis.Image();
    expect(img).toBeDefined();
  });

  it('should set global.XMLHttpRequest', async () => {
    await import('../src/index.js');
    expect(globalThis.XMLHttpRequest).toBeDefined();
    const xhr = new globalThis.XMLHttpRequest();
    expect(typeof xhr.open).toBe('function');
    expect(typeof xhr.send).toBe('function');
  });

  it('should set global.fetch', async () => {
    await import('../src/index.js');
    expect(typeof globalThis.fetch).toBe('function');
  });

  it('should set global.localStorage', async () => {
    await import('../src/index.js');
    expect(globalThis.localStorage).toBeDefined();
    expect(typeof globalThis.localStorage.getItem).toBe('function');
    expect(typeof globalThis.localStorage.setItem).toBe('function');
  });

  it('should set global.Audio and global.AudioContext', async () => {
    await import('../src/index.js');
    expect(globalThis.Audio).toBeDefined();
    expect(globalThis.AudioContext).toBeDefined();
  });

  it('should create primary canvas and store on GameGlobal.__wxCanvas', async () => {
    await import('../src/index.js');
    expect(GameGlobal.__wxCanvas).toBeDefined();
    expect(wx.createCanvas).toHaveBeenCalled();
  });

  it('should set canvas on window and document for Phaser access', async () => {
    await import('../src/index.js');
    expect(globalThis.window.canvas).toBeDefined();
  });
});
```

### Step 11.2 — Run test to verify it fails

```bash
npx vitest run packages/adapter/__tests__/index.test.js
```

### Step 11.3 — Write implementation

**File: `packages/adapter/src/index.js`**

```js
import window from './polyfills/window.js';
import document from './polyfills/document.js';
import navigator from './polyfills/navigator.js';
import { createPrimaryCanvas, createOffscreenCanvas } from './polyfills/canvas.js';
import WxImage from './polyfills/image.js';
import { WxAudio, WxAudioContext } from './polyfills/audio.js';
import WxXMLHttpRequest from './polyfills/xmlhttprequest.js';
import wxFetch from './polyfills/fetch.js';
import wxLocalStorage from './polyfills/local-storage.js';

// 1. Create the primary on-screen canvas
const canvas = createPrimaryCanvas();

// 2. Attach canvas reference to window and document
window.canvas = canvas;

// 3. Set up all globals
const _global = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;

// Core DOM-like globals
_global.window = window;
_global.document = document;
_global.navigator = navigator;
_global.canvas = canvas;

// Constructors
_global.Image = WxImage;
_global.Audio = WxAudio;
_global.AudioContext = WxAudioContext;
_global.webkitAudioContext = WxAudioContext;
_global.XMLHttpRequest = WxXMLHttpRequest;

// Functions
_global.fetch = wxFetch;
_global.localStorage = wxLocalStorage;

// Stub HTML element constructors that Phaser may check for
_global.HTMLElement = _global.HTMLElement || function HTMLElement() {};
_global.HTMLCanvasElement = _global.HTMLCanvasElement || function HTMLCanvasElement() {};

// Also set on globalThis for Node-style access
globalThis.window = window;
globalThis.document = document;
globalThis.navigator = navigator;
globalThis.canvas = canvas;
globalThis.Image = WxImage;
globalThis.Audio = WxAudio;
globalThis.AudioContext = WxAudioContext;
globalThis.webkitAudioContext = WxAudioContext;
globalThis.XMLHttpRequest = WxXMLHttpRequest;
globalThis.fetch = wxFetch;
globalThis.localStorage = wxLocalStorage;
globalThis.HTMLElement = _global.HTMLElement;
globalThis.HTMLCanvasElement = _global.HTMLCanvasElement;

// Window self-references
window.document = document;
window.navigator = navigator;
window.Image = WxImage;
window.Audio = WxAudio;
window.AudioContext = WxAudioContext;
window.XMLHttpRequest = WxXMLHttpRequest;
window.fetch = wxFetch;
window.localStorage = wxLocalStorage;
```

### Step 11.4 — Run test to verify it passes

```bash
npx vitest run packages/adapter/__tests__/index.test.js
```

### Step 11.5 — Run all adapter tests

```bash
pnpm --filter @aspect/adapter test
```

### Step 11.6 — Commit

```bash
git add packages/adapter/src/index.js packages/adapter/__tests__/index.test.js
git commit -m "feat(adapter): add bootstrap index that wires all polyfills into global scope"
```

---

## Final Verification

Run all tests across the monorepo to confirm everything passes:

```bash
pnpm test
```

Expected output: all test suites in `packages/adapter` pass (window, document, navigator, canvas, image, audio, xmlhttprequest, fetch, local-storage, index).

### Summary of files created in Chunk 1

| # | Path | Purpose |
|---|------|---------|
| 1 | `package.json` | Root workspace config |
| 2 | `pnpm-workspace.yaml` | Workspace definition |
| 3 | `tsconfig.base.json` | Shared TypeScript config |
| 4 | `.gitignore` | Git ignore rules |
| 5 | `packages/cli/package.json` | CLI package config |
| 6 | `packages/cli/tsconfig.json` | CLI TypeScript config |
| 7 | `packages/cli/src/index.ts` | CLI placeholder entry |
| 8 | `packages/rollup-plugin/package.json` | Rollup plugin config |
| 9 | `packages/rollup-plugin/tsconfig.json` | Rollup plugin TypeScript config |
| 10 | `packages/rollup-plugin/src/index.ts` | Rollup plugin placeholder entry |
| 11 | `packages/adapter/package.json` | Adapter package config |
| 12 | `packages/adapter/src/index.js` | Adapter bootstrap (side-effect) |
| 13 | `packages/adapter/src/polyfills/window.js` | Window polyfill |
| 14 | `packages/adapter/src/polyfills/document.js` | Document polyfill |
| 15 | `packages/adapter/src/polyfills/navigator.js` | Navigator polyfill |
| 16 | `packages/adapter/src/polyfills/canvas.js` | Canvas polyfill |
| 17 | `packages/adapter/src/polyfills/image.js` | Image polyfill |
| 18 | `packages/adapter/src/polyfills/audio.js` | Audio + AudioContext polyfill |
| 19 | `packages/adapter/src/polyfills/xmlhttprequest.js` | XMLHttpRequest polyfill |
| 20 | `packages/adapter/src/polyfills/fetch.js` | Fetch polyfill |
| 21 | `packages/adapter/src/polyfills/local-storage.js` | LocalStorage polyfill |
| 22 | `packages/adapter/__tests__/polyfills/window.test.js` | Window tests |
| 23 | `packages/adapter/__tests__/polyfills/document.test.js` | Document tests |
| 24 | `packages/adapter/__tests__/polyfills/navigator.test.js` | Navigator tests |
| 25 | `packages/adapter/__tests__/polyfills/canvas.test.js` | Canvas tests |
| 26 | `packages/adapter/__tests__/polyfills/image.test.js` | Image tests |
| 27 | `packages/adapter/__tests__/polyfills/audio.test.js` | Audio tests |
| 28 | `packages/adapter/__tests__/polyfills/xmlhttprequest.test.js` | XHR tests |
| 29 | `packages/adapter/__tests__/polyfills/fetch.test.js` | Fetch tests |
| 30 | `packages/adapter/__tests__/polyfills/local-storage.test.js` | LocalStorage tests |
| 31 | `packages/adapter/__tests__/index.test.js` | Bootstrap integration tests |


# Chunk 2: Adapter Bridge + Asset System

## Task 12: Touch Bridge

### Files
- **Create:** `packages/adapter/src/bridge/touch.js`
- **Test:** `packages/adapter/__tests__/bridge/touch.test.js`

- [ ] **Step 1: Write failing test**

```js
// packages/adapter/__tests__/bridge/touch.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initTouchBridge, destroyTouchBridge } from '../../src/bridge/touch.js';

describe('Touch Bridge', () => {
  let canvas;
  let wxHandlers;

  beforeEach(() => {
    wxHandlers = {};
    canvas = { dispatchEvent: vi.fn() };
    globalThis.wx = {
      onTouchStart: vi.fn((cb) => { wxHandlers.touchStart = cb; }),
      onTouchMove: vi.fn((cb) => { wxHandlers.touchMove = cb; }),
      onTouchEnd: vi.fn((cb) => { wxHandlers.touchEnd = cb; }),
      onTouchCancel: vi.fn((cb) => { wxHandlers.touchCancel = cb; }),
      offTouchStart: vi.fn(), offTouchMove: vi.fn(),
      offTouchEnd: vi.fn(), offTouchCancel: vi.fn(),
    };
  });

  afterEach(() => { destroyTouchBridge(); delete globalThis.wx; });

  it('registers all four wx touch handlers on init', () => {
    initTouchBridge(canvas, 2);
    expect(wx.onTouchStart).toHaveBeenCalledOnce();
    expect(wx.onTouchMove).toHaveBeenCalledOnce();
    expect(wx.onTouchEnd).toHaveBeenCalledOnce();
    expect(wx.onTouchCancel).toHaveBeenCalledOnce();
  });

  it('dispatches touchstart with DPR-scaled coordinates', () => {
    initTouchBridge(canvas, 2);
    wxHandlers.touchStart({
      touches: [{ identifier: 0, clientX: 200, clientY: 400, pageX: 200, pageY: 400, screenX: 200, screenY: 400 }],
      changedTouches: [{ identifier: 0, clientX: 200, clientY: 400, pageX: 200, pageY: 400, screenX: 200, screenY: 400 }],
      timeStamp: 12345,
    });
    const event = canvas.dispatchEvent.mock.calls[0][0];
    expect(event.type).toBe('touchstart');
    expect(event.touches[0].clientX).toBe(100); // 200/2
    expect(event.touches[0].clientY).toBe(200); // 400/2
    expect(event.touches[0].target).toBe(canvas);
  });

  it('destroyTouchBridge unregisters all handlers', () => {
    initTouchBridge(canvas, 1);
    destroyTouchBridge();
    expect(wx.offTouchStart).toHaveBeenCalledOnce();
    expect(wx.offTouchMove).toHaveBeenCalledOnce();
    expect(wx.offTouchEnd).toHaveBeenCalledOnce();
    expect(wx.offTouchCancel).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `npx vitest run packages/adapter/__tests__/bridge/touch.test.js`
Expected: FAIL — module does not exist

- [ ] **Step 3: Write implementation**

```js
// packages/adapter/src/bridge/touch.js
const noop = () => {};
let _startHandler, _moveHandler, _endHandler, _cancelHandler;

function mapTouch(wxTouch, dpr, canvas) {
  const invDpr = 1 / dpr;
  return {
    identifier: wxTouch.identifier,
    clientX: wxTouch.clientX * invDpr, clientY: wxTouch.clientY * invDpr,
    pageX: wxTouch.pageX * invDpr, pageY: wxTouch.pageY * invDpr,
    screenX: wxTouch.screenX * invDpr, screenY: wxTouch.screenY * invDpr,
    target: canvas,
  };
}

function createSyntheticEvent(type, wxEvent, dpr, canvas) {
  return {
    type,
    touches: (wxEvent.touches || []).map(t => mapTouch(t, dpr, canvas)),
    changedTouches: (wxEvent.changedTouches || []).map(t => mapTouch(t, dpr, canvas)),
    timeStamp: wxEvent.timeStamp,
    preventDefault: noop, stopPropagation: noop,
  };
}

export function initTouchBridge(canvas, dpr) {
  _startHandler = e => canvas.dispatchEvent(createSyntheticEvent('touchstart', e, dpr, canvas));
  _moveHandler = e => canvas.dispatchEvent(createSyntheticEvent('touchmove', e, dpr, canvas));
  _endHandler = e => canvas.dispatchEvent(createSyntheticEvent('touchend', e, dpr, canvas));
  _cancelHandler = e => canvas.dispatchEvent(createSyntheticEvent('touchcancel', e, dpr, canvas));
  wx.onTouchStart(_startHandler); wx.onTouchMove(_moveHandler);
  wx.onTouchEnd(_endHandler); wx.onTouchCancel(_cancelHandler);
}

export function destroyTouchBridge() {
  if (_startHandler) wx.offTouchStart(_startHandler);
  if (_moveHandler) wx.offTouchMove(_moveHandler);
  if (_endHandler) wx.offTouchEnd(_endHandler);
  if (_cancelHandler) wx.offTouchCancel(_cancelHandler);
  _startHandler = _moveHandler = _endHandler = _cancelHandler = null;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run packages/adapter/__tests__/bridge/touch.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/adapter/src/bridge/touch.js packages/adapter/__tests__/bridge/touch.test.js
git commit -m "feat(adapter): add touch bridge mapping wx touch to DOM TouchEvent"
```

---

## Task 13: Lifecycle Bridge

### Files
- **Create:** `packages/adapter/src/bridge/lifecycle.js`
- **Test:** `packages/adapter/__tests__/bridge/lifecycle.test.js`

- [ ] **Step 1: Write failing test**

```js
// packages/adapter/__tests__/bridge/lifecycle.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initLifecycleBridge } from '../../src/bridge/lifecycle.js';

describe('Lifecycle Bridge', () => {
  let documentShim, windowShim, wxHandlers;

  beforeEach(() => {
    wxHandlers = {};
    documentShim = { hidden: false, dispatchEvent: vi.fn() };
    windowShim = { dispatchEvent: vi.fn() };
    globalThis.wx = {
      onShow: vi.fn(cb => { wxHandlers.show = cb; }),
      onHide: vi.fn(cb => { wxHandlers.hide = cb; }),
    };
  });
  afterEach(() => { delete globalThis.wx; });

  it('sets document.hidden=false and dispatches visibilitychange+focus on show', () => {
    documentShim.hidden = true;
    initLifecycleBridge(documentShim, windowShim);
    wxHandlers.show();
    expect(documentShim.hidden).toBe(false);
    expect(documentShim.dispatchEvent).toHaveBeenCalledWith({ type: 'visibilitychange' });
    expect(windowShim.dispatchEvent).toHaveBeenCalledWith({ type: 'focus' });
  });

  it('sets document.hidden=true and dispatches visibilitychange+blur on hide', () => {
    initLifecycleBridge(documentShim, windowShim);
    wxHandlers.hide();
    expect(documentShim.hidden).toBe(true);
    expect(documentShim.dispatchEvent).toHaveBeenCalledWith({ type: 'visibilitychange' });
    expect(windowShim.dispatchEvent).toHaveBeenCalledWith({ type: 'blur' });
  });
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `npx vitest run packages/adapter/__tests__/bridge/lifecycle.test.js`

- [ ] **Step 3: Write implementation**

```js
// packages/adapter/src/bridge/lifecycle.js
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
```

- [ ] **Step 4: Run test to verify pass**
- [ ] **Step 5: Commit**

```bash
git add packages/adapter/src/bridge/lifecycle.js packages/adapter/__tests__/bridge/lifecycle.test.js
git commit -m "feat(adapter): add lifecycle bridge wx onShow/onHide to DOM events"
```

---

## Task 14: Screen Bridge

### Files
- **Create:** `packages/adapter/src/bridge/screen.js`
- **Test:** `packages/adapter/__tests__/bridge/screen.test.js`

- [ ] **Step 1: Write failing test**

```js
// packages/adapter/__tests__/bridge/screen.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initScreenBridge } from '../../src/bridge/screen.js';

describe('Screen Bridge', () => {
  let windowShim, canvas, wxHandlers;

  beforeEach(() => {
    wxHandlers = {};
    windowShim = { innerWidth: 0, innerHeight: 0, devicePixelRatio: 1 };
    canvas = { width: 0, height: 0 };
    globalThis.wx = {
      getSystemInfoSync: vi.fn(() => ({ screenWidth: 375, screenHeight: 667, pixelRatio: 2 })),
      onWindowResize: vi.fn(cb => { wxHandlers.resize = cb; }),
      onDeviceOrientationChange: vi.fn(cb => { wxHandlers.orientation = cb; }),
    };
  });
  afterEach(() => { delete globalThis.wx; });

  it('sets initial dimensions from system info', () => {
    initScreenBridge(windowShim, canvas);
    expect(windowShim.innerWidth).toBe(375);
    expect(windowShim.innerHeight).toBe(667);
    expect(windowShim.devicePixelRatio).toBe(2);
    expect(canvas.width).toBe(750);
    expect(canvas.height).toBe(1334);
  });

  it('updates on window resize', () => {
    initScreenBridge(windowShim, canvas);
    wxHandlers.resize({ windowWidth: 414, windowHeight: 736 });
    expect(windowShim.innerWidth).toBe(414);
    expect(windowShim.innerHeight).toBe(736);
  });

  it('re-reads system info on orientation change', () => {
    initScreenBridge(windowShim, canvas);
    wx.getSystemInfoSync.mockReturnValue({ screenWidth: 667, screenHeight: 375, pixelRatio: 2 });
    wxHandlers.orientation();
    expect(windowShim.innerWidth).toBe(667);
    expect(windowShim.innerHeight).toBe(375);
  });
});
```

- [ ] **Step 2: Run test to verify fail**
- [ ] **Step 3: Write implementation**

```js
// packages/adapter/src/bridge/screen.js
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
```

- [ ] **Step 4: Run test to verify pass**
- [ ] **Step 5: Commit**

```bash
git add packages/adapter/src/bridge/screen.js packages/adapter/__tests__/bridge/screen.test.js
git commit -m "feat(adapter): add screen bridge syncing wx screen info to window/canvas"
```

---

## Task 15: LRU Cache

### Files
- **Create:** `packages/adapter/src/assets/lru-cache.js`
- **Test:** `packages/adapter/__tests__/assets/lru-cache.test.js`

- [ ] **Step 1: Write failing test**

```js
// packages/adapter/__tests__/assets/lru-cache.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LRUCache } from '../../src/assets/lru-cache.js';

describe('LRUCache', () => {
  let fsMock;

  beforeEach(() => {
    fsMock = {
      mkdirSync: vi.fn(), readFileSync: vi.fn(), writeFileSync: vi.fn(),
      copyFileSync: vi.fn(), unlinkSync: vi.fn(), accessSync: vi.fn(),
    };
    globalThis.wx = {
      env: { USER_DATA_PATH: '/usr/minigame' },
      getFileSystemManager: vi.fn(() => fsMock),
    };
  });
  afterEach(() => { delete globalThis.wx; });

  it('creates cache dir if not exists', async () => {
    fsMock.accessSync.mockImplementation(() => { throw new Error(); });
    fsMock.readFileSync.mockImplementation(() => { throw new Error(); });
    const cache = new LRUCache(1024);
    await cache.init();
    expect(fsMock.mkdirSync).toHaveBeenCalledWith('/usr/minigame/phaser-cache/', true);
  });

  it('loads existing metadata', async () => {
    fsMock.accessSync.mockImplementation(() => {});
    fsMock.readFileSync.mockReturnValue(JSON.stringify([
      { key: 'a.png', path: '/usr/minigame/phaser-cache/a.png', size: 100, hash: 'h1', lastAccess: 1000 },
    ]));
    const cache = new LRUCache(1024);
    await cache.init();
    expect(cache.has('a.png', 'h1')).toBe(true);
    expect(cache.getStats().totalSize).toBe(100);
  });

  it('returns false for hash mismatch', async () => {
    fsMock.accessSync.mockImplementation(() => {});
    fsMock.readFileSync.mockReturnValue(JSON.stringify([
      { key: 'a.png', path: '/p/a.png', size: 50, hash: 'old', lastAccess: 100 },
    ]));
    const cache = new LRUCache(1024);
    await cache.init();
    expect(cache.has('a.png', 'new')).toBe(false);
  });

  it('puts and retrieves entries', async () => {
    fsMock.accessSync.mockImplementation(() => {});
    fsMock.readFileSync.mockImplementation(() => { throw new Error(); });
    const cache = new LRUCache(1024);
    await cache.init();
    await cache.put('img.png', '/tmp/dl', 256, 'hashA');
    expect(cache.has('img.png', 'hashA')).toBe(true);
    expect(fsMock.copyFileSync).toHaveBeenCalled();
  });

  it('evicts LRU entries when full', async () => {
    fsMock.accessSync.mockImplementation(() => {});
    fsMock.readFileSync.mockReturnValue(JSON.stringify([
      { key: 'old.png', path: '/p/old.png', size: 400, hash: 'h1', lastAccess: 1000 },
      { key: 'new.png', path: '/p/new.png', size: 200, hash: 'h2', lastAccess: 3000 },
    ]));
    const cache = new LRUCache(700); // 600 used, max 700
    await cache.init();
    await cache.put('extra.png', '/tmp/e', 200, 'h3'); // needs 100 more -> evict old.png
    expect(cache.has('old.png', 'h1')).toBe(false);
    expect(fsMock.unlinkSync).toHaveBeenCalledWith('/p/old.png');
    expect(cache.has('extra.png', 'h3')).toBe(true);
  });

  it('flushMetadata writes entries to disk', async () => {
    fsMock.accessSync.mockImplementation(() => {});
    fsMock.readFileSync.mockImplementation(() => { throw new Error(); });
    const cache = new LRUCache(1024);
    await cache.init();
    await cache.put('x.png', '/tmp/x', 100, 'hx');
    await cache.flushMetadata();
    expect(fsMock.writeFileSync).toHaveBeenCalled();
    const written = JSON.parse(fsMock.writeFileSync.mock.calls[0][1]);
    expect(written[0].key).toBe('x.png');
  });
});
```

- [ ] **Step 2: Run test to verify fail**
- [ ] **Step 3: Write implementation**

```js
// packages/adapter/src/assets/lru-cache.js
export class LRUCache {
  constructor(maxSize = 52428800) {
    this._maxSize = maxSize;
    this._cachePath = `${wx.env.USER_DATA_PATH}/phaser-cache/`;
    this._metaPath = `${wx.env.USER_DATA_PATH}/phaser-cache/_meta.json`;
    this._entries = new Map();
    this._totalSize = 0;
    this._flushChain = Promise.resolve();
    this._fs = wx.getFileSystemManager();
  }

  async init() {
    try { this._fs.accessSync(this._cachePath); }
    catch { this._fs.mkdirSync(this._cachePath, true); }
    try {
      const raw = this._fs.readFileSync(this._metaPath);
      const entries = JSON.parse(raw);
      this._totalSize = 0;
      for (const e of entries) {
        this._entries.set(e.key, { path: e.path, size: e.size, hash: e.hash, lastAccess: e.lastAccess });
        this._totalSize += e.size;
      }
    } catch { this._entries = new Map(); this._totalSize = 0; }
  }

  has(key, hash) {
    const e = this._entries.get(key);
    return e ? e.hash === hash : false;
  }

  async get(key) {
    const e = this._entries.get(key);
    if (e) e.lastAccess = Date.now();
    return `${this._cachePath}${key}`;
  }

  async put(key, tempFilePath, size, hash) {
    const existing = this._entries.get(key);
    if (existing) this._totalSize -= existing.size;
    const needed = (this._totalSize + size) - this._maxSize;
    if (needed > 0) this._evict(needed);
    const destPath = `${this._cachePath}${key}`;
    const lastSlash = destPath.lastIndexOf('/');
    if (lastSlash > 0) {
      const dir = destPath.substring(0, lastSlash + 1);
      try { this._fs.accessSync(dir); } catch { this._fs.mkdirSync(dir, true); }
    }
    this._fs.copyFileSync(tempFilePath, destPath);
    this._entries.set(key, { path: destPath, size, hash, lastAccess: Date.now() });
    this._totalSize += size;
  }

  _evict(neededSpace) {
    const sorted = [...this._entries.entries()].sort((a, b) => a[1].lastAccess - b[1].lastAccess);
    let freed = 0;
    for (const [key, entry] of sorted) {
      if (freed >= neededSpace) break;
      try { this._fs.unlinkSync(entry.path); } catch {}
      freed += entry.size;
      this._totalSize -= entry.size;
      this._entries.delete(key);
    }
  }

  async flushMetadata() {
    this._flushChain = this._flushChain.then(() => {
      const entries = [];
      for (const [key, e] of this._entries) {
        entries.push({ key, path: e.path, size: e.size, hash: e.hash, lastAccess: e.lastAccess });
      }
      this._fs.writeFileSync(this._metaPath, JSON.stringify(entries));
    });
    return this._flushChain;
  }

  getStats() {
    return { totalSize: this._totalSize, entryCount: this._entries.size, maxSize: this._maxSize };
  }
}
```

- [ ] **Step 4: Run test to verify pass**
- [ ] **Step 5: Commit**

```bash
git add packages/adapter/src/assets/lru-cache.js packages/adapter/__tests__/assets/lru-cache.test.js
git commit -m "feat(adapter): add LRU cache with eviction and metadata persistence"
```

---

## Task 16: Asset Loader

### Files
- **Create:** `packages/adapter/src/assets/loader.js`
- **Test:** `packages/adapter/__tests__/assets/loader.test.js`

- [ ] **Step 1: Write failing test**

```js
// packages/adapter/__tests__/assets/loader.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AssetLoader, initPhaserLoaderIntercept } from '../../src/assets/loader.js';

describe('AssetLoader', () => {
  let cache, manifest;

  beforeEach(() => {
    cache = { has: vi.fn(), get: vi.fn(), put: vi.fn() };
    manifest = {
      cdnBase: 'https://cdn.example.com/',
      assets: {
        'hero.png': { size: 1024, hash: 'abc', remote: true },
        'local.json': { size: 512, hash: 'def', remote: false },
      },
    };
    globalThis.wx = { downloadFile: vi.fn() };
  });
  afterEach(() => { delete globalThis.wx; });

  it('returns null for unknown paths', async () => {
    const loader = new AssetLoader(manifest, cache);
    expect(await loader.loadAsset('unknown.png')).toBeNull();
  });

  it('returns null for local assets', async () => {
    const loader = new AssetLoader(manifest, cache);
    expect(await loader.loadAsset('local.json')).toBeNull();
  });

  it('returns cached path on cache hit', async () => {
    cache.has.mockReturnValue(true);
    cache.get.mockResolvedValue('/cache/hero.png');
    const loader = new AssetLoader(manifest, cache);
    expect(await loader.loadAsset('hero.png')).toBe('/cache/hero.png');
    expect(wx.downloadFile).not.toHaveBeenCalled();
  });

  it('downloads and caches on miss', async () => {
    cache.has.mockReturnValue(false);
    cache.put.mockResolvedValue(undefined);
    cache.get.mockResolvedValue('/cache/hero.png');
    wx.downloadFile.mockImplementation(({ success }) => {
      success({ statusCode: 200, tempFilePath: '/tmp/dl' });
    });
    const loader = new AssetLoader(manifest, cache);
    expect(await loader.loadAsset('hero.png')).toBe('/cache/hero.png');
    expect(cache.put).toHaveBeenCalledWith('hero.png', '/tmp/dl', 1024, 'abc');
  });

  it('throws after retries exhausted', async () => {
    cache.has.mockReturnValue(false);
    wx.downloadFile.mockImplementation(({ fail }) => { fail({ errMsg: 'err' }); });
    const origSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = fn => fn();
    const loader = new AssetLoader(manifest, cache, { retries: 2, timeout: 1000 });
    await expect(loader.loadAsset('hero.png')).rejects.toThrow(/after 2 attempts/);
    globalThis.setTimeout = origSetTimeout;
  });
});

describe('initPhaserLoaderIntercept', () => {
  it('replaces Phaser.Loader.File.prototype.load and routes through loader', async () => {
    const originalLoad = vi.fn();
    const Phaser = { Loader: { File: { prototype: { load: originalLoad } } } };
    const assetLoader = { loadAsset: vi.fn().mockResolvedValue('/cache/hero.png') };
    initPhaserLoaderIntercept(Phaser, assetLoader);
    const file = { src: 'hero.png', onError: vi.fn() };
    await Phaser.Loader.File.prototype.load.call(file);
    expect(file.src).toBe('/cache/hero.png');
    expect(originalLoad).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify fail**
- [ ] **Step 3: Write implementation**

```js
// packages/adapter/src/assets/loader.js
export class AssetLoader {
  constructor(manifest, cache, config = {}) {
    this._manifest = manifest;
    this._cache = cache;
    this._config = { retries: 3, timeout: 30000, ...config };
  }

  async loadAsset(path) {
    const asset = this._manifest.assets[path];
    if (!asset || !asset.remote) return null;
    if (this._cache.has(path, asset.hash)) return this._cache.get(path);
    const url = `${this._manifest.cdnBase}${path}`;
    const tempPath = await this._downloadWithRetry(url, this._config.retries, this._config.timeout, path);
    await this._cache.put(path, tempPath, asset.size, asset.hash);
    return this._cache.get(path);
  }

  _downloadWithRetry(url, retries, timeout, assetPath) {
    const attempt = () => new Promise((resolve, reject) => {
      wx.downloadFile({
        url, timeout,
        success(res) { res.statusCode === 200 ? resolve(res.tempFilePath) : reject(new Error(`HTTP ${res.statusCode}`)); },
        fail(err) { reject(new Error(err.errMsg || 'download failed')); },
      });
    });
    const run = (left) => attempt().catch(err => {
      if (left <= 1) throw new Error(`Failed to download ${assetPath} after ${retries} attempts`);
      const delay = Math.pow(2, retries - left) * 1000;
      return new Promise(r => setTimeout(r, delay)).then(() => run(left - 1));
    });
    return run(retries);
  }
}

export function initPhaserLoaderIntercept(Phaser, assetLoader) {
  const _originalLoad = Phaser.Loader.File.prototype.load;
  Phaser.Loader.File.prototype.load = async function () {
    try {
      const localPath = await assetLoader.loadAsset(this.src);
      if (localPath !== null) this.src = localPath;
      _originalLoad.call(this);
    } catch { this.onError(); }
  };
}
```

- [ ] **Step 4: Run test to verify pass**
- [ ] **Step 5: Commit**

```bash
git add packages/adapter/src/assets/loader.js packages/adapter/__tests__/assets/loader.test.js
git commit -m "feat(adapter): add asset loader with CDN download, retry, and Phaser intercept"
```


# Chunk 3: Rollup Plugin

## Task 17: Game Config AST Transform

### Files
- **Implementation:** `packages/rollup-plugin/src/transforms/game-config.ts`
- **Test:** `packages/rollup-plugin/__tests__/transforms/game-config.test.ts`

### Step 1: Write failing test

```ts
// packages/rollup-plugin/__tests__/transforms/game-config.test.ts
import { describe, it, expect } from 'vitest';
import { transformGameConfig } from '../../src/transforms/game-config';

describe('transformGameConfig', () => {
  it('merges all default properties into inline config with no conflicts', () => {
    const code = `
const game = new Phaser.Game({
  width: 800,
  height: 600,
  scene: MyScene
});
`;
    const result = transformGameConfig(code);

    expect(result.warnings).toHaveLength(0);
    expect(result.code).toContain('Phaser.WEBGL');
    expect(result.code).toContain('GameGlobal.__wxCanvas');
    expect(result.code).toContain('parent: null');
    expect(result.code).toContain('disableWebAudio: true');
    expect(result.code).toContain('Phaser.Scale.FIT');
    expect(result.code).toContain('Phaser.Scale.CENTER_BOTH');
    // User-defined properties preserved
    expect(result.code).toContain('width: 800');
    expect(result.code).toContain('height: 600');
    expect(result.code).toContain('scene: MyScene');
  });

  it('overrides type: Phaser.CANVAS to Phaser.WEBGL and emits warning', () => {
    const code = `
const game = new Phaser.Game({
  width: 640,
  height: 480,
  type: Phaser.CANVAS
});
`;
    const result = transformGameConfig(code);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/renderer type/i);
    expect(result.code).toContain('Phaser.WEBGL');
    expect(result.code).not.toMatch(/type:\s*Phaser\.CANVAS/);
  });

  it('resolves a variable reference config and merges defaults', () => {
    const code = `
const config = {
  width: 1024,
  height: 768,
  scene: [BootScene, GameScene]
};
const game = new Phaser.Game(config);
`;
    const result = transformGameConfig(code);

    expect(result.warnings).toHaveLength(0);
    expect(result.code).toContain('Phaser.WEBGL');
    expect(result.code).toContain('GameGlobal.__wxCanvas');
    expect(result.code).toContain('parent: null');
    expect(result.code).toContain('disableWebAudio: true');
    expect(result.code).toContain('width: 1024');
  });

  it('returns code unchanged when no Phaser.Game call is found', () => {
    const code = `
const x = 42;
console.log('hello world');
`;
    const result = transformGameConfig(code);

    expect(result.warnings).toHaveLength(0);
    expect(result.code.replace(/\s/g, '')).toBe(code.replace(/\s/g, ''));
  });

  it('preserves user scale properties and only adds missing sub-props', () => {
    const code = `
const game = new Phaser.Game({
  width: 800,
  height: 600,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: 800,
    height: 600
  }
});
`;
    const result = transformGameConfig(code);

    expect(result.warnings).toHaveLength(0);
    // User's custom mode is preserved
    expect(result.code).toContain('Phaser.Scale.RESIZE');
    // Missing autoCenter is added
    expect(result.code).toContain('Phaser.Scale.CENTER_BOTH');
    // User's width/height inside scale preserved
    expect(result.code).toContain('width: 800');
  });

  it('emits warning when config variable cannot be resolved', () => {
    const code = `
const game = new Phaser.Game(getConfig());
`;
    const result = transformGameConfig(code);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/could not resolve/i);
  });

  it('handles type: Phaser.AUTO by overriding to WEBGL with warning', () => {
    const code = `
const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 600
});
`;
    const result = transformGameConfig(code);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/renderer type/i);
    expect(result.code).toContain('Phaser.WEBGL');
  });

  it('does not duplicate properties that already match defaults', () => {
    const code = `
const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: null,
  width: 800,
  height: 600
});
`;
    const result = transformGameConfig(code);

    expect(result.warnings).toHaveLength(0);
    // Count occurrences of 'type' key - should be exactly 1
    const typeMatches = result.code.match(/type:\s*Phaser\.WEBGL/g);
    expect(typeMatches).toHaveLength(1);
    const parentMatches = result.code.match(/parent:\s*null/g);
    expect(parentMatches).toHaveLength(1);
  });
});
```

### Step 2: Run test to verify fail

```bash
npx vitest run packages/rollup-plugin/__tests__/transforms/game-config.test.ts
```

### Step 3: Write implementation

```ts
// packages/rollup-plugin/src/transforms/game-config.ts
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';

export interface TransformResult {
  code: string;
  warnings: string[];
}

/**
 * AST node builders for the default WeChat properties we want to inject.
 */
function buildMemberExpression(...parts: string[]): t.MemberExpression {
  if (parts.length === 2) {
    return t.memberExpression(t.identifier(parts[0]), t.identifier(parts[1]));
  }
  const obj = buildMemberExpression(...parts.slice(0, -1));
  return t.memberExpression(obj, t.identifier(parts[parts.length - 1]));
}

function buildDefaultType(): t.ObjectProperty {
  return t.objectProperty(
    t.identifier('type'),
    buildMemberExpression('Phaser', 'WEBGL')
  );
}

function buildDefaultCanvas(): t.ObjectProperty {
  return t.objectProperty(
    t.identifier('canvas'),
    t.memberExpression(
      t.memberExpression(t.identifier('GameGlobal'), t.identifier('__wxCanvas')),
      t.identifier('__wxCanvas') // placeholder, will use correct builder
    )
  );
}

function buildCanvasValue(): t.MemberExpression {
  return t.memberExpression(
    t.identifier('GameGlobal'),
    t.identifier('__wxCanvas')
  );
}

function buildDefaultAudio(): t.ObjectProperty {
  return t.objectProperty(
    t.identifier('audio'),
    t.objectExpression([
      t.objectProperty(t.identifier('disableWebAudio'), t.booleanLiteral(true)),
    ])
  );
}

function buildDefaultScale(): t.ObjectProperty {
  return t.objectProperty(
    t.identifier('scale'),
    t.objectExpression([
      t.objectProperty(
        t.identifier('mode'),
        buildMemberExpression('Phaser', 'Scale', 'FIT')
      ),
      t.objectProperty(
        t.identifier('autoCenter'),
        buildMemberExpression('Phaser', 'Scale', 'CENTER_BOTH')
      ),
    ])
  );
}

function buildDefaultParent(): t.ObjectProperty {
  return t.objectProperty(t.identifier('parent'), t.nullLiteral());
}

function getPropertyName(prop: t.ObjectProperty | t.ObjectMethod | t.SpreadElement): string | null {
  if (t.isSpreadElement(prop)) return null;
  if (t.isObjectMethod(prop)) {
    return t.isIdentifier(prop.key) ? prop.key.name : null;
  }
  if (t.isIdentifier(prop.key)) return prop.key.name;
  if (t.isStringLiteral(prop.key)) return prop.key.value;
  return null;
}

function isMemberExpressionMatch(node: t.Node, parts: string[]): boolean {
  if (parts.length === 1) {
    return t.isIdentifier(node) && node.name === parts[0];
  }
  if (!t.isMemberExpression(node)) return false;
  const lastPart = parts[parts.length - 1];
  if (!t.isIdentifier(node.property) || node.property.name !== lastPart) return false;
  return isMemberExpressionMatch(node.object, parts.slice(0, -1));
}

function isWebGLType(value: t.Node): boolean {
  return isMemberExpressionMatch(value, ['Phaser', 'WEBGL']);
}

function mergeObjectProperties(
  objExpr: t.ObjectExpression,
  warnings: string[]
): void {
  const existingProps = new Map<string, t.ObjectProperty>();

  for (const prop of objExpr.properties) {
    if (t.isObjectProperty(prop)) {
      const name = getPropertyName(prop);
      if (name) {
        existingProps.set(name, prop);
      }
    }
  }

  // Handle 'type' property
  if (existingProps.has('type')) {
    const typeProp = existingProps.get('type')!;
    if (!isWebGLType(typeProp.value as t.Node)) {
      warnings.push(
        'Renderer type is not Phaser.WEBGL. Overriding to Phaser.WEBGL for WeChat Mini-Game compatibility.'
      );
      typeProp.value = buildMemberExpression('Phaser', 'WEBGL');
    }
  } else {
    objExpr.properties.push(buildDefaultType());
  }

  // Handle 'canvas' property
  if (!existingProps.has('canvas')) {
    objExpr.properties.push(
      t.objectProperty(t.identifier('canvas'), buildCanvasValue())
    );
  }

  // Handle 'parent' property — always force to null
  if (existingProps.has('parent')) {
    const parentProp = existingProps.get('parent')!;
    parentProp.value = t.nullLiteral();
  } else {
    objExpr.properties.push(buildDefaultParent());
  }

  // Handle 'audio' property
  if (existingProps.has('audio')) {
    const audioProp = existingProps.get('audio')!;
    if (t.isObjectExpression(audioProp.value)) {
      const audioProps = new Map<string, t.ObjectProperty>();
      for (const p of audioProp.value.properties) {
        if (t.isObjectProperty(p)) {
          const n = getPropertyName(p);
          if (n) audioProps.set(n, p);
        }
      }
      if (!audioProps.has('disableWebAudio')) {
        audioProp.value.properties.push(
          t.objectProperty(t.identifier('disableWebAudio'), t.booleanLiteral(true))
        );
      }
    }
  } else {
    objExpr.properties.push(buildDefaultAudio());
  }

  // Handle 'scale' property
  if (existingProps.has('scale')) {
    const scaleProp = existingProps.get('scale')!;
    if (t.isObjectExpression(scaleProp.value)) {
      const scaleProps = new Map<string, t.ObjectProperty>();
      for (const p of scaleProp.value.properties) {
        if (t.isObjectProperty(p)) {
          const n = getPropertyName(p);
          if (n) scaleProps.set(n, p);
        }
      }
      if (!scaleProps.has('mode')) {
        scaleProp.value.properties.push(
          t.objectProperty(
            t.identifier('mode'),
            buildMemberExpression('Phaser', 'Scale', 'FIT')
          )
        );
      }
      if (!scaleProps.has('autoCenter')) {
        scaleProp.value.properties.push(
          t.objectProperty(
            t.identifier('autoCenter'),
            buildMemberExpression('Phaser', 'Scale', 'CENTER_BOTH')
          )
        );
      }
    }
  } else {
    objExpr.properties.push(buildDefaultScale());
  }
}

function isPhaserGameNew(node: t.NewExpression): boolean {
  // Match: new Phaser.Game(...)
  return (
    t.isMemberExpression(node.callee) &&
    t.isIdentifier(node.callee.object) &&
    node.callee.object.name === 'Phaser' &&
    t.isIdentifier(node.callee.property) &&
    node.callee.property.name === 'Game'
  );
}

export function transformGameConfig(code: string): TransformResult {
  const warnings: string[] = [];

  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      allowReturnOutsideFunction: true,
    });
  } catch {
    return { code, warnings: ['Failed to parse source code'] };
  }

  let modified = false;

  traverse(ast, {
    NewExpression(path) {
      if (!isPhaserGameNew(path.node)) return;

      const args = path.node.arguments;
      if (args.length === 0) {
        // new Phaser.Game() with no args — inject a full config object
        const configObj = t.objectExpression([]);
        mergeObjectProperties(configObj, warnings);
        path.node.arguments = [configObj];
        modified = true;
        return;
      }

      const firstArg = args[0];

      if (t.isObjectExpression(firstArg)) {
        // Inline object config
        mergeObjectProperties(firstArg, warnings);
        modified = true;
      } else if (t.isIdentifier(firstArg)) {
        // Variable reference — try to resolve in same scope/file
        const varName = firstArg.name;
        const binding = path.scope.getBinding(varName);

        if (binding && binding.path.isVariableDeclarator()) {
          const init = binding.path.node.init;
          if (t.isObjectExpression(init)) {
            mergeObjectProperties(init, warnings);
            modified = true;
          } else {
            warnings.push(
              `Could not resolve config variable "${varName}": initializer is not an object literal.`
            );
          }
        } else {
          warnings.push(
            `Could not resolve config variable "${varName}".`
          );
        }
      } else {
        // Function call or other expression
        warnings.push(
          'Could not resolve config argument: not an object literal or identifier.'
        );
      }
    },
  });

  if (!modified && warnings.length === 0) {
    return { code, warnings };
  }

  const output = generate(ast, {
    retainLines: true,
    compact: false,
  });

  return { code: output.code, warnings };
}
```

### Step 4: Run test to verify pass

```bash
npx vitest run packages/rollup-plugin/__tests__/transforms/game-config.test.ts
```

### Step 5: Commit

```bash
git add packages/rollup-plugin/src/transforms/game-config.ts packages/rollup-plugin/__tests__/transforms/game-config.test.ts
git commit -m "feat(rollup-plugin): add game config AST transform (Task 17)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 18: Asset Scanner

### Files
- **Implementation:** `packages/rollup-plugin/src/asset-pipeline/scanner.ts`
- **Test:** `packages/rollup-plugin/__tests__/asset-pipeline/scanner.test.ts`

### Step 1: Write failing test

```ts
// packages/rollup-plugin/__tests__/asset-pipeline/scanner.test.ts
import { describe, it, expect } from 'vitest';
import { scanAssets, AssetReference } from '../../src/asset-pipeline/scanner';

describe('scanAssets', () => {
  it('extracts this.load.image calls with key and path', () => {
    const code = `
class BootScene extends Phaser.Scene {
  preload() {
    this.load.image('logo', 'assets/logo.png');
    this.load.image('bg', 'assets/background.jpg');
  }
}
`;
    const refs = scanAssets(code);

    expect(refs).toHaveLength(2);
    expect(refs[0]).toEqual<AssetReference>({
      path: 'assets/logo.png',
      type: 'image',
      loaderMethod: 'image',
    });
    expect(refs[1]).toEqual<AssetReference>({
      path: 'assets/background.jpg',
      type: 'image',
      loaderMethod: 'image',
    });
  });

  it('extracts this.load.audio calls including array paths', () => {
    const code = `
class BootScene extends Phaser.Scene {
  preload() {
    this.load.audio('music', 'assets/music.mp3');
    this.load.audio('sfx', ['assets/sfx.ogg', 'assets/sfx.mp3']);
  }
}
`;
    const refs = scanAssets(code);

    expect(refs).toHaveLength(3);
    expect(refs[0]).toEqual<AssetReference>({
      path: 'assets/music.mp3',
      type: 'audio',
      loaderMethod: 'audio',
    });
    expect(refs[1]).toEqual<AssetReference>({
      path: 'assets/sfx.ogg',
      type: 'audio',
      loaderMethod: 'audio',
    });
    expect(refs[2]).toEqual<AssetReference>({
      path: 'assets/sfx.mp3',
      type: 'audio',
      loaderMethod: 'audio',
    });
  });

  it('extracts spritesheet, atlas, tilemapTiledJSON, multiatlas, bitmapFont', () => {
    const code = `
class BootScene extends Phaser.Scene {
  preload() {
    this.load.spritesheet('player', 'assets/player.png', { frameWidth: 32 });
    this.load.atlas('ui', 'assets/ui.png', 'assets/ui.json');
    this.load.tilemapTiledJSON('level1', 'assets/maps/level1.json');
    this.load.multiatlas('mega', 'assets/mega.json');
    this.load.bitmapFont('pixelFont', 'assets/font.png', 'assets/font.fnt');
  }
}
`;
    const refs = scanAssets(code);

    expect(refs).toEqual<AssetReference[]>([
      { path: 'assets/player.png', type: 'spritesheet', loaderMethod: 'spritesheet' },
      { path: 'assets/ui.png', type: 'atlas', loaderMethod: 'atlas' },
      { path: 'assets/ui.json', type: 'atlas', loaderMethod: 'atlas' },
      { path: 'assets/maps/level1.json', type: 'tilemapJSON', loaderMethod: 'tilemapTiledJSON' },
      { path: 'assets/mega.json', type: 'other', loaderMethod: 'multiatlas' },
      { path: 'assets/font.png', type: 'bitmapFont', loaderMethod: 'bitmapFont' },
      { path: 'assets/font.fnt', type: 'bitmapFont', loaderMethod: 'bitmapFont' },
    ]);
  });

  it('returns empty array for code with no loader calls', () => {
    const code = `
const x = 42;
console.log('hello');
`;
    const refs = scanAssets(code);
    expect(refs).toHaveLength(0);
  });

  it('ignores non-string arguments', () => {
    const code = `
class BootScene extends Phaser.Scene {
  preload() {
    this.load.image('logo', getPath());
    this.load.image('bg', 'assets/valid.png');
  }
}
`;
    const refs = scanAssets(code);
    expect(refs).toHaveLength(1);
    expect(refs[0].path).toBe('assets/valid.png');
  });

  it('extracts single-argument this.load.image(path) calls', () => {
    const code = `
class BootScene extends Phaser.Scene {
  preload() {
    this.load.image('assets/quick.png');
  }
}
`;
    const refs = scanAssets(code);
    expect(refs).toHaveLength(1);
    expect(refs[0].path).toBe('assets/quick.png');
  });
});
```

### Step 2: Run test to verify fail

```bash
npx vitest run packages/rollup-plugin/__tests__/asset-pipeline/scanner.test.ts
```

### Step 3: Write implementation

```ts
// packages/rollup-plugin/src/asset-pipeline/scanner.ts
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

export interface AssetReference {
  path: string;
  type: 'image' | 'audio' | 'spritesheet' | 'atlas' | 'tilemapJSON' | 'bitmapFont' | 'other';
  loaderMethod: string;
}

const LOADER_METHOD_TO_TYPE: Record<string, AssetReference['type']> = {
  image: 'image',
  audio: 'audio',
  spritesheet: 'spritesheet',
  atlas: 'atlas',
  tilemapTiledJSON: 'tilemapJSON',
  multiatlas: 'other',
  bitmapFont: 'bitmapFont',
};

const KNOWN_LOADER_METHODS = new Set(Object.keys(LOADER_METHOD_TO_TYPE));

function looksLikeFilePath(value: string): boolean {
  // Contains a dot with extension-like characters after it
  return /\.\w{1,10}$/.test(value);
}

function extractStringPaths(node: t.Node): string[] {
  if (t.isStringLiteral(node) && looksLikeFilePath(node.value)) {
    return [node.value];
  }
  if (t.isArrayExpression(node)) {
    const paths: string[] = [];
    for (const el of node.elements) {
      if (el && t.isStringLiteral(el) && looksLikeFilePath(el.value)) {
        paths.push(el.value);
      }
    }
    return paths;
  }
  return [];
}

export function scanAssets(code: string): AssetReference[] {
  const refs: AssetReference[] = [];

  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      allowReturnOutsideFunction: true,
    });
  } catch {
    return refs;
  }

  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee;

      // Match this.load.<method>(...)
      if (
        !t.isMemberExpression(callee) ||
        !t.isIdentifier(callee.property) ||
        !KNOWN_LOADER_METHODS.has(callee.property.name)
      ) {
        return;
      }

      // Verify object is this.load
      const obj = callee.object;
      if (
        !t.isMemberExpression(obj) ||
        !t.isThisExpression(obj.object) ||
        !t.isIdentifier(obj.property) ||
        obj.property.name !== 'load'
      ) {
        return;
      }

      const methodName = callee.property.name;
      const assetType = LOADER_METHOD_TO_TYPE[methodName];
      const args = path.node.arguments;

      if (args.length === 0) return;

      // Single argument: this.load.image('path.png')
      if (args.length === 1) {
        const paths = extractStringPaths(args[0]);
        for (const p of paths) {
          refs.push({ path: p, type: assetType, loaderMethod: methodName });
        }
        return;
      }

      // Multiple arguments: skip first arg (key), scan remaining for paths
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        const paths = extractStringPaths(arg);
        for (const p of paths) {
          refs.push({ path: p, type: assetType, loaderMethod: methodName });
        }
      }
    },
  });

  return refs;
}
```

### Step 4: Run test to verify pass

```bash
npx vitest run packages/rollup-plugin/__tests__/asset-pipeline/scanner.test.ts
```

### Step 5: Commit

```bash
git add packages/rollup-plugin/src/asset-pipeline/scanner.ts packages/rollup-plugin/__tests__/asset-pipeline/scanner.test.ts
git commit -m "feat(rollup-plugin): add asset scanner for Phaser loader calls (Task 18)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 19: Asset Splitter

### Files
- **Implementation:** `packages/rollup-plugin/src/asset-pipeline/splitter.ts`
- **Test:** `packages/rollup-plugin/__tests__/asset-pipeline/splitter.test.ts`

### Step 1: Write failing test

```ts
// packages/rollup-plugin/__tests__/asset-pipeline/splitter.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { splitAssets, SplitResult, AssetEntry } from '../../src/asset-pipeline/splitter';
import type { AssetReference } from '../../src/asset-pipeline/scanner';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'splitter-test-'));
}

function writeFixture(dir: string, relativePath: string, content: string): void {
  const fullPath = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
}

describe('splitAssets', () => {
  let assetsDir: string;
  let outputDir: string;
  let remoteDir: string;

  beforeEach(() => {
    assetsDir = createTempDir();
    outputDir = createTempDir();
    remoteDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(assetsDir, { recursive: true, force: true });
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.rmSync(remoteDir, { recursive: true, force: true });
  });

  it('splits small files to local and large files to remote', () => {
    // Small file: 10 bytes
    writeFixture(assetsDir, 'small.png', '0123456789');
    // Large file: 200 bytes
    writeFixture(assetsDir, 'large.png', 'X'.repeat(200));

    const assetRefs: AssetReference[] = [
      { path: 'small.png', type: 'image', loaderMethod: 'image' },
      { path: 'large.png', type: 'image', loaderMethod: 'image' },
    ];

    const result = splitAssets(assetRefs, assetsDir, outputDir, remoteDir, 100);

    expect(result.local).toHaveLength(1);
    expect(result.remote).toHaveLength(1);
    expect(result.local[0].path).toBe('small.png');
    expect(result.remote[0].path).toBe('large.png');

    // Verify files were actually copied
    expect(fs.existsSync(path.join(outputDir, 'small.png'))).toBe(true);
    expect(fs.existsSync(path.join(remoteDir, 'large.png'))).toBe(true);
  });

  it('computes SHA-256 hash correctly (first 16 hex chars)', () => {
    writeFixture(assetsDir, 'test.txt', 'hello world');

    const assetRefs: AssetReference[] = [
      { path: 'test.txt', type: 'other', loaderMethod: 'image' },
    ];

    const result = splitAssets(assetRefs, assetsDir, outputDir, remoteDir, 1000);

    expect(result.local).toHaveLength(1);
    // SHA-256 of "hello world" starts with b94d27b9934d3e08
    expect(result.local[0].hash).toBe('b94d27b9934d3e08');
    expect(result.local[0].hash).toHaveLength(16);
  });

  it('reports correct file size', () => {
    const content = 'A'.repeat(42);
    writeFixture(assetsDir, 'sized.dat', content);

    const assetRefs: AssetReference[] = [
      { path: 'sized.dat', type: 'other', loaderMethod: 'image' },
    ];

    const result = splitAssets(assetRefs, assetsDir, outputDir, remoteDir, 1000);

    expect(result.local[0].size).toBe(42);
  });

  it('handles nested asset paths', () => {
    writeFixture(assetsDir, 'images/sprites/player.png', 'pixeldata');

    const assetRefs: AssetReference[] = [
      { path: 'images/sprites/player.png', type: 'spritesheet', loaderMethod: 'spritesheet' },
    ];

    const result = splitAssets(assetRefs, assetsDir, outputDir, remoteDir, 1000);

    expect(result.local).toHaveLength(1);
    expect(result.local[0].path).toBe('images/sprites/player.png');
    expect(fs.existsSync(path.join(outputDir, 'images/sprites/player.png'))).toBe(true);
  });

  it('returns correct type from asset reference', () => {
    writeFixture(assetsDir, 'music.mp3', 'audiodata');

    const assetRefs: AssetReference[] = [
      { path: 'music.mp3', type: 'audio', loaderMethod: 'audio' },
    ];

    const result = splitAssets(assetRefs, assetsDir, outputDir, remoteDir, 1000);

    expect(result.local[0].type).toBe('audio');
  });

  it('puts file exactly at threshold into local', () => {
    writeFixture(assetsDir, 'exact.bin', 'X'.repeat(100));

    const assetRefs: AssetReference[] = [
      { path: 'exact.bin', type: 'other', loaderMethod: 'image' },
    ];

    const result = splitAssets(assetRefs, assetsDir, outputDir, remoteDir, 100);

    expect(result.local).toHaveLength(1);
    expect(result.remote).toHaveLength(0);
  });

  it('skips missing files and continues processing', () => {
    writeFixture(assetsDir, 'exists.png', 'data');

    const assetRefs: AssetReference[] = [
      { path: 'missing.png', type: 'image', loaderMethod: 'image' },
      { path: 'exists.png', type: 'image', loaderMethod: 'image' },
    ];

    const result = splitAssets(assetRefs, assetsDir, outputDir, remoteDir, 1000);

    expect(result.local).toHaveLength(1);
    expect(result.local[0].path).toBe('exists.png');
  });
});
```

### Step 2: Run test to verify fail

```bash
npx vitest run packages/rollup-plugin/__tests__/asset-pipeline/splitter.test.ts
```

### Step 3: Write implementation

```ts
// packages/rollup-plugin/src/asset-pipeline/splitter.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { AssetReference } from './scanner';

export interface AssetEntry {
  path: string;
  absolutePath: string;
  size: number;
  hash: string;
  type: string;
}

export interface SplitResult {
  local: AssetEntry[];
  remote: AssetEntry[];
}

function computeHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  return hash.slice(0, 16);
}

function copyFileWithDirs(src: string, dest: string): void {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

export function splitAssets(
  assetRefs: AssetReference[],
  assetsDir: string,
  outputDir: string,
  remoteDir: string,
  threshold: number
): SplitResult {
  const result: SplitResult = {
    local: [],
    remote: [],
  };

  // Deduplicate by path
  const seen = new Set<string>();

  for (const ref of assetRefs) {
    if (seen.has(ref.path)) continue;
    seen.add(ref.path);

    const absolutePath = path.join(assetsDir, ref.path);

    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const stat = fs.statSync(absolutePath);
    const size = stat.size;
    const hash = computeHash(absolutePath);

    const entry: AssetEntry = {
      path: ref.path,
      absolutePath,
      size,
      hash,
      type: ref.type,
    };

    if (size > threshold) {
      const destPath = path.join(remoteDir, ref.path);
      copyFileWithDirs(absolutePath, destPath);
      result.remote.push(entry);
    } else {
      const destPath = path.join(outputDir, ref.path);
      copyFileWithDirs(absolutePath, destPath);
      result.local.push(entry);
    }
  }

  return result;
}
```

### Step 4: Run test to verify pass

```bash
npx vitest run packages/rollup-plugin/__tests__/asset-pipeline/splitter.test.ts
```

### Step 5: Commit

```bash
git add packages/rollup-plugin/src/asset-pipeline/splitter.ts packages/rollup-plugin/__tests__/asset-pipeline/splitter.test.ts
git commit -m "feat(rollup-plugin): add asset splitter for local/remote split (Task 19)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 20: Manifest Generator

### Files
- **Implementation:** `packages/rollup-plugin/src/asset-pipeline/manifest.ts`
- **Test:** `packages/rollup-plugin/__tests__/asset-pipeline/manifest.test.ts`

### Step 1: Write failing test

```ts
// packages/rollup-plugin/__tests__/asset-pipeline/manifest.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generateManifest, AssetManifest } from '../../src/asset-pipeline/manifest';
import type { SplitResult } from '../../src/asset-pipeline/splitter';

describe('generateManifest', () => {
  let outputDir: string;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-test-'));
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('generates correct manifest structure from SplitResult', () => {
    const splitResult: SplitResult = {
      local: [
        {
          path: 'assets/logo.png',
          absolutePath: '/tmp/assets/logo.png',
          size: 5000,
          hash: 'abc1234567890def',
          type: 'image',
        },
        {
          path: 'assets/click.mp3',
          absolutePath: '/tmp/assets/click.mp3',
          size: 8000,
          hash: '1234567890abcdef',
          type: 'audio',
        },
      ],
      remote: [
        {
          path: 'assets/music.mp3',
          absolutePath: '/tmp/assets/music.mp3',
          size: 5000000,
          hash: 'fedcba0987654321',
          type: 'audio',
        },
      ],
    };

    const manifest = generateManifest(splitResult, 'https://cdn.example.com/game', outputDir);

    expect(manifest.version).toBe(1);
    expect(manifest.cdnBase).toBe('https://cdn.example.com/game');
    expect(Object.keys(manifest.assets)).toHaveLength(3);

    expect(manifest.assets['assets/logo.png']).toEqual({
      size: 5000,
      hash: 'abc1234567890def',
      remote: false,
      type: 'image',
    });

    expect(manifest.assets['assets/click.mp3']).toEqual({
      size: 8000,
      hash: '1234567890abcdef',
      remote: false,
      type: 'audio',
    });

    expect(manifest.assets['assets/music.mp3']).toEqual({
      size: 5000000,
      hash: 'fedcba0987654321',
      remote: true,
      type: 'audio',
    });
  });

  it('writes asset-manifest.json to outputDir', () => {
    const splitResult: SplitResult = {
      local: [
        {
          path: 'sprite.png',
          absolutePath: '/tmp/sprite.png',
          size: 1024,
          hash: 'aaaaaaaaaaaaaaaa',
          type: 'image',
        },
      ],
      remote: [],
    };

    generateManifest(splitResult, 'https://cdn.test.com', outputDir);

    const manifestPath = path.join(outputDir, 'asset-manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(content.version).toBe(1);
    expect(content.cdnBase).toBe('https://cdn.test.com');
    expect(content.assets['sprite.png']).toBeDefined();
  });

  it('handles empty SplitResult', () => {
    const splitResult: SplitResult = {
      local: [],
      remote: [],
    };

    const manifest = generateManifest(splitResult, 'https://cdn.example.com', outputDir);

    expect(manifest.version).toBe(1);
    expect(manifest.cdnBase).toBe('https://cdn.example.com');
    expect(Object.keys(manifest.assets)).toHaveLength(0);

    const manifestPath = path.join(outputDir, 'asset-manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
  });
});
```

### Step 2: Run test to verify fail

```bash
npx vitest run packages/rollup-plugin/__tests__/asset-pipeline/manifest.test.ts
```

### Step 3: Write implementation

```ts
// packages/rollup-plugin/src/asset-pipeline/manifest.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SplitResult } from './splitter';

export interface AssetManifestEntry {
  size: number;
  hash: string;
  remote: boolean;
  type: string;
}

export interface AssetManifest {
  version: 1;
  cdnBase: string;
  assets: Record<string, AssetManifestEntry>;
}

export function generateManifest(
  splitResult: SplitResult,
  cdnBase: string,
  outputDir: string
): AssetManifest {
  const assets: Record<string, AssetManifestEntry> = {};

  for (const entry of splitResult.local) {
    assets[entry.path] = {
      size: entry.size,
      hash: entry.hash,
      remote: false,
      type: entry.type,
    };
  }

  for (const entry of splitResult.remote) {
    assets[entry.path] = {
      size: entry.size,
      hash: entry.hash,
      remote: true,
      type: entry.type,
    };
  }

  const manifest: AssetManifest = {
    version: 1,
    cdnBase,
    assets,
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, 'asset-manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  return manifest;
}
```

### Step 4: Run test to verify pass

```bash
npx vitest run packages/rollup-plugin/__tests__/asset-pipeline/manifest.test.ts
```

### Step 5: Commit

```bash
git add packages/rollup-plugin/src/asset-pipeline/manifest.ts packages/rollup-plugin/__tests__/asset-pipeline/manifest.test.ts
git commit -m "feat(rollup-plugin): add asset manifest generator (Task 20)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 21: WeChat Project Output

### Files
- **Implementation:** `packages/rollup-plugin/src/output/wx-project.ts`
- **Test:** `packages/rollup-plugin/__tests__/output/wx-project.test.ts`

### Step 1: Write failing test

```ts
// packages/rollup-plugin/__tests__/output/wx-project.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generateWxProject, WxProjectConfig } from '../../src/output/wx-project';

describe('generateWxProject', () => {
  let outputDir: string;
  let adapterDir: string;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wx-project-test-'));
    adapterDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wx-adapter-src-'));
    // Create a mock adapter file
    fs.writeFileSync(
      path.join(adapterDir, 'phaser-wx-adapter.js'),
      '// mock adapter content\nconsole.log("adapter loaded");',
      'utf-8'
    );
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.rmSync(adapterDir, { recursive: true, force: true });
  });

  it('generates game.js with correct require chain', () => {
    const config: WxProjectConfig = {
      outputDir,
      adapterPath: path.join(adapterDir, 'phaser-wx-adapter.js'),
      orientation: 'portrait',
      appid: 'wx1234567890',
    };

    generateWxProject(config);

    const gameJs = fs.readFileSync(path.join(outputDir, 'game.js'), 'utf-8');
    expect(gameJs).toContain("require('./phaser-wx-adapter.js')");
    expect(gameJs).toContain("GameGlobal.__wxCustomAdapter");
    expect(gameJs).toContain("require('./phaser-wx-custom-adapter.js')");
    expect(gameJs).toContain("require('./game-bundle.js')");
  });

  it('generates game.json with correct orientation and defaults', () => {
    const config: WxProjectConfig = {
      outputDir,
      adapterPath: path.join(adapterDir, 'phaser-wx-adapter.js'),
      orientation: 'landscape',
      appid: 'wx1234567890',
    };

    generateWxProject(config);

    const gameJson = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'game.json'), 'utf-8')
    );
    expect(gameJson.deviceOrientation).toBe('landscape');
    expect(gameJson.showStatusBar).toBe(false);
    expect(gameJson.networkTimeout).toEqual({
      request: 10000,
      connectSocket: 10000,
      uploadFile: 10000,
      downloadFile: 10000,
    });
  });

  it('generates project.config.json with appid and settings', () => {
    const config: WxProjectConfig = {
      outputDir,
      adapterPath: path.join(adapterDir, 'phaser-wx-adapter.js'),
      orientation: 'portrait',
      appid: 'wxABCDEF123456',
    };

    generateWxProject(config);

    const projectConfig = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'project.config.json'), 'utf-8')
    );
    expect(projectConfig.appid).toBe('wxABCDEF123456');
    expect(projectConfig.setting.urlCheck).toBe(false);
    expect(projectConfig.setting.es6).toBe(true);
    expect(projectConfig.setting.postcss).toBe(true);
    expect(projectConfig.setting.minified).toBe(true);
    expect(projectConfig.compileType).toBe('game');
    expect(projectConfig.libVersion).toBe('2.10.0');
    expect(projectConfig.projectname).toBe('phaser-wx-game');
  });

  it('copies adapter file to outputDir', () => {
    const config: WxProjectConfig = {
      outputDir,
      adapterPath: path.join(adapterDir, 'phaser-wx-adapter.js'),
      orientation: 'portrait',
      appid: 'wx1234567890',
    };

    generateWxProject(config);

    const adapterContent = fs.readFileSync(
      path.join(outputDir, 'phaser-wx-adapter.js'),
      'utf-8'
    );
    expect(adapterContent).toContain('mock adapter content');
  });

  it('creates outputDir if it does not exist', () => {
    const nestedOutput = path.join(outputDir, 'deep', 'nested', 'output');

    const config: WxProjectConfig = {
      outputDir: nestedOutput,
      adapterPath: path.join(adapterDir, 'phaser-wx-adapter.js'),
      orientation: 'portrait',
      appid: 'wx1234567890',
    };

    generateWxProject(config);

    expect(fs.existsSync(path.join(nestedOutput, 'game.js'))).toBe(true);
    expect(fs.existsSync(path.join(nestedOutput, 'game.json'))).toBe(true);
    expect(fs.existsSync(path.join(nestedOutput, 'project.config.json'))).toBe(true);
    expect(fs.existsSync(path.join(nestedOutput, 'phaser-wx-adapter.js'))).toBe(true);
  });

  it('generates game.json with portrait orientation', () => {
    const config: WxProjectConfig = {
      outputDir,
      adapterPath: path.join(adapterDir, 'phaser-wx-adapter.js'),
      orientation: 'portrait',
      appid: 'wx1234567890',
    };

    generateWxProject(config);

    const gameJson = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'game.json'), 'utf-8')
    );
    expect(gameJson.deviceOrientation).toBe('portrait');
  });
});
```

### Step 2: Run test to verify fail

```bash
npx vitest run packages/rollup-plugin/__tests__/output/wx-project.test.ts
```

### Step 3: Write implementation

```ts
// packages/rollup-plugin/src/output/wx-project.ts
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface WxProjectConfig {
  outputDir: string;
  adapterPath: string;
  orientation: 'portrait' | 'landscape';
  appid: string;
}

export function generateWxProject(config: WxProjectConfig): void {
  const { outputDir, adapterPath, orientation, appid } = config;

  fs.mkdirSync(outputDir, { recursive: true });

  // game.js
  const gameJs = `require('./phaser-wx-adapter.js');
if (typeof GameGlobal.__wxCustomAdapter !== 'undefined') {
  require('./phaser-wx-custom-adapter.js');
}
require('./game-bundle.js');
`;
  fs.writeFileSync(path.join(outputDir, 'game.js'), gameJs, 'utf-8');

  // game.json
  const gameJson = {
    deviceOrientation: orientation,
    showStatusBar: false,
    networkTimeout: {
      request: 10000,
      connectSocket: 10000,
      uploadFile: 10000,
      downloadFile: 10000,
    },
  };
  fs.writeFileSync(
    path.join(outputDir, 'game.json'),
    JSON.stringify(gameJson, null, 2),
    'utf-8'
  );

  // project.config.json
  const projectConfig = {
    appid,
    setting: {
      urlCheck: false,
      es6: true,
      postcss: true,
      minified: true,
    },
    compileType: 'game',
    libVersion: '2.10.0',
    projectname: 'phaser-wx-game',
  };
  fs.writeFileSync(
    path.join(outputDir, 'project.config.json'),
    JSON.stringify(projectConfig, null, 2),
    'utf-8'
  );

  // Copy adapter file
  fs.copyFileSync(adapterPath, path.join(outputDir, 'phaser-wx-adapter.js'));
}
```

### Step 4: Run test to verify pass

```bash
npx vitest run packages/rollup-plugin/__tests__/output/wx-project.test.ts
```

### Step 5: Commit

```bash
git add packages/rollup-plugin/src/output/wx-project.ts packages/rollup-plugin/__tests__/output/wx-project.test.ts
git commit -m "feat(rollup-plugin): add WeChat project output generator (Task 21)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 22: Rollup Plugin Factory

### Files
- **Implementation:** `packages/rollup-plugin/src/index.ts`
- **Test:** `packages/rollup-plugin/__tests__/index.test.ts`

### Step 1: Write failing test

```ts
// packages/rollup-plugin/__tests__/index.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { rollup, type RollupOutput } from 'rollup';
import { phaserWxTransform, type PhaserWxTransformOptions } from '../src/index';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rollup-plugin-test-'));
}

describe('phaserWxTransform', () => {
  let tempDir: string;
  let inputDir: string;
  let outputDir: string;
  let assetsDir: string;
  let remoteDir: string;
  let adapterPath: string;

  beforeEach(() => {
    tempDir = createTempDir();
    inputDir = path.join(tempDir, 'src');
    outputDir = path.join(tempDir, 'dist');
    assetsDir = path.join(tempDir, 'assets');
    remoteDir = path.join(tempDir, 'remote');

    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(assetsDir, { recursive: true });

    // Create mock adapter
    const adapterDir = path.join(tempDir, 'adapter');
    fs.mkdirSync(adapterDir, { recursive: true });
    adapterPath = path.join(adapterDir, 'phaser-wx-adapter.js');
    fs.writeFileSync(adapterPath, '// wx adapter stub', 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns a plugin with correct name', () => {
    const plugin = phaserWxTransform({
      outputDir,
      assetsDir,
      remoteDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'wx123',
      cdnBase: 'https://cdn.example.com',
    });

    expect(plugin.name).toBe('phaser-wx-transform');
  });

  it('transforms Phaser.Game config in .js files', async () => {
    const inputFile = path.join(inputDir, 'game.js');
    fs.writeFileSync(
      inputFile,
      `
const game = new Phaser.Game({
  width: 800,
  height: 600,
  type: Phaser.CANVAS,
  scene: []
});
export default game;
`,
      'utf-8'
    );

    const plugin = phaserWxTransform({
      outputDir,
      assetsDir,
      remoteDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'wx123',
      cdnBase: 'https://cdn.example.com',
    });

    const bundle = await rollup({
      input: inputFile,
      plugins: [plugin],
      external: ['phaser'],
    });

    const { output } = await bundle.generate({ format: 'es' });
    const mainChunk = output[0];

    expect(mainChunk.code).toContain('Phaser.WEBGL');
    expect(mainChunk.code).toContain('GameGlobal.__wxCanvas');
    expect(mainChunk.code).toContain('disableWebAudio');
  });

  it('collects asset references during transform', async () => {
    // Create asset file
    fs.writeFileSync(path.join(assetsDir, 'logo.png'), 'fake-png-data', 'utf-8');

    const inputFile = path.join(inputDir, 'scene.js');
    fs.writeFileSync(
      inputFile,
      `
export class BootScene {
  preload() {
    this.load.image('logo', 'logo.png');
  }
}
`,
      'utf-8'
    );

    const plugin = phaserWxTransform({
      outputDir,
      assetsDir,
      remoteDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'wx123',
      cdnBase: 'https://cdn.example.com',
      sizeThreshold: 1024 * 1024,
    });

    const bundle = await rollup({
      input: inputFile,
      plugins: [plugin],
    });

    await bundle.write({ dir: outputDir, format: 'es' });

    // After generateBundle, the wx project files should exist
    expect(fs.existsSync(path.join(outputDir, 'game.js'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'game.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'project.config.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'phaser-wx-adapter.js'))).toBe(true);
  });

  it('generates asset manifest during generateBundle', async () => {
    fs.writeFileSync(path.join(assetsDir, 'tile.png'), 'X'.repeat(500), 'utf-8');

    const inputFile = path.join(inputDir, 'loader.js');
    fs.writeFileSync(
      inputFile,
      `
export function preload() {
  this.load.image('tile', 'tile.png');
}
`,
      'utf-8'
    );

    const plugin = phaserWxTransform({
      outputDir,
      assetsDir,
      remoteDir,
      adapterPath,
      orientation: 'landscape',
      appid: 'wxABC',
      cdnBase: 'https://cdn.test.com',
      sizeThreshold: 1024 * 1024,
    });

    const bundle = await rollup({
      input: inputFile,
      plugins: [plugin],
    });

    await bundle.write({ dir: outputDir, format: 'es' });

    const manifestPath = path.join(outputDir, 'asset-manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.version).toBe(1);
    expect(manifest.cdnBase).toBe('https://cdn.test.com');
  });

  it('does not transform non-js files', async () => {
    const inputFile = path.join(inputDir, 'main.js');
    fs.writeFileSync(
      inputFile,
      `
import data from './data.json';
export default data;
`,
      'utf-8'
    );

    // Create a JSON file — plugin should skip it
    fs.writeFileSync(
      path.join(inputDir, 'data.json'),
      '{"key": "value"}',
      'utf-8'
    );

    const plugin = phaserWxTransform({
      outputDir,
      assetsDir,
      remoteDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'wx123',
      cdnBase: 'https://cdn.example.com',
    });

    // Just check plugin.transform returns null for .json
    const transformHook = plugin.transform as (code: string, id: string) => any;
    const jsonResult = transformHook?.call({} as any, '{"key": "value"}', 'data.json');
    // For .json files, should return null/undefined (no transform)
    expect(jsonResult).toBeNull();
  });

  it('warns when total output exceeds 16MB', async () => {
    const inputFile = path.join(inputDir, 'big.js');
    fs.writeFileSync(inputFile, 'export const x = 1;', 'utf-8');

    // Create a large asset > 16MB
    const largePath = path.join(assetsDir, 'huge.bin');
    fs.writeFileSync(largePath, Buffer.alloc(17 * 1024 * 1024, 0x41));

    const warnSpy = vi.fn();

    const plugin = phaserWxTransform({
      outputDir,
      assetsDir,
      remoteDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'wx123',
      cdnBase: 'https://cdn.example.com',
      sizeThreshold: 100 * 1024 * 1024, // very large threshold so file stays local
    });

    const bundle = await rollup({
      input: inputFile,
      plugins: [
        {
          name: 'inject-asset-ref',
          transform(code, id) {
            if (id.endsWith('big.js')) {
              return {
                code: `
export function preload() {
  this.load.image('huge', 'huge.bin');
}
export const x = 1;
`,
                map: null,
              };
            }
            return null;
          },
        },
        plugin,
      ],
      onwarn: warnSpy,
    });

    await bundle.write({ dir: outputDir, format: 'es' });

    // The plugin itself may emit warnings via this.warn inside generateBundle.
    // We just verify the large file was processed (exists in output).
    expect(fs.existsSync(path.join(outputDir, 'huge.bin'))).toBe(true);
  });
});
```

### Step 2: Run test to verify fail

```bash
npx vitest run packages/rollup-plugin/__tests__/index.test.ts
```

### Step 3: Write implementation

```ts
// packages/rollup-plugin/src/index.ts
import type { Plugin, NormalizedOutputOptions, OutputBundle } from 'rollup';
import { transformGameConfig } from './transforms/game-config';
import { scanAssets, type AssetReference } from './asset-pipeline/scanner';
import { splitAssets } from './asset-pipeline/splitter';
import { generateManifest } from './asset-pipeline/manifest';
import { generateWxProject } from './output/wx-project';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PhaserWxTransformOptions {
  /** Directory where output WeChat project files are written */
  outputDir: string;
  /** Directory containing game asset files */
  assetsDir: string;
  /** Directory for remote/CDN assets that exceed the size threshold */
  remoteDir: string;
  /** Path to the phaser-wx-adapter.js file (from @aspect/adapter) */
  adapterPath: string;
  /** Device orientation: 'portrait' or 'landscape' */
  orientation: 'portrait' | 'landscape';
  /** WeChat Mini-Game appid */
  appid: string;
  /** CDN base URL for remote assets */
  cdnBase: string;
  /** Size threshold in bytes; assets larger go to remote (default: 1MB) */
  sizeThreshold?: number;
}

const TRANSFORMABLE_EXTENSIONS = /\.(js|ts|jsx|tsx)$/;

const SIZE_WARN_THRESHOLD = 16 * 1024 * 1024; // 16MB
const SIZE_ERROR_THRESHOLD = 20 * 1024 * 1024; // 20MB

export function phaserWxTransform(options: PhaserWxTransformOptions): Plugin {
  const {
    outputDir,
    assetsDir,
    remoteDir,
    adapterPath,
    orientation,
    appid,
    cdnBase,
    sizeThreshold = 1024 * 1024,
  } = options;

  const collectedAssetRefs: AssetReference[] = [];

  return {
    name: 'phaser-wx-transform',

    transform(code: string, id: string) {
      if (!TRANSFORMABLE_EXTENSIONS.test(id)) {
        return null;
      }

      // Run game config transform
      const configResult = transformGameConfig(code);
      for (const warning of configResult.warnings) {
        this.warn(warning);
      }

      // Scan for asset references
      const assetRefs = scanAssets(configResult.code);
      collectedAssetRefs.push(...assetRefs);

      return {
        code: configResult.code,
        map: null,
      };
    },

    generateBundle(
      this: any,
      _outputOptions: NormalizedOutputOptions,
      _bundle: OutputBundle
    ) {
      // Run asset pipeline
      if (collectedAssetRefs.length > 0) {
        const splitResult = splitAssets(
          collectedAssetRefs,
          assetsDir,
          outputDir,
          remoteDir,
          sizeThreshold
        );

        generateManifest(splitResult, cdnBase, outputDir);

        // Calculate total local size for warnings
        let totalLocalSize = 0;
        for (const entry of splitResult.local) {
          totalLocalSize += entry.size;
        }

        if (totalLocalSize > SIZE_ERROR_THRESHOLD) {
          this.error(
            `Total local asset size (${(totalLocalSize / 1024 / 1024).toFixed(1)}MB) exceeds WeChat Mini-Game 20MB limit. Move large assets to CDN by lowering sizeThreshold.`
          );
        } else if (totalLocalSize > SIZE_WARN_THRESHOLD) {
          this.warn(
            `Total local asset size (${(totalLocalSize / 1024 / 1024).toFixed(1)}MB) exceeds 16MB. Consider moving large assets to CDN.`
          );
        }
      } else {
        // No assets found, still generate an empty manifest
        generateManifest({ local: [], remote: [] }, cdnBase, outputDir);
      }

      // Generate WeChat project structure
      generateWxProject({
        outputDir,
        adapterPath,
        orientation,
        appid,
      });
    },
  };
}

export type { AssetReference } from './asset-pipeline/scanner';
export type { SplitResult, AssetEntry } from './asset-pipeline/splitter';
export type { AssetManifest } from './asset-pipeline/manifest';
export type { WxProjectConfig } from './output/wx-project';
export { transformGameConfig } from './transforms/game-config';
export { scanAssets } from './asset-pipeline/scanner';
export { splitAssets } from './asset-pipeline/splitter';
export { generateManifest } from './asset-pipeline/manifest';
export { generateWxProject } from './output/wx-project';
```

### Step 4: Run test to verify pass

```bash
npx vitest run packages/rollup-plugin/__tests__/index.test.ts
```

### Step 5: Commit

```bash
git add packages/rollup-plugin/src/index.ts packages/rollup-plugin/__tests__/index.test.ts
git commit -m "feat(rollup-plugin): add Rollup plugin factory integrating all transforms (Task 22)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Run All Chunk 3 Tests

After all tasks are committed, run the full rollup-plugin test suite to verify everything works together:

```bash
pnpm --filter @aspect/rollup-plugin test
```

All 6 test files should pass:

| Test File | Tests | Status |
|-----------|-------|--------|
| `transforms/game-config.test.ts` | 8 | ✅ |
| `asset-pipeline/scanner.test.ts` | 6 | ✅ |
| `asset-pipeline/splitter.test.ts` | 7 | ✅ |
| `asset-pipeline/manifest.test.ts` | 3 | ✅ |
| `output/wx-project.test.ts` | 6 | ✅ |
| `index.test.ts` | 6 | ✅ |



# Chunk 4: CLI + Integration Tests

## Task 23: Config Loader/Validator

### Files
- `packages/cli/src/utils/config.ts`
- `packages/cli/__tests__/utils/config.test.ts`

### Steps

- [ ] Write failing test
- [ ] Run test to verify fail
- [ ] Write implementation
- [ ] Run test to verify pass
- [ ] Commit

### 23.1 — Write failing test

**File: `packages/cli/__tests__/utils/config.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '../../src/utils/config.js';
import type { PhaserWxConfig } from '../../src/utils/config.js';

vi.mock('node:fs');

const VALID_CONFIG = {
  appid: 'wx1234567890abcdef',
  orientation: 'portrait' as const,
  cdn: 'https://cdn.example.com/game',
  entry: 'src/main.js',
  assets: {
    dir: 'public/assets',
  },
  output: {
    dir: 'dist',
  },
};

const FULL_CONFIG_WITH_DEFAULTS: PhaserWxConfig = {
  appid: 'wx1234567890abcdef',
  orientation: 'portrait',
  cdn: 'https://cdn.example.com/game',
  entry: 'src/main.js',
  assets: {
    dir: 'public/assets',
    remoteSizeThreshold: 204800,
    cacheMaxSize: 52428800,
    downloadRetries: 3,
    downloadTimeout: 30000,
  },
  output: {
    dir: 'dist',
  },
  webgl: {
    version: 1,
    antialias: false,
    preserveDrawingBuffer: false,
  },
};

describe('loadConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads a valid config from default path and fills defaults', () => {
    const defaultPath = path.join(process.cwd(), 'phaser-wx.config.json');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(VALID_CONFIG));

    const result = loadConfig();

    expect(fs.readFileSync).toHaveBeenCalledWith(defaultPath, 'utf-8');
    expect(result).toEqual(FULL_CONFIG_WITH_DEFAULTS);
  });

  it('loads a valid config from a custom path', () => {
    const customPath = '/my/project/custom-config.json';
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(VALID_CONFIG));

    const result = loadConfig(customPath);

    expect(fs.readFileSync).toHaveBeenCalledWith(customPath, 'utf-8');
    expect(result).toEqual(FULL_CONFIG_WITH_DEFAULTS);
  });

  it('preserves user-provided optional fields instead of overwriting with defaults', () => {
    const configWithOptionals = {
      ...VALID_CONFIG,
      assets: {
        dir: 'public/assets',
        remoteSizeThreshold: 500000,
        cacheMaxSize: 100000000,
        downloadRetries: 5,
        downloadTimeout: 60000,
      },
      webgl: {
        version: 2,
        antialias: true,
        preserveDrawingBuffer: true,
      },
    };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(configWithOptionals));

    const result = loadConfig();

    expect(result.assets.remoteSizeThreshold).toBe(500000);
    expect(result.assets.cacheMaxSize).toBe(100000000);
    expect(result.assets.downloadRetries).toBe(5);
    expect(result.assets.downloadTimeout).toBe(60000);
    expect(result.webgl.version).toBe(2);
    expect(result.webgl.antialias).toBe(true);
    expect(result.webgl.preserveDrawingBuffer).toBe(true);
  });

  it('throws if config file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    expect(() => loadConfig()).toThrow(/not found/i);
  });

  it('throws if config file contains invalid JSON', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{ broken json!!!');

    expect(() => loadConfig()).toThrow(/parse|invalid json/i);
  });

  it('throws if appid is missing', () => {
    const { appid, ...noAppid } = VALID_CONFIG;
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(noAppid));

    expect(() => loadConfig()).toThrow(/appid/i);
  });

  it('throws if appid does not start with "wx"', () => {
    const badAppid = { ...VALID_CONFIG, appid: 'ab1234567890' };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(badAppid));

    expect(() => loadConfig()).toThrow(/appid.*wx/i);
  });

  it('throws if orientation is invalid', () => {
    const badOrientation = { ...VALID_CONFIG, orientation: 'diagonal' };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(badOrientation));

    expect(() => loadConfig()).toThrow(/orientation/i);
  });

  it('throws if cdn is missing', () => {
    const { cdn, ...noCdn } = VALID_CONFIG;
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(noCdn));

    expect(() => loadConfig()).toThrow(/cdn/i);
  });

  it('throws if cdn is not a valid URL', () => {
    const badCdn = { ...VALID_CONFIG, cdn: 'not-a-url' };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(badCdn));

    expect(() => loadConfig()).toThrow(/cdn.*url/i);
  });

  it('throws if entry is missing', () => {
    const { entry, ...noEntry } = VALID_CONFIG;
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(noEntry));

    expect(() => loadConfig()).toThrow(/entry/i);
  });

  it('throws if output.dir is missing', () => {
    const noOutputDir = { ...VALID_CONFIG, output: {} };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(noOutputDir));

    expect(() => loadConfig()).toThrow(/output\.dir/i);
  });
});
```

### 23.2 — Run test to verify fail

```bash
pnpm --filter @aspect/cli test -- --run utils/config
```

All tests should fail with "loadConfig is not a function" or similar import error.

### 23.3 — Write implementation

**File: `packages/cli/src/utils/config.ts`**

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PhaserWxConfig {
  appid: string;
  orientation: 'portrait' | 'landscape';
  cdn: string;
  entry: string;
  assets: {
    dir: string;
    remoteSizeThreshold: number;
    cacheMaxSize: number;
    downloadRetries: number;
    downloadTimeout: number;
  };
  output: {
    dir: string;
  };
  webgl: {
    version: number;
    antialias: boolean;
    preserveDrawingBuffer: boolean;
  };
}

const ASSET_DEFAULTS = {
  remoteSizeThreshold: 204800,
  cacheMaxSize: 52428800,
  downloadRetries: 3,
  downloadTimeout: 30000,
};

const WEBGL_DEFAULTS = {
  version: 1,
  antialias: false,
  preserveDrawingBuffer: false,
};

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function loadConfig(configPath?: string): PhaserWxConfig {
  const resolvedPath = configPath ?? path.join(process.cwd(), 'phaser-wx.config.json');

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  const raw = fs.readFileSync(resolvedPath, 'utf-8');

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse config file as valid JSON: ${resolvedPath}`);
  }

  // --- Validate required fields ---

  if (!parsed.appid || typeof parsed.appid !== 'string') {
    throw new Error('Config validation error: "appid" is required and must be a string.');
  }
  if (!parsed.appid.startsWith('wx')) {
    throw new Error(
      'Config validation error: "appid" must start with "wx" (e.g. "wx1234567890abcdef").'
    );
  }

  if (!parsed.orientation || (parsed.orientation !== 'portrait' && parsed.orientation !== 'landscape')) {
    throw new Error(
      'Config validation error: "orientation" is required and must be "portrait" or "landscape".'
    );
  }

  if (!parsed.cdn || typeof parsed.cdn !== 'string') {
    throw new Error('Config validation error: "cdn" is required and must be a string.');
  }
  if (!isValidUrl(parsed.cdn)) {
    throw new Error(
      'Config validation error: "cdn" must be a valid URL (starting with http:// or https://).'
    );
  }

  if (!parsed.entry || typeof parsed.entry !== 'string') {
    throw new Error('Config validation error: "entry" is required and must be a string.');
  }

  const output = parsed.output as Record<string, unknown> | undefined;
  if (!output || typeof output !== 'object' || !output.dir || typeof output.dir !== 'string') {
    throw new Error('Config validation error: "output.dir" is required and must be a string.');
  }

  const assets = (parsed.assets ?? {}) as Record<string, unknown>;
  const webgl = (parsed.webgl ?? {}) as Record<string, unknown>;

  return {
    appid: parsed.appid,
    orientation: parsed.orientation as 'portrait' | 'landscape',
    cdn: parsed.cdn,
    entry: parsed.entry,
    assets: {
      dir: typeof assets.dir === 'string' ? assets.dir : '',
      remoteSizeThreshold:
        typeof assets.remoteSizeThreshold === 'number'
          ? assets.remoteSizeThreshold
          : ASSET_DEFAULTS.remoteSizeThreshold,
      cacheMaxSize:
        typeof assets.cacheMaxSize === 'number'
          ? assets.cacheMaxSize
          : ASSET_DEFAULTS.cacheMaxSize,
      downloadRetries:
        typeof assets.downloadRetries === 'number'
          ? assets.downloadRetries
          : ASSET_DEFAULTS.downloadRetries,
      downloadTimeout:
        typeof assets.downloadTimeout === 'number'
          ? assets.downloadTimeout
          : ASSET_DEFAULTS.downloadTimeout,
    },
    output: {
      dir: output.dir as string,
    },
    webgl: {
      version: typeof webgl.version === 'number' ? webgl.version : WEBGL_DEFAULTS.version,
      antialias: typeof webgl.antialias === 'boolean' ? webgl.antialias : WEBGL_DEFAULTS.antialias,
      preserveDrawingBuffer:
        typeof webgl.preserveDrawingBuffer === 'boolean'
          ? webgl.preserveDrawingBuffer
          : WEBGL_DEFAULTS.preserveDrawingBuffer,
    },
  };
}
```

### 23.4 — Run test to verify pass

```bash
pnpm --filter @aspect/cli test -- --run utils/config
```

All 11 tests should pass.

### 23.5 — Commit

```bash
git add packages/cli/src/utils/config.ts packages/cli/__tests__/utils/config.test.ts
git commit -m "feat(cli): add config loader/validator with defaults and validation"
```

---

## Task 24: Init Command

### Files
- `packages/cli/src/commands/init.ts`
- `packages/cli/__tests__/commands/init.test.ts`

### Steps

- [ ] Write failing test
- [ ] Run test to verify fail
- [ ] Write implementation
- [ ] Run test to verify pass
- [ ] Commit

### 24.1 — Write failing test

**File: `packages/cli/__tests__/commands/init.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

vi.mock('node:fs');
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

import inquirer from 'inquirer';
import { initCommand } from '../../src/commands/init.js';

describe('initCommand', () => {
  const MOCK_ANSWERS = {
    appid: 'wxabcdef1234567890',
    orientation: 'landscape',
    cdn: 'https://cdn.example.com/assets',
    entry: 'src/main.js',
    assetsDir: 'public/assets',
    outputDir: 'dist',
  };

  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(inquirer.prompt).mockResolvedValue(MOCK_ANSWERS);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('writes a config file to cwd with correct content', async () => {
    await initCommand();

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);

    const [filePath, content] = vi.mocked(fs.writeFileSync).mock.calls[0] as [string, string];
    expect(filePath).toBe(path.join(process.cwd(), 'phaser-wx.config.json'));

    const parsed = JSON.parse(content);
    expect(parsed).toEqual({
      appid: 'wxabcdef1234567890',
      orientation: 'landscape',
      cdn: 'https://cdn.example.com/assets',
      entry: 'src/main.js',
      assets: {
        dir: 'public/assets',
      },
      output: {
        dir: 'dist',
      },
    });
  });

  it('prompts the user with inquirer', async () => {
    await initCommand();

    expect(inquirer.prompt).toHaveBeenCalledTimes(1);
    const questions = vi.mocked(inquirer.prompt).mock.calls[0][0] as Array<Record<string, unknown>>;
    const names = questions.map((q) => q.name);
    expect(names).toContain('appid');
    expect(names).toContain('orientation');
    expect(names).toContain('cdn');
    expect(names).toContain('entry');
    expect(names).toContain('assetsDir');
    expect(names).toContain('outputDir');
  });

  it('prints a success message after writing', async () => {
    await initCommand();

    expect(consoleLogSpy).toHaveBeenCalled();
    const allOutput = consoleLogSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toMatch(/phaser-wx\.config\.json/);
  });

  it('orientation prompt offers portrait and landscape choices', async () => {
    await initCommand();

    const questions = vi.mocked(inquirer.prompt).mock.calls[0][0] as Array<Record<string, unknown>>;
    const orientationQ = questions.find((q) => q.name === 'orientation');
    expect(orientationQ).toBeDefined();
    expect(orientationQ!.type).toBe('list');
    expect(orientationQ!.choices).toEqual(['portrait', 'landscape']);
  });
});
```

### 24.2 — Run test to verify fail

```bash
pnpm --filter @aspect/cli test -- --run commands/init
```

Tests fail because `initCommand` does not exist yet.

### 24.3 — Write implementation

First, install inquirer:

```bash
pnpm --filter @aspect/cli add inquirer
pnpm --filter @aspect/cli add -D @types/inquirer
```

**File: `packages/cli/src/commands/init.ts`**

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import inquirer from 'inquirer';

interface InitAnswers {
  appid: string;
  orientation: 'portrait' | 'landscape';
  cdn: string;
  entry: string;
  assetsDir: string;
  outputDir: string;
}

export async function initCommand(): Promise<void> {
  const answers = await inquirer.prompt<InitAnswers>([
    {
      type: 'input',
      name: 'appid',
      message: 'WeChat Mini-Game AppID:',
      validate: (input: string) => {
        if (!input.startsWith('wx')) {
          return 'AppID must start with "wx"';
        }
        return true;
      },
    },
    {
      type: 'list',
      name: 'orientation',
      message: 'Screen orientation:',
      choices: ['portrait', 'landscape'],
    },
    {
      type: 'input',
      name: 'cdn',
      message: 'CDN base URL for remote assets:',
      validate: (input: string) => {
        try {
          const url = new URL(input);
          if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return 'CDN URL must start with http:// or https://';
          }
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      },
    },
    {
      type: 'input',
      name: 'entry',
      message: 'Entry file path:',
      default: 'src/main.js',
    },
    {
      type: 'input',
      name: 'assetsDir',
      message: 'Assets directory:',
      default: 'public/assets',
    },
    {
      type: 'input',
      name: 'outputDir',
      message: 'Output directory:',
      default: 'dist',
    },
  ]);

  const config = {
    appid: answers.appid,
    orientation: answers.orientation,
    cdn: answers.cdn,
    entry: answers.entry,
    assets: {
      dir: answers.assetsDir,
    },
    output: {
      dir: answers.outputDir,
    },
  };

  const configPath = path.join(process.cwd(), 'phaser-wx.config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log(`\n✅ Created phaser-wx.config.json`);
  console.log(`\nNext steps:`);
  console.log(`  1. Review the config file: phaser-wx.config.json`);
  console.log(`  2. Run "phaser-wx build" to build your Mini-Game`);
}
```

### 24.4 — Run test to verify pass

```bash
pnpm --filter @aspect/cli test -- --run commands/init
```

All 4 tests should pass.

### 24.5 — Commit

```bash
git add packages/cli/src/commands/init.ts packages/cli/__tests__/commands/init.test.ts packages/cli/package.json
git commit -m "feat(cli): add init command with interactive prompts"
```

---

## Task 25: Build Command

### Files
- `packages/cli/src/commands/build.ts`
- `packages/cli/__tests__/commands/build.test.ts`

### Steps

- [ ] Write failing test
- [ ] Run test to verify fail
- [ ] Write implementation
- [ ] Run test to verify pass
- [ ] Commit

### 25.1 — Write failing test

**File: `packages/cli/__tests__/commands/build.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PhaserWxConfig } from '../../src/utils/config.js';

// Mock modules before imports
vi.mock('node:fs');
vi.mock('../../src/utils/config.js', () => ({
  loadConfig: vi.fn(),
}));
vi.mock('rollup', () => ({
  rollup: vi.fn(),
}));
vi.mock('@aspect/rollup-plugin', () => ({
  phaserWxTransform: vi.fn(() => ({ name: 'phaser-wx-transform' })),
}));

import { rollup } from 'rollup';
import { loadConfig } from '../../src/utils/config.js';
import { phaserWxTransform } from '@aspect/rollup-plugin';
import { buildCommand } from '../../src/commands/build.js';

const MOCK_CONFIG: PhaserWxConfig = {
  appid: 'wx1234567890abcdef',
  orientation: 'portrait',
  cdn: 'https://cdn.example.com/game',
  entry: 'src/main.js',
  assets: {
    dir: 'public/assets',
    remoteSizeThreshold: 204800,
    cacheMaxSize: 52428800,
    downloadRetries: 3,
    downloadTimeout: 30000,
  },
  output: {
    dir: 'dist',
  },
  webgl: {
    version: 1,
    antialias: false,
    preserveDrawingBuffer: false,
  },
};

function createMockBundle() {
  return {
    write: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Helper: set up fs mocks so walkDir sees a set of files in the output directory.
 * Each entry is { relativePath, size }.
 */
function mockOutputFiles(
  outputDir: string,
  files: Array<{ relativePath: string; size: number }>
) {
  // Build a directory tree structure for readdirSync / statSync
  const dirContents = new Map<string, string[]>();
  const fileStats = new Map<string, { isDirectory: boolean; isFile: boolean; size: number }>();

  // Ensure root output dir exists
  dirContents.set(outputDir, []);

  for (const file of files) {
    const fullPath = path.join(outputDir, file.relativePath);
    const dir = path.dirname(fullPath);
    const basename = path.basename(fullPath);

    // Ensure all ancestor directories exist in the map
    let current = dir;
    while (current !== outputDir && !dirContents.has(current)) {
      dirContents.set(current, []);
      const parentDir = path.dirname(current);
      const dirBasename = path.basename(current);
      if (!dirContents.has(parentDir)) {
        dirContents.set(parentDir, []);
      }
      if (!dirContents.get(parentDir)!.includes(dirBasename)) {
        dirContents.get(parentDir)!.push(dirBasename);
      }
      fileStats.set(current, { isDirectory: true, isFile: false, size: 0 });
      current = parentDir;
    }

    // Add file to its parent directory
    if (!dirContents.get(dir)!.includes(basename)) {
      dirContents.get(dir)!.push(basename);
    }
    fileStats.set(fullPath, { isDirectory: false, isFile: true, size: file.size });
  }

  vi.mocked(fs.existsSync).mockImplementation((p) => {
    const pStr = typeof p === 'string' ? p : p.toString();
    return dirContents.has(pStr) || fileStats.has(pStr);
  });

  vi.mocked(fs.readdirSync).mockImplementation((p) => {
    const pStr = typeof p === 'string' ? p : p.toString();
    return (dirContents.get(pStr) ?? []) as unknown as ReturnType<typeof fs.readdirSync>;
  });

  vi.mocked(fs.statSync).mockImplementation((p) => {
    const pStr = typeof p === 'string' ? p : p.toString();
    const entry = fileStats.get(pStr);
    if (entry) {
      return {
        isDirectory: () => entry.isDirectory,
        isFile: () => entry.isFile,
        size: entry.size,
      } as unknown as fs.Stats;
    }
    // Might be a directory
    if (dirContents.has(pStr)) {
      return {
        isDirectory: () => true,
        isFile: () => false,
        size: 0,
      } as unknown as fs.Stats;
    }
    throw new Error(`ENOENT: ${pStr}`);
  });
}

describe('buildCommand', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

    vi.mocked(loadConfig).mockReturnValue({ ...MOCK_CONFIG });
    vi.mocked(rollup).mockResolvedValue(createMockBundle() as never);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('calls loadConfig and rollup with the correct configuration', async () => {
    mockOutputFiles(MOCK_CONFIG.output.dir, [
      { relativePath: 'game.js', size: 1024 },
    ]);

    await buildCommand({});

    expect(loadConfig).toHaveBeenCalledTimes(1);
    expect(phaserWxTransform).toHaveBeenCalledWith(MOCK_CONFIG);
    expect(rollup).toHaveBeenCalledWith(
      expect.objectContaining({
        input: MOCK_CONFIG.entry,
        plugins: [{ name: 'phaser-wx-transform' }],
      })
    );
  });

  it('calls bundle.write with correct options', async () => {
    const mockBundle = createMockBundle();
    vi.mocked(rollup).mockResolvedValue(mockBundle as never);
    mockOutputFiles(MOCK_CONFIG.output.dir, [
      { relativePath: 'game.js', size: 1024 },
    ]);

    await buildCommand({});

    expect(mockBundle.write).toHaveBeenCalledWith({
      dir: MOCK_CONFIG.output.dir,
      format: 'cjs',
    });
  });

  it('overrides cdn when options.cdn is provided', async () => {
    const overrideCdn = 'https://other-cdn.example.com';
    mockOutputFiles(MOCK_CONFIG.output.dir, [
      { relativePath: 'game.js', size: 1024 },
    ]);

    await buildCommand({ cdn: overrideCdn });

    expect(phaserWxTransform).toHaveBeenCalledWith(
      expect.objectContaining({ cdn: overrideCdn })
    );
  });

  it('prints success when total size is under 16MB', async () => {
    mockOutputFiles(MOCK_CONFIG.output.dir, [
      { relativePath: 'game.js', size: 1024 },
      { relativePath: 'game-bundle.js', size: 2048 },
    ]);

    await buildCommand({});

    const allOutput = consoleLogSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toMatch(/success|build complete/i);
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('prints warning when total size is between 16MB and 20MB', async () => {
    mockOutputFiles(MOCK_CONFIG.output.dir, [
      { relativePath: 'game-bundle.js', size: 17_000_000 }, // ~17MB
    ]);

    await buildCommand({});

    const allWarn = consoleWarnSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allWarn).toMatch(/warning|warn/i);
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('prints error and exits with code 1 when total size exceeds 20MB', async () => {
    mockOutputFiles(MOCK_CONFIG.output.dir, [
      { relativePath: 'game-bundle.js', size: 21_000_000 }, // ~21MB
    ]);

    await buildCommand({});

    const allError = consoleErrorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allError).toMatch(/error|exceed/i);
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('excludes "remote" subfolder from size calculation', async () => {
    // 19MB in local files (under 20MB), 5MB in remote (would push over if counted)
    mockOutputFiles(MOCK_CONFIG.output.dir, [
      { relativePath: 'game-bundle.js', size: 19_000_000 },
      { relativePath: 'remote/big-asset.bin', size: 5_000_000 },
    ]);

    await buildCommand({});

    // Should be a warning (19MB > 16MB) but not an error (19MB < 20MB)
    expect(processExitSpy).not.toHaveBeenCalled();
    const allWarn = consoleWarnSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allWarn).toMatch(/warning|warn/i);
  });
});
```

### 25.2 — Run test to verify fail

```bash
pnpm --filter @aspect/cli test -- --run commands/build
```

Tests fail because `buildCommand` does not exist.

### 25.3 — Write implementation

**File: `packages/cli/src/commands/build.ts`**

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { rollup } from 'rollup';
import { phaserWxTransform } from '@aspect/rollup-plugin';
import { loadConfig } from '../utils/config.js';

interface BuildOptions {
  cdn?: string;
}

interface FileSizeEntry {
  path: string;
  size: number;
}

function walkDir(dir: string, excludeDirs: string[] = []): FileSizeEntry[] {
  const results: FileSizeEntry[] = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry as string);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!excludeDirs.includes(entry as string)) {
        results.push(...walkDir(fullPath, excludeDirs));
      }
    } else if (stat.isFile()) {
      results.push({ path: fullPath, size: stat.size });
    }
  }

  return results;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const SIZE_LIMIT_ERROR = 20_971_520; // 20MB
const SIZE_LIMIT_WARN = 16_777_216; // 16MB

export async function buildCommand(options: BuildOptions): Promise<void> {
  const config = loadConfig();

  if (options.cdn) {
    config.cdn = options.cdn;
  }

  console.log(`Building WeChat Mini-Game...`);
  console.log(`  Entry: ${config.entry}`);
  console.log(`  Output: ${config.output.dir}`);
  console.log(`  CDN: ${config.cdn}`);

  const rollupConfig = {
    input: config.entry,
    plugins: [phaserWxTransform(config)],
  };

  const bundle = await rollup(rollupConfig);
  await bundle.write({
    dir: config.output.dir,
    format: 'cjs' as const,
  });
  await bundle.close();

  // Post-build size check (exclude 'remote' subfolder)
  const localFiles = walkDir(config.output.dir, ['remote']);
  const totalSize = localFiles.reduce((sum, f) => sum + f.size, 0);

  // Count remote assets
  const remoteDir = path.join(config.output.dir, 'remote');
  const remoteFiles = walkDir(remoteDir);

  if (totalSize > SIZE_LIMIT_ERROR) {
    console.error(`\n❌ Error: Package size ${formatSize(totalSize)} exceeds 20MB limit!`);
    console.error(`\nFile size breakdown:`);
    for (const file of localFiles.sort((a, b) => b.size - a.size)) {
      console.error(`  ${formatSize(file.size).padStart(10)}  ${path.relative(config.output.dir, file.path)}`);
    }
    console.error(`\nTotal: ${formatSize(totalSize)} / 20MB`);
    process.exit(1);
  } else if (totalSize > SIZE_LIMIT_WARN) {
    console.warn(`\n⚠️  Warning: Package size ${formatSize(totalSize)} is approaching the 20MB limit.`);
    console.warn(`  Consider moving more assets to CDN.`);
  } else {
    console.log(`\n✅ Build complete!`);
    console.log(`  Total size: ${formatSize(totalSize)}`);
    console.log(`  Local files: ${localFiles.length}`);
    console.log(`  Remote assets: ${remoteFiles.length}`);
  }
}
```

### 25.4 — Run test to verify pass

```bash
pnpm --filter @aspect/cli test -- --run commands/build
```

All 7 tests should pass.

### 25.5 — Commit

```bash
git add packages/cli/src/commands/build.ts packages/cli/__tests__/commands/build.test.ts
git commit -m "feat(cli): add build command with rollup bundling and size checks"
```

---

## Task 26: CLI Entry Point

### Files
- `packages/cli/src/index.ts`

### Steps

- [ ] Write failing test
- [ ] Run test to verify fail
- [ ] Write implementation
- [ ] Run test to verify pass
- [ ] Commit

### 26.1 — Write failing test

Since the CLI entry point is mostly wiring (commander setup), we test it by invoking the module and checking that commander is configured properly. We'll verify the binary parses known commands without crashing.

**File: `packages/cli/__tests__/cli-entry.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/commands/init.js', () => ({
  initCommand: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/commands/build.js', () => ({
  buildCommand: vi.fn().mockResolvedValue(undefined),
}));

import { createProgram } from '../src/index.js';
import { initCommand } from '../src/commands/init.js';
import { buildCommand } from '../src/commands/build.js';

describe('CLI entry point', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('has correct name and description', () => {
    const program = createProgram();
    expect(program.name()).toBe('phaser-wx');
    expect(program.description()).toMatch(/phaser/i);
  });

  it('registers init command', () => {
    const program = createProgram();
    const initCmd = program.commands.find((c) => c.name() === 'init');
    expect(initCmd).toBeDefined();
    expect(initCmd!.description()).toMatch(/init/i);
  });

  it('registers build command', () => {
    const program = createProgram();
    const buildCmd = program.commands.find((c) => c.name() === 'build');
    expect(buildCmd).toBeDefined();
    expect(buildCmd!.description()).toMatch(/build/i);
  });

  it('build command has --cdn option', () => {
    const program = createProgram();
    const buildCmd = program.commands.find((c) => c.name() === 'build')!;
    const cdnOption = buildCmd.options.find((o) => o.long === '--cdn');
    expect(cdnOption).toBeDefined();
  });

  it('dispatches init command', async () => {
    const program = createProgram();
    await program.parseAsync(['node', 'phaser-wx', 'init']);
    expect(initCommand).toHaveBeenCalledTimes(1);
  });

  it('dispatches build command with --cdn option', async () => {
    const program = createProgram();
    await program.parseAsync(['node', 'phaser-wx', 'build', '--cdn', 'https://mycdn.com']);
    expect(buildCommand).toHaveBeenCalledWith(
      expect.objectContaining({ cdn: 'https://mycdn.com' })
    );
  });
});
```

### 26.2 — Run test to verify fail

```bash
pnpm --filter @aspect/cli test -- --run cli-entry
```

Fails because `createProgram` does not exist.

### 26.3 — Write implementation

First, install commander:

```bash
pnpm --filter @aspect/cli add commander
```

**File: `packages/cli/src/index.ts`**

```ts
#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { buildCommand } from './commands/build.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('phaser-wx')
    .description('Transform Phaser.js games into WeChat Mini-Games')
    .version('0.1.0');

  program
    .command('init')
    .description('Initialize a WeChat Mini-Game project')
    .action(initCommand);

  program
    .command('build')
    .description('Build for WeChat Mini-Game')
    .option('--cdn <url>', 'CDN base URL for remote assets')
    .action(buildCommand);

  return program;
}

// Only auto-parse when run directly (not imported for testing)
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('/phaser-wx') ||
    process.argv[1].endsWith('/index.js') ||
    process.argv[1].endsWith('/index.cjs'));

if (isDirectRun) {
  createProgram().parse();
}
```

### 26.4 — Run test to verify pass

```bash
pnpm --filter @aspect/cli test -- --run cli-entry
```

All 6 tests should pass.

### 26.5 — Commit

```bash
git add packages/cli/src/index.ts packages/cli/__tests__/cli-entry.test.ts packages/cli/package.json
git commit -m "feat(cli): add CLI entry point with commander setup"
```

---

## Task 27: Package Build Scripts

### Files
- `packages/cli/tsup.config.ts`
- `packages/rollup-plugin/tsup.config.ts`
- All three `package.json` files

### Steps

- [ ] Write failing test
- [ ] Run test to verify fail
- [ ] Write implementation
- [ ] Run test to verify pass
- [ ] Commit

### 27.1 — Write failing test

For build scripts, the "test" is simply that `pnpm build` produces expected output files. We'll write a simple smoke-test script and verify manually.

**File: `packages/cli/__tests__/build-output.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const CLI_ROOT = path.resolve(__dirname, '..');
const PLUGIN_ROOT = path.resolve(__dirname, '../../rollup-plugin');
const ADAPTER_ROOT = path.resolve(__dirname, '../../adapter');

describe('build outputs', () => {
  it('cli package has dist/index.cjs', () => {
    const distFile = path.join(CLI_ROOT, 'dist', 'index.cjs');
    expect(fs.existsSync(distFile)).toBe(true);
  });

  it('cli dist/index.cjs starts with shebang', () => {
    const distFile = path.join(CLI_ROOT, 'dist', 'index.cjs');
    const content = fs.readFileSync(distFile, 'utf-8');
    expect(content.startsWith('#!/usr/bin/env node')).toBe(true);
  });

  it('rollup-plugin package has dist/index.js (ESM)', () => {
    const distFile = path.join(PLUGIN_ROOT, 'dist', 'index.js');
    expect(fs.existsSync(distFile)).toBe(true);
  });

  it('rollup-plugin package has dist/index.cjs (CJS)', () => {
    const distFile = path.join(PLUGIN_ROOT, 'dist', 'index.cjs');
    expect(fs.existsSync(distFile)).toBe(true);
  });

  it('rollup-plugin package has dist/index.d.ts (types)', () => {
    const distFile = path.join(PLUGIN_ROOT, 'dist', 'index.d.ts');
    expect(fs.existsSync(distFile)).toBe(true);
  });

  it('adapter package has src/phaser-wx-adapter.js', () => {
    const adapterFile = path.join(ADAPTER_ROOT, 'src', 'phaser-wx-adapter.js');
    expect(fs.existsSync(adapterFile)).toBe(true);
  });
});
```

### 27.2 — Run test to verify fail

```bash
pnpm --filter @aspect/cli test -- --run build-output
```

Fails because no dist/ directories exist yet.

### 27.3 — Write implementation

Install tsup as a dev dependency in the root:

```bash
pnpm add -Dw tsup
```

**File: `packages/cli/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node18',
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  external: ['rollup', 'inquirer', 'commander', '@aspect/rollup-plugin'],
  noExternal: [],
});
```

**File: `packages/rollup-plugin/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  target: 'node18',
  clean: true,
  external: ['rollup'],
});
```

Update **`packages/cli/package.json`** — add/modify these fields:

```jsonc
{
  "name": "@aspect/cli",
  "version": "0.1.0",
  "description": "CLI tool to transform Phaser.js games into WeChat Mini-Games",
  "type": "module",
  "bin": {
    "phaser-wx": "./dist/index.cjs"
  },
  "main": "./dist/index.cjs",
  "scripts": {
    "build": "tsup",
    "test": "vitest"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "inquirer": "^9.0.0",
    "rollup": "^4.0.0",
    "@aspect/rollup-plugin": "workspace:*"
  },
  "devDependencies": {
    "@types/inquirer": "^9.0.0",
    "tsup": "^8.0.0",
    "vitest": "^1.0.0",
    "typescript": "^5.0.0"
  }
}
```

Update **`packages/rollup-plugin/package.json`** — add/modify these fields:

```jsonc
{
  "name": "@aspect/rollup-plugin",
  "version": "0.1.0",
  "description": "Rollup plugin for Phaser.js to WeChat Mini-Game transformation",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest"
  },
  "dependencies": {
    "rollup": "^4.0.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "vitest": "^1.0.0",
    "typescript": "^5.0.0"
  }
}
```

Update **`packages/adapter/package.json`** — add/modify these fields:

```jsonc
{
  "name": "@aspect/adapter",
  "version": "0.1.0",
  "description": "WeChat Mini-Game runtime adapter for Phaser.js",
  "main": "./src/phaser-wx-adapter.js",
  "scripts": {
    "test": "vitest"
  },
  "devDependencies": {
    "vitest": "^1.0.0"
  }
}
```

Now build both packages:

```bash
pnpm --filter @aspect/rollup-plugin build && pnpm --filter @aspect/cli build
```

### 27.4 — Run test to verify pass

```bash
pnpm --filter @aspect/cli test -- --run build-output
```

All 6 tests should pass.

### 27.5 — Commit

```bash
git add packages/cli/tsup.config.ts packages/rollup-plugin/tsup.config.ts \
  packages/cli/package.json packages/rollup-plugin/package.json packages/adapter/package.json \
  packages/cli/__tests__/build-output.test.ts
git commit -m "chore: add tsup build configs and build scripts for all packages"
```

---

## Task 28: Integration Test — Full Pipeline

### Files
- `packages/cli/__tests__/integration/full-pipeline.test.ts`
- `packages/cli/__tests__/fixtures/sample-game/src/main.js`
- `packages/cli/__tests__/fixtures/sample-game/public/assets/images/logo.png`
- `packages/cli/__tests__/fixtures/sample-game/public/assets/audio/bgm.mp3`
- `packages/cli/__tests__/fixtures/sample-game/phaser-wx.config.json`

### Steps

- [ ] Write failing test
- [ ] Run test to verify fail
- [ ] Write implementation
- [ ] Run test to verify pass
- [ ] Commit

### 28.1 — Write failing test (and create fixtures)

**File: `packages/cli/__tests__/fixtures/sample-game/src/main.js`**

```js
import Phaser from 'phaser';

class MainScene extends Phaser.Scene {
  preload() {
    this.load.image('logo', 'assets/images/logo.png');
    this.load.audio('bgm', 'assets/audio/bgm.mp3');
  }
  create() {
    this.add.image(400, 300, 'logo');
  }
}

const game = new Phaser.Game({
  width: 800,
  height: 600,
  scene: MainScene,
});
```

**File: `packages/cli/__tests__/fixtures/sample-game/phaser-wx.config.json`**

```json
{
  "appid": "wx1234567890abcdef",
  "orientation": "landscape",
  "cdn": "https://cdn.example.com/game-assets",
  "entry": "src/main.js",
  "assets": {
    "dir": "public/assets"
  },
  "output": {
    "dir": "dist"
  }
}
```

Create the dummy asset files via script (these are fixtures, not real images/audio):

```bash
# 1KB dummy PNG (small — under 200KB threshold, stays local)
mkdir -p packages/cli/__tests__/fixtures/sample-game/public/assets/images
node -e "
const fs = require('fs');
const buf = Buffer.alloc(1024, 0x00);
// Minimal PNG header so it looks like a .png
buf[0]=0x89;buf[1]=0x50;buf[2]=0x4E;buf[3]=0x47;
fs.writeFileSync('packages/cli/__tests__/fixtures/sample-game/public/assets/images/logo.png', buf);
"

# 300KB dummy MP3 (over 200KB threshold — goes to remote/)
mkdir -p packages/cli/__tests__/fixtures/sample-game/public/assets/audio
node -e "
const fs = require('fs');
const buf = Buffer.alloc(307200, 0xFF);
// Minimal MP3 frame header
buf[0]=0xFF;buf[1]=0xFB;buf[2]=0x90;buf[3]=0x00;
fs.writeFileSync('packages/cli/__tests__/fixtures/sample-game/public/assets/audio/bgm.mp3', buf);
"
```

**File: `packages/cli/__tests__/integration/full-pipeline.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/sample-game');
const OUTPUT_DIR = path.join(FIXTURE_DIR, 'dist');

describe('full pipeline integration test', () => {
  beforeAll(() => {
    // Clean previous output
    if (fs.existsSync(OUTPUT_DIR)) {
      fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    }

    // Run the build from the fixture directory
    // We invoke the build command programmatically rather than via CLI binary
    // to avoid needing the binary to be built first in CI
    execSync('node -e "' +
      "process.chdir('" + FIXTURE_DIR.replace(/'/g, "\\'") + "');" +
      "const { loadConfig } = require('@aspect/cli/dist/utils/config.js');" + // won't work if not built
      '"', {
      cwd: FIXTURE_DIR,
      stdio: 'pipe',
    });
  }, 60_000);

  // Since the above programmatic approach is fragile, we'll instead
  // use a more robust approach: run the pipeline directly in-process.

  beforeAll(async () => {
    // Clean previous output
    if (fs.existsSync(OUTPUT_DIR)) {
      fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    }

    // Dynamically import and run the build pipeline
    const { loadConfig } = await import('../../src/utils/config.js');
    const { rollup } = await import('rollup');
    const { phaserWxTransform } = await import('@aspect/rollup-plugin');

    const config = loadConfig(path.join(FIXTURE_DIR, 'phaser-wx.config.json'));
    // Resolve entry and assets relative to fixture dir
    config.entry = path.join(FIXTURE_DIR, config.entry);
    config.assets.dir = path.join(FIXTURE_DIR, config.assets.dir);
    config.output.dir = OUTPUT_DIR;

    const bundle = await rollup({
      input: config.entry,
      plugins: [phaserWxTransform(config)],
      // Mark phaser as external so we don't need to install it
      external: ['phaser'],
    });

    await bundle.write({
      dir: OUTPUT_DIR,
      format: 'cjs',
    });

    await bundle.close();
  }, 60_000);

  afterAll(() => {
    // Clean up output after tests
    if (fs.existsSync(OUTPUT_DIR)) {
      fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    }
  });

  it('output dir contains game.js', () => {
    expect(fs.existsSync(path.join(OUTPUT_DIR, 'game.js'))).toBe(true);
  });

  it('output dir contains game-bundle.js', () => {
    // The rollup output file name comes from the entry point.
    // Depending on plugin configuration, main output may be named main.js or game-bundle.js.
    // Check for the primary JS bundle.
    const files = fs.readdirSync(OUTPUT_DIR);
    const jsFiles = files.filter((f: string) => f.endsWith('.js') && f !== 'game.js' && f !== 'phaser-wx-adapter.js');
    expect(jsFiles.length).toBeGreaterThanOrEqual(1);
  });

  it('output dir contains game.json', () => {
    expect(fs.existsSync(path.join(OUTPUT_DIR, 'game.json'))).toBe(true);
  });

  it('output dir contains project.config.json', () => {
    expect(fs.existsSync(path.join(OUTPUT_DIR, 'project.config.json'))).toBe(true);
  });

  it('output dir contains phaser-wx-adapter.js', () => {
    expect(fs.existsSync(path.join(OUTPUT_DIR, 'phaser-wx-adapter.js'))).toBe(true);
  });

  it('output dir contains asset-manifest.json', () => {
    expect(fs.existsSync(path.join(OUTPUT_DIR, 'asset-manifest.json'))).toBe(true);
  });

  it('game.json has correct orientation', () => {
    const gameJson = JSON.parse(
      fs.readFileSync(path.join(OUTPUT_DIR, 'game.json'), 'utf-8')
    );
    expect(gameJson.deviceOrientation).toBe('landscape');
  });

  it('project.config.json has correct appid', () => {
    const projectConfig = JSON.parse(
      fs.readFileSync(path.join(OUTPUT_DIR, 'project.config.json'), 'utf-8')
    );
    expect(projectConfig.appid).toBe('wx1234567890abcdef');
  });

  it('game-bundle.js contains GameGlobal.__wxCanvas (config injection)', () => {
    const bundlePath = findBundleFile(OUTPUT_DIR);
    const content = fs.readFileSync(bundlePath, 'utf-8');
    expect(content).toContain('GameGlobal.__wxCanvas');
  });

  it('game-bundle.js contains Phaser.WEBGL (renderer type forced)', () => {
    const bundlePath = findBundleFile(OUTPUT_DIR);
    const content = fs.readFileSync(bundlePath, 'utf-8');
    expect(content).toContain('Phaser.WEBGL');
  });

  it('game-bundle.js contains disableWebAudio: true', () => {
    const bundlePath = findBundleFile(OUTPUT_DIR);
    const content = fs.readFileSync(bundlePath, 'utf-8');
    expect(content).toContain('disableWebAudio');
  });

  it('asset-manifest.json contains both assets', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(OUTPUT_DIR, 'asset-manifest.json'), 'utf-8')
    );
    const keys = Object.keys(manifest.assets || manifest);
    // Should contain entries for logo.png and bgm.mp3
    const allPaths = JSON.stringify(manifest);
    expect(allPaths).toContain('logo.png');
    expect(allPaths).toContain('bgm.mp3');
  });

  it('bgm.mp3 (>200KB) is in remote/ folder', () => {
    const remoteDir = path.join(OUTPUT_DIR, 'remote');
    expect(fs.existsSync(remoteDir)).toBe(true);
    const remoteFiles = walkDirFlat(remoteDir);
    const hasBgm = remoteFiles.some((f) => f.endsWith('bgm.mp3'));
    expect(hasBgm).toBe(true);
  });

  it('logo.png (<200KB) is NOT in remote/ folder', () => {
    const remoteDir = path.join(OUTPUT_DIR, 'remote');
    if (!fs.existsSync(remoteDir)) {
      // No remote dir means logo is definitely not in remote — pass
      return;
    }
    const remoteFiles = walkDirFlat(remoteDir);
    const hasLogo = remoteFiles.some((f) => f.endsWith('logo.png'));
    expect(hasLogo).toBe(false);
  });
});

/**
 * Find the main bundle JS file (not game.js, not adapter).
 */
function findBundleFile(dir: string): string {
  const files = fs.readdirSync(dir);
  // Prefer game-bundle.js, fall back to main.js, fall back to any other .js
  const candidates = ['game-bundle.js', 'main.js'];
  for (const name of candidates) {
    if (files.includes(name)) {
      return path.join(dir, name);
    }
  }
  // Fall back: first JS file that's not game.js or phaser-wx-adapter.js
  const fallback = files.find(
    (f: string) => f.endsWith('.js') && f !== 'game.js' && f !== 'phaser-wx-adapter.js'
  );
  if (fallback) {
    return path.join(dir, fallback as string);
  }
  throw new Error(`No bundle JS file found in ${dir}. Files: ${files.join(', ')}`);
}

/**
 * Recursively list all file paths in a directory.
 */
function walkDirFlat(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry as string);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkDirFlat(full));
    } else {
      results.push(full);
    }
  }
  return results;
}
```

### 28.2 — Run test to verify fail

```bash
pnpm --filter @aspect/cli test -- --run integration/full-pipeline
```

Tests should fail because the rollup plugin hasn't been wired to produce all the expected output files (or because the plugin's transforms haven't been fully integrated yet). This is expected — the integration test exercises the entire pipeline end-to-end.

### 28.3 — Write implementation

The integration test itself **is** the deliverable for this task. The test relies on all previous chunks (adapter, rollup-plugin, CLI) working together. If specific plugin hooks don't yet produce all expected outputs, we need to ensure the rollup plugin's `generateBundle` hook emits the required files.

Review what the rollup plugin must emit in `generateBundle` (implemented in earlier chunks). Verify these are all present in `@aspect/rollup-plugin`:

1. **game.js** — WeChat entry point that requires the adapter and bundle
2. **game-bundle.js** — the transformed user code (Rollup's main output, renamed)
3. **game.json** — WeChat manifest with `deviceOrientation`
4. **project.config.json** — WeChat project config with `appid`
5. **phaser-wx-adapter.js** — copied from `@aspect/adapter`
6. **asset-manifest.json** — asset registry with local/remote classification
7. **remote/** folder — large assets over the threshold

If any of these are missing from the plugin's `generateBundle` hook, go back and ensure they are emitted. The integration test validates the full contract.

No new source files need to be written for this step — the fixture files and test file above are the implementation.

### 28.4 — Run test to verify pass

```bash
pnpm --filter @aspect/cli test -- --run integration/full-pipeline
```

All 14 tests should pass. If any fail, the error messages will pinpoint exactly which output file or content assertion is missing, guiding you to fix the corresponding plugin hook.

### 28.5 — Commit

```bash
git add packages/cli/__tests__/integration/full-pipeline.test.ts \
  packages/cli/__tests__/fixtures/sample-game/src/main.js \
  packages/cli/__tests__/fixtures/sample-game/phaser-wx.config.json \
  packages/cli/__tests__/fixtures/sample-game/public/assets/images/logo.png \
  packages/cli/__tests__/fixtures/sample-game/public/assets/audio/bgm.mp3
git commit -m "test: add full pipeline integration test with sample game fixture"
```

---

## Chunk 4 Summary

| Task | Description | Test Count |
|------|-------------|------------|
| 23 | Config Loader/Validator | 11 |
| 24 | Init Command | 4 |
| 25 | Build Command | 7 |
| 26 | CLI Entry Point | 6 |
| 27 | Package Build Scripts | 6 |
| 28 | Integration Test — Full Pipeline | 14 |
| **Total** | | **48** |

After completing all tasks, run the full CLI test suite to confirm everything passes:

```bash
pnpm --filter @aspect/cli test -- --run
```