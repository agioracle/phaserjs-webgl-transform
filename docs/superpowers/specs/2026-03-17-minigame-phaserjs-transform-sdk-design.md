# minigame-phaserjs-transform-sdk Design Spec

**Date:** 2026-03-17
**Status:** Draft
**Target:** Phaser 3.x → WeChat Mini-Game transformation tool
**Minimum WeChat Base Library:** >= 2.10.0

## Purpose

A build tool and runtime adapter that converts standard Phaser.js WebGL projects into high-performance WeChat Mini-Games. Inspired by the `minigame-tuanjie-transform-sdk` (Unity-to-WeChat adapter) architecture — following its "minimal footprint" philosophy of polyfilling only what the engine needs.

## Constraints

- **Phaser 3.x only** (full 3.0–3.80+ range)
- **WebGL 1.0** context (best WeChat compatibility)
- **pnpm** workspace monorepo
- **Rollup plugin** as the primary build integration (works with Vite)
- WeChat Mini-Game 20MB package limit; 200MB user storage limit
- **Minimum WeChat Base Library: >= 2.10.0** (required for `wx.createCanvas()` WebGL support, `wx.getFileSystemManager()` full API, `wx.downloadFile()` with arraybuffer support)

## Architecture

Three packages in a pnpm monorepo:

| Package | Responsibility |
|---|---|
| `@aspect/cli` | CLI entry (`init`, `build --cdn <url>`). Orchestrates the build pipeline. |
| `@aspect/rollup-plugin` | Rollup/Vite plugin. AST transforms (Babel), asset extraction, WeChat project output. |
| `@aspect/adapter` | Runtime bridge. Polyfills DOM/BOM APIs for Phaser in WeChat's environment. Ships as pre-built JS. |

### Versioning

All three packages use **lockstep semver** — they share the same version number and are released together. This avoids incompatible adapter/plugin combinations. The pnpm workspace `package.json` at root specifies the shared version. Breaking changes in any package bump the major version for all.

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
│       │   │   ├── window.js         # Global window shim (timers, dimensions, dpr)
│       │   │   ├── document.js       # document.createElement, body, documentElement, getElementById
│       │   │   ├── navigator.js      # navigator.userAgent, onLine, vibrate
│       │   │   ├── canvas.js         # Canvas + WebGL via wx.createCanvas()
│       │   │   ├── image.js          # Image via wx.createImage()
│       │   │   ├── audio.js          # HTMLAudio via InnerAudioContext (Web Audio disabled)
│       │   │   ├── xmlhttprequest.js # XHR via wx.request() / wx.downloadFile()
│       │   │   ├── fetch.js          # fetch() polyfill via wx.request() / wx.downloadFile()
│       │   │   └── local-storage.js  # localStorage via wx storage APIs
│       │   ├── bridge/
│       │   │   ├── touch.js          # wx touch → DOM TouchEvent
│       │   │   ├── lifecycle.js      # wx.onShow/onHide → visibilitychange + focus/blur
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
| `window` (global, `innerWidth`, `innerHeight`, `devicePixelRatio`) | Synthetic object reading from `wx.getSystemInfoSync()` |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | Native WeChat globals — no shim needed. Available in WeChat's JS runtime. |
| `requestAnimationFrame` / `cancelAnimationFrame` | Native WeChat globals — no shim needed. |
| `performance.now()` | Native WeChat global — no shim needed. |
| `document.createElement('canvas')` | `wx.createCanvas()` — always returns off-screen canvas (see Canvas Polyfill) |
| `document.createElement('image')` / `new Image()` | `wx.createImage()` |
| `document.body` / `document.documentElement` | Stub objects with `clientWidth`/`clientHeight` returning screen dimensions |
| `document.getElementById()` | Returns `GameGlobal.__wxCanvas` if id matches configured canvas ID, else `null` |
| `navigator.userAgent` / `navigator.onLine` | Custom userAgent identifying WeChat Mini-Game; `onLine` from `wx.getNetworkType` |
| `canvas.getContext('webgl')` | Native WeChat WebGL 1.0 context |
| `canvas.getContext('2d')` | Native WeChat 2D context (off-screen canvases for text rendering) |
| `canvas.toDataURL()` / `canvas.toTempFilePath()` | Supported on WeChat on-screen canvas via `canvas.toTempFilePathSync()`. Off-screen canvases: `toDataURL()` supported in base library >= 2.11.0. Documented as limited support. |
| `new Audio()` / HTML5 Audio | Shim wrapping `wx.createInnerAudioContext()` |
| `XMLHttpRequest` | Shim: `responseType === 'arraybuffer'/'blob'` routes to `wx.downloadFile()` + `fs.readFile()`; text/JSON routes to `wx.request()` |
| `fetch()` | Shim: same routing as XHR. Supports `Response.json()`, `.text()`, `.arrayBuffer()`. Required for Phaser 3.60+ loader. |
| `localStorage` | `wx.setStorageSync()` / `wx.getStorageSync()` |
| `addEventListener('touchstart/move/end', ...)` on canvas | `wx.onTouchStart/Move/End` → synthetic DOM `TouchEvent` dispatched to canvas listeners |
| `addEventListener('visibilitychange')` on document | Dispatched on `wx.onShow`/`wx.onHide` |
| `addEventListener('focus'/'blur')` on window | Dispatched alongside `visibilitychange` on `wx.onShow`/`wx.onHide` |
| `WebSocket` | **Not polyfilled (non-goal).** Games needing WebSocket should use `wx.connectSocket()` directly. See Plugin Compatibility. |

### Canvas Polyfill

The primary on-screen canvas is created **once** during adapter initialization via `wx.createCanvas()` and stored as `GameGlobal.__wxCanvas`. It is never returned by `document.createElement('canvas')`.

```
Adapter init:
  GameGlobal.__wxCanvas = wx.createCanvas()  →  primary on-screen canvas
    └── getContext('webgl', { antialias: false, preserveDrawingBuffer: false })

document.createElement('canvas'):
  Always returns wx.createCanvas()  →  off-screen canvas
    └── Used by Phaser for text rendering, render textures
```

The Game Config injection (Transform 1) injects `canvas: GameGlobal.__wxCanvas`, so Phaser uses the pre-created on-screen canvas directly. This avoids fragile "first call" ordering issues — no matter what calls `createElement('canvas')` before Phaser, the on-screen canvas is already reserved.

### Touch Event Mapping

WeChat's `wx.onTouchStart/Move/End/Cancel` fire globally. The adapter:

1. Registers global touch handlers during initialization
2. Creates synthetic `TouchEvent` objects matching DOM spec
3. Applies `devicePixelRatio` scaling to `clientX`/`clientY` coordinates
4. Dispatches events on the canvas element's listener registry
5. Provides `touches`, `changedTouches`, `timeStamp` — exactly what Phaser's `InputManager` reads

### Audio Strategy

**Decision: HTML5 Audio only. Web Audio API is disabled.**

Rationale: WeChat's `InnerAudioContext` is a file-playback wrapper, fundamentally incompatible with Web Audio's `AudioBuffer`/`AudioBufferSourceNode`/`GainNode` graph model. A faithful Web Audio shim would require PCM sample manipulation that WeChat doesn't expose. Instead:

- **Game Config injection forces `audio: { disableWebAudio: true }`** — Phaser falls back to its HTML5 Audio manager
- **`Audio` constructor** returns a shim wrapping `wx.createInnerAudioContext()` with: `src`, `play()`, `pause()`, `currentTime`, `volume`, `loop`, `muted`, `duration`, `paused`, and event support (`onended`, `onplay`, `onerror`, `oncanplaythrough`)
- **`AudioContext` constructor** exists as a stub that logs a warning if accessed directly, preventing crashes in third-party code that feature-detects Web Audio

This approach is honest about WeChat's audio limitations rather than providing a broken shim.

### Lifecycle Proxy

```
wx.onShow  → document.hidden = false
           → dispatch 'visibilitychange' on document
           → dispatch 'focus' on window
           → Phaser's Visibility Handler calls game.resume()

wx.onHide  → document.hidden = true
           → dispatch 'visibilitychange' on document
           → dispatch 'blur' on window
           → Phaser's Visibility Handler calls game.pause()
```

Dispatches both `visibilitychange` and `focus`/`blur` events because Phaser's `FocusHandler` listens for `focus`/`blur` on window to manage audio and the game loop. Using Phaser's built-in handlers rather than calling game methods directly.

### Screen Fitting

On initialization:
1. Read `wx.getSystemInfoSync()` → `screenWidth`, `screenHeight`, `pixelRatio`
2. Set `window.innerWidth`, `window.innerHeight`, `window.devicePixelRatio`
3. Set canvas dimensions: `canvas.width = screenWidth * pixelRatio`, `canvas.height = screenHeight * pixelRatio`
4. Listen to `wx.onWindowResize` and `wx.onDeviceOrientationChange` for orientation/size changes → update window dimensions

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
  audio: { disableWebAudio: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
}
```

**Rules:**
- Properties are merged, not replaced — user values preserved except `type` (forced to `WEBGL` with warning), `parent` (forced to `null`), and `audio.disableWebAudio` (forced to `true`)
- Handles both inline object literals and variable references (traces to declaration)
- Supports `new Phaser.Game(config)` and `new Phaser.Game({ ... })` patterns

### Transform 2: WeChat Project Output

After Rollup bundles the game, the plugin emits the WeChat Mini-Game project structure:

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

**Note on asset URL rewriting:** Asset URLs are **not** rewritten at build time in the source AST. Instead, the runtime loader intercepts Phaser's loading system and uses `asset-manifest.json` to resolve local paths to CDN URLs at runtime. This avoids the double-rewriting problem of having both build-time URL rewriting and runtime interception. The manifest is the single source of truth for asset location.

## Asset Management System

### Build-Time Pipeline

1. **Scanner:** Walks source AST for Phaser loader calls (`this.load.image()`, `.audio()`, `.spritesheet()`, `.atlas()`, `.tilemapTiledJSON()`, `.multiatlas()`, `.bitmapFont()`, etc.). Collects all referenced asset paths and their types.

2. **Splitter:** Applies size threshold (default 200 KiB / 204,800 bytes, configurable). Assets above threshold → `dist-wx/remote/` for CDN. Assets below → bundled in package.

3. **Manifest Generator:** Creates `asset-manifest.json`:
```json
{
  "version": 1,
  "cdnBase": "https://cdn.example.com/game/",
  "assets": {
    "assets/images/hero.png": {
      "size": 45000,
      "hash": "a1b2c3d4e5f6g7h8",
      "remote": true,
      "type": "image"
    },
    "assets/audio/bgm.mp3": {
      "size": 2400000,
      "hash": "i9j0k1l2m3n4o5p6",
      "remote": true,
      "type": "audio"
    }
  }
}
```

**Hash algorithm:** SHA-256, first 16 hex characters. Provides sufficient collision resistance for cache validation while keeping the manifest compact.

### Runtime Loader

1. **Startup:** Reads `asset-manifest.json`, builds in-memory lookup table.
2. **Intercept:** Overrides `Phaser.Loader.File.prototype.load` to route asset requests through the custom loader. This is the single interception point — all Phaser file types (ImageFile, AudioFile, etc.) inherit from `File` and call this method. The original `load` method is preserved as `_originalLoad` for non-manifest assets (e.g., inline data URIs).
   - For each load request, check if the path exists in the manifest
   - If in manifest and `remote: true`: check LRU cache → serve from cache or download from CDN
   - If in manifest and `remote: false`: load from local package (default Phaser behavior)
   - If not in manifest: fall through to original loader
3. **Download with retry:** `wx.downloadFile()` with configurable retry policy:
   - **Retries:** 3 attempts with exponential backoff (1s, 2s, 4s)
   - **Timeout:** 30 seconds per attempt (configurable)
   - **On failure:** Call Phaser's `File.onError()` callback, which triggers the scene's `loaderror` event. Games can handle this in their loading scene.
4. **Preloading:** Supports configurable preload list for critical assets (downloaded during loading screen before game starts).

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
- **Hash validation:** On read, compare stored hash with manifest hash; re-download if mismatched (handles asset updates across game versions)
- **Concurrency safety:** Metadata is maintained in an in-memory map during the loading session. Writes to `_meta.json` are serialized — a single `flushMetadata()` call writes the current state after each batch of downloads completes (Phaser's loader fires a `complete` event per file queue). This prevents concurrent `_meta.json` writes from racing. On startup, `_meta.json` is read once into memory; all subsequent reads use the in-memory map.

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
5. **Post-build size check:** Calculates total size of `dist-wx/` excluding `remote/`. If it exceeds 20MB, emit an error with a breakdown of the largest files and a recommendation to move more assets to CDN or tree-shake Phaser. If between 16–20MB, emit a warning.
6. Reports build summary (package size, remote asset count, warnings)

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
    "cacheMaxSize": 52428800,
    "downloadRetries": 3,
    "downloadTimeout": 30000
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

**`entry` field:** Used as Rollup's `input` only if the user's existing Vite/Rollup config does not specify one. If the user has an existing config with an `input` field, that takes precedence. The `entry` field is a fallback for users who don't have a Rollup config and are relying entirely on the CLI.

## Error Handling

- **Config validation:** Fail fast with clear messages for missing/invalid fields
- **AST transform errors:** Report exact file + line where transform failed, with suggestion
- **Asset pipeline errors:** Warn on missing assets (referenced in code but not on disk), continue build
- **Runtime adapter errors:** Console warnings for unsupported API calls (e.g., `document.querySelector` — not polyfilled). Unsupported methods return `null` or no-op rather than throwing.
- **Download errors:** Retry with exponential backoff. On final failure, surface error through Phaser's `File.onError()` → scene `loaderror` event
- **Cache errors:** If `wx.getFileSystemManager()` calls fail (disk full, permission), log warning and fall through to direct CDN download without caching

## Testing Strategy

| Layer | Approach |
|---|---|
| AST transforms | Unit tests: feed code snippets through each transform, assert output matches expected |
| Asset pipeline | Unit tests: fixture files, verify manifest generation and splitting logic |
| LRU cache | Unit tests: mock `wx.getFileSystemManager()`, verify eviction, concurrency, and hash validation |
| Adapter polyfills | Unit tests: mock `wx` globals, verify each polyfill conforms to DOM spec subset Phaser needs |
| XHR/Fetch routing | Unit tests: verify `responseType` routing to correct `wx` API |
| Full pipeline | Integration tests: fixture Phaser project → build → verify WeChat output structure and size check |
| CLI | Integration tests: run CLI commands, verify config generation and build output |

## Dependencies

### Build-time (CLI + Plugin)
- `commander` — CLI framework
- `@babel/parser`, `@babel/traverse`, `@babel/generator` — AST transforms
- `rollup` — build orchestration (peer dependency)
- `tsup` — package build tool
- `chalk` + `ora` — CLI output formatting
- `inquirer` — interactive prompts for `init`
- `crypto` (Node built-in) — SHA-256 asset hashing

### Runtime (Adapter)
- Zero external dependencies. Only uses `wx.*` APIs and JavaScript built-ins.

## Plugin Compatibility

The adapter polyfills Phaser 3 core APIs only. Third-party plugins may access additional DOM/BOM APIs:

| Plugin | Status | Notes |
|---|---|---|
| Phaser 3 core scenes, sprites, physics (Arcade, Matter) | Supported | Core rendering and physics are canvas/WebGL-only |
| `rexUI` | Likely compatible | Uses Phaser's rendering pipeline, not DOM |
| `spine-plugin` | Likely compatible | WebGL-based rendering |
| Plugins using `document.querySelector`, `DOM.createElement('div')` | Not compatible | DOM manipulation beyond our polyfill surface |
| Plugins using `WebSocket` | Requires manual adaptation | Use `wx.connectSocket()` directly |
| Plugins using Web Audio API nodes (analyzers, filters) | Not compatible | Web Audio is disabled |

**Extension point:** Users can add custom polyfills by creating a `phaser-wx-custom-adapter.js` file. The generated `game.js` will `require` it after the main adapter and before the game bundle, allowing users to patch additional globals.

## Package Size Considerations

Phaser 3 minified is ~1MB. With the adapter (~30KB) and basic game code, the 20MB package limit can be tight for asset-heavy games. Recommendations for users:

1. **Tree-shake Phaser** using custom builds (Phaser supports this) to reduce core size
2. **Move all assets to CDN** (set `remoteSizeThreshold: 0` to force all assets remote)
3. **Consider subpackage loading** as a future enhancement — acknowledged as a potential v2 feature

## Non-Goals

- Phaser 4 / Phaser CE support
- WebGL 2.0 support
- Web Audio API (AudioContext node graph) — InnerAudioContext is fundamentally incompatible
- Webpack plugin (may add later)
- WeChat subpackage loading (potential v2 feature — see Package Size Considerations)
- WeChat cloud functions integration
- Live-reload / HMR in WeChat DevTools
- WebSocket polyfill (games should use `wx.connectSocket()` directly)
