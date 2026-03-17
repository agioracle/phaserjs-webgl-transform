# minigame-phaserjs-transform-sdk Design Spec

**Date:** 2026-03-17
**Status:** Draft
**Target:** Phaser 3.x → WeChat Mini-Game transformation tool

## Purpose

A build tool and runtime adapter that converts standard Phaser.js WebGL projects into high-performance WeChat Mini-Games. Inspired by the `minigame-tuanjie-transform-sdk` (Unity-to-WeChat adapter) architecture — following its "minimal footprint" philosophy of polyfilling only what the engine needs.

## Constraints

- **Phaser 3.x only** (full 3.0–3.80+ range)
- **WebGL 1.0** context (best WeChat compatibility)
- **pnpm** workspace monorepo
- **Rollup plugin** as the primary build integration (works with Vite)
- WeChat Mini-Game 20MB package limit; 200MB user storage limit

## Architecture

Three packages in a pnpm monorepo:

| Package | Responsibility |
|---|---|
| `@aspect/cli` | CLI entry (`init`, `build --cdn <url>`). Orchestrates the build pipeline. |
| `@aspect/rollup-plugin` | Rollup/Vite plugin. AST transforms (Babel), asset extraction, WeChat project output. |
| `@aspect/adapter` | Runtime bridge. Polyfills DOM/BOM APIs for Phaser in WeChat's environment. Ships as pre-built JS. |

### Project Structure

```
wechat-minigame-phaserjs-webgl-transform/
├── packages/
│   ├── cli/
│   │   ├── src/
│   │   │   ├── index.ts              # CLI entry (commander.js)
│   │   │   ├── commands/
│   │   │   │   ├── init.ts           # Scaffold WeChat project
│   │   │   │   └── build.ts          # Build with --cdn <url>
│   │   │   └── utils/
│   │   │       └── config.ts         # Load/validate phaser-wx.config.json
│   │   └── package.json
│   ├── rollup-plugin/
│   │   ├── src/
│   │   │   ├── index.ts              # Plugin factory
│   │   │   ├── transforms/
│   │   │   │   ├── game-config.ts    # AST: inject canvas/WebGL into Phaser.Game()
│   │   │   │   ├── asset-rewrite.ts  # Rewrite asset URLs to CDN paths
│   │   │   │   └── globals.ts        # Handle window/document references
│   │   │   ├── asset-pipeline/
│   │   │   │   ├── scanner.ts        # Scan for Phaser loader calls
│   │   │   │   ├── manifest.ts       # Generate asset-manifest.json
│   │   │   │   └── splitter.ts       # Split large assets to /remote/
│   │   │   └── output/
│   │   │       └── wx-project.ts     # Emit game.js, game.json, project.config.json
│   │   └── package.json
│   └── adapter/
│       ├── src/
│       │   ├── index.js              # Bootstrap all polyfills
│       │   ├── polyfills/
│       │   │   ├── window.js         # Global window shim
│       │   │   ├── document.js       # document.createElement, body, etc.
│       │   │   ├── canvas.js         # Canvas + WebGL via wx.createCanvas()
│       │   │   ├── image.js          # Image via wx.createImage()
│       │   │   ├── audio.js          # AudioContext + HTMLAudio via InnerAudioContext
│       │   │   ├── xmlhttprequest.js # XHR via wx.request()
│       │   │   └── local-storage.js  # localStorage via wx storage APIs
│       │   ├── bridge/
│       │   │   ├── touch.js          # wx touch → DOM TouchEvent
│       │   │   ├── lifecycle.js      # wx.onShow/onHide → visibilitychange
│       │   │   └── screen.js         # wx.getSystemInfoSync → window dimensions
│       │   └── assets/
│       │       ├── loader.js         # CDN asset loader with manifest
│       │       └── lru-cache.js      # LRU cache via wx.getFileSystemManager()
│       └── package.json
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.base.json
```

## Adapter (Runtime Bridge)

### Design Philosophy

Only polyfill what Phaser 3 actually accesses at runtime. Based on analysis of Phaser 3 source code, the required polyfill surface is:

| Browser API | WeChat Polyfill |
|---|---|
| `window` (global, `innerWidth`, `innerHeight`, `devicePixelRatio`, timers) | Synthetic object reading from `wx.getSystemInfoSync()` |
| `document.createElement('canvas')` | `wx.createCanvas()` — first call = on-screen; subsequent = off-screen |
| `document.createElement('image')` / `new Image()` | `wx.createImage()` |
| `canvas.getContext('webgl')` | Native WeChat WebGL 1.0 context |
| `canvas.getContext('2d')` | Native WeChat 2D context (for off-screen text rendering) |
| `AudioContext` / `new Audio()` | Shim routing to `wx.createInnerAudioContext()` |
| `XMLHttpRequest` | Shim routing to `wx.request()` (text/JSON) and `wx.downloadFile()` (binary) |
| `localStorage` | `wx.setStorageSync()` / `wx.getStorageSync()` |
| `addEventListener('touchstart/move/end', ...)` | `wx.onTouchStart/Move/End` → synthetic DOM `TouchEvent` |
| `requestAnimationFrame` / `cancelAnimationFrame` | `requestAnimationFrame` (exists in WeChat global) |
| `performance.now()` | Available in WeChat global |

### Canvas Polyfill

```
wx.createCanvas() → primary on-screen canvas
  └── getContext('webgl', { antialias: false, preserveDrawingBuffer: false })

wx.createCanvas() (subsequent) → off-screen canvases
  └── Used by Phaser for text rendering, render textures
```

The primary canvas is created once during adapter initialization and exposed as `GameGlobal.__wxCanvas`. All `document.createElement('canvas')` calls after the first return off-screen canvases.

### Touch Event Mapping

WeChat's `wx.onTouchStart/Move/End/Cancel` fire globally. The adapter:

1. Registers global touch handlers during initialization
2. Creates synthetic `TouchEvent` objects matching DOM spec
3. Applies `devicePixelRatio` scaling to `clientX`/`clientY` coordinates
4. Dispatches events on the canvas element's listener registry
5. Provides `touches`, `changedTouches`, `timeStamp` — exactly what Phaser's `InputManager` reads

### Audio Bridge

Two paths matching Phaser's audio strategy:

- **Web Audio path:** Minimal `AudioContext` shim. `decodeAudioData()` delegates to `wx.createInnerAudioContext()`. `createBufferSource()` returns a wrapper that controls an InnerAudioContext instance.
- **HTML5 Audio path:** `Audio` constructor returns an object wrapping `wx.createInnerAudioContext()` with `src`, `play()`, `pause()`, `volume`, and `onended` event support.

### Lifecycle Proxy

```
wx.onShow  → document.hidden = false  → dispatch 'visibilitychange' → Phaser.game.resume()
wx.onHide  → document.hidden = true   → dispatch 'visibilitychange' → Phaser.game.pause()
```

Uses Phaser's built-in Visibility Handler rather than calling game methods directly.

### Screen Fitting

On initialization:
1. Read `wx.getSystemInfoSync()` → `screenWidth`, `screenHeight`, `pixelRatio`
2. Set `window.innerWidth`, `window.innerHeight`, `window.devicePixelRatio`
3. Set canvas dimensions: `canvas.width = screenWidth * pixelRatio`, `canvas.height = screenHeight * pixelRatio`
4. Listen to `wx.onWindowResize` for orientation changes → update window dimensions

Phaser's Scale Manager (FIT/RESIZE modes) reads from `window` and handles the rest.

## AST Transform Engine (Rollup Plugin)

### Transform 1: Game Config Injection

Uses `@babel/parser` + `@babel/traverse` + `@babel/generator` to find `new Phaser.Game(config)` expressions and merge required properties:

**Injected properties:**
```js
{
  type: Phaser.WEBGL,
  canvas: GameGlobal.__wxCanvas,
  parent: null,
  audio: { disableWebAudio: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
}
```

**Rules:**
- Properties are merged, not replaced — user values preserved except `type` (forced to `WEBGL` with warning) and `parent` (forced to `null`)
- Handles both inline object literals and variable references (traces to declaration)
- Supports `new Phaser.Game(config)` and `new Phaser.Game({ ... })` patterns

### Transform 2: Asset URL Rewriting

Scans for Phaser loader method calls:
- `this.load.image()`, `.audio()`, `.spritesheet()`, `.atlas()`, `.tilemapTiledJSON()`
- `this.load.multiatlas()`, `.bitmapFont()`, `.plugin()`, `.script()`

Rewrites string literal URL arguments from local paths to CDN-prefixed paths:
```js
// Before:
this.load.image('hero', 'assets/images/hero.png');
// After:
this.load.image('hero', 'https://cdn.example.com/game/assets/images/hero.png');
```

### Transform 3: WeChat Project Output

After Rollup bundles the game, the plugin emits:

```
dist-wx/
├── game.js              # require('./phaser-wx-adapter.js'); require('./game-bundle.js');
├── game-bundle.js       # Rollup-bundled + transformed Phaser game code
├── game.json            # {"deviceOrientation": "portrait", "showStatusBar": false}
├── project.config.json  # WeChat DevTools config with appid
├── phaser-wx-adapter.js # Adapter copied from @aspect/adapter build output
├── asset-manifest.json  # Asset registry for runtime loader
└── remote/              # Large assets for CDN upload
    ├── images/
    ├── audio/
    └── spritesheets/
```

## Asset Management System

### Build-Time Pipeline

1. **Scanner:** Walks source AST for Phaser loader calls. Collects all referenced asset paths and their types (image, audio, spritesheet, etc.).

2. **Splitter:** Applies size threshold (default 200KB, configurable). Assets above threshold → `dist-wx/remote/` for CDN. Assets below → bundled in package.

3. **Manifest Generator:** Creates `asset-manifest.json`:
```json
{
  "version": 1,
  "cdnBase": "https://cdn.example.com/game/",
  "assets": {
    "assets/images/hero.png": {
      "size": 45000,
      "hash": "a1b2c3d4",
      "remote": true,
      "type": "image"
    },
    "assets/audio/bgm.mp3": {
      "size": 2400000,
      "hash": "e5f6g7h8",
      "remote": true,
      "type": "audio"
    }
  }
}
```

### Runtime Loader

1. **Startup:** Reads `asset-manifest.json`, builds in-memory lookup table.
2. **Intercept:** Overrides Phaser's `Loader.FileTypes` prototypes to route through the custom loader:
   - Check LRU cache (local filesystem) → return cached file if found and hash matches
   - Download from CDN via `wx.downloadFile()` if not cached
   - Store in cache, update LRU metadata
3. **Preloading:** Supports configurable preload list for critical assets.

### LRU Cache

```
${wx.env.USER_DATA_PATH}/phaser-cache/
├── _meta.json    # [{ path, size, hash, lastAccess }] sorted by lastAccess
├── assets/images/hero.png
├── assets/audio/bgm.mp3
└── ...
```

- **Max size:** 50MB (configurable, within WeChat's 200MB user storage limit)
- **Eviction:** On write, if total size exceeds max, delete least-recently-accessed entries until space is available
- **Hash validation:** On read, compare stored hash with manifest hash; re-download if mismatched (handles asset updates)

## CLI Commands

### `phaser-wx init`

Interactive setup:
1. Prompts for WeChat appid
2. Prompts for screen orientation (portrait/landscape)
3. Prompts for CDN base URL
4. Creates `phaser-wx.config.json`
5. Detects and patches user's Vite/Rollup config to include the plugin

### `phaser-wx build --cdn <url>`

1. Loads and validates `phaser-wx.config.json`
2. Invokes Rollup with the transform plugin
3. Runs asset pipeline (scan, split, manifest)
4. Emits WeChat Mini-Game project to output dir
5. Reports build summary (package size, remote asset count, warnings)

### Configuration File (`phaser-wx.config.json`)

```json
{
  "appid": "wx1234567890",
  "orientation": "portrait",
  "cdn": "https://cdn.example.com/game/",
  "entry": "src/main.js",
  "assets": {
    "dir": "public/assets",
    "remoteSizeThreshold": 204800,
    "cacheMaxSize": 52428800
  },
  "output": {
    "dir": "dist-wx"
  },
  "webgl": {
    "version": 1,
    "antialias": false,
    "preserveDrawingBuffer": false
  }
}
```

## Error Handling

- **Config validation:** Fail fast with clear messages for missing/invalid fields
- **AST transform errors:** Report exact file + line where transform failed, with suggestion
- **Asset pipeline errors:** Warn on missing assets (referenced in code but not on disk), continue build
- **Runtime adapter errors:** Console warnings for unsupported API calls (e.g., `document.querySelector` — not polyfilled)

## Testing Strategy

| Layer | Approach |
|---|---|
| AST transforms | Unit tests: feed code snippets through each transform, assert output matches expected |
| Asset pipeline | Unit tests: fixture files, verify manifest generation and splitting logic |
| LRU cache | Unit tests: mock `wx.getFileSystemManager()`, verify eviction behavior |
| Adapter polyfills | Unit tests: mock `wx` globals, verify each polyfill conforms to DOM spec subset |
| Full pipeline | Integration tests: fixture Phaser project → build → verify WeChat output structure |
| CLI | Integration tests: run CLI commands, verify config generation and build output |

## Dependencies

### Build-time (CLI + Plugin)
- `commander` — CLI framework
- `@babel/parser`, `@babel/traverse`, `@babel/generator` — AST transforms
- `rollup` — build orchestration (peer dependency)
- `tsup` — package build tool
- `chalk` + `ora` — CLI output formatting
- `inquirer` — interactive prompts for `init`
- `crypto` (Node built-in) — asset hashing

### Runtime (Adapter)
- Zero external dependencies. Only uses `wx.*` APIs and JavaScript built-ins.

## Non-Goals

- Phaser 4 / Phaser CE support
- WebGL 2.0 support
- Webpack plugin (may add later)
- WeChat subpackage loading
- WeChat cloud functions integration
- Live-reload / HMR in WeChat DevTools
