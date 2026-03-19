# Adapter Rewrite Plan: Based on Official weapp-adapter + Phaser.js Extensions

## Background

### Problem

Image loading in WeChat Mini-Game shows green squares (Phaser's "missing texture" marker). Our custom adapter's complex XHR→Blob→wxblob://→temp-file chain is broken and fragile.

### Official weapp-adapter Philosophy

微信小游戏官方说明：
- 小游戏基础库只提供 `wx.createCanvas`、`wx.createImage` 等 wx API 以及 `setTimeout`/`setInterval`/`requestAnimationFrame` 等常用的 JS 方法
- weapp-adapter 是为了让基于浏览器环境的第三方代码更快地适配小游戏运行环境的一层适配层，并不是基础库的一部分
- weapp-adapter 和游戏引擎都视为第三方库，需要开发者在小游戏项目中自行引入
- weapp-adapter 对浏览器环境的模拟是远不完整的，仅针对游戏引擎可能访问的属性和调用的方法进行模拟
- 直接将 weapp-adapter 提供给开发者，更多地是作为参考，开发者可以根据需要在 weapp-adapter 的基础上进行扩展

### Root Cause Analysis

Official `weapp-adapter` (`/weapp-adapter/src/Image.js`) Image polyfill is dead simple:
```js
export default function Image() {
  const image = wx.createImage()
  return image
}
```

It works because `wx.createImage()` natively supports setting `src` to local file paths.

Our adapter tried to support Phaser's **XHR blob loading path**:
1. XHR fetches image with `responseType: 'blob'`
2. `_sendLocal()` reads file → ArrayBuffer
3. Wraps in WxBlob
4. `URL.createObjectURL(blob)` → `wxblob://1`
5. Image polyfill intercepts `src` setter for `wxblob://` URLs
6. Writes blob data to temp file → sets real `src`

This 6-step chain fails because intercepting the `src` property descriptor on native `wx.createImage()` objects is unreliable.

**The correct fix**: Tell Phaser to use `imageLoadType: 'HTMLImageElement'` in its loader config. This makes Phaser skip XHR entirely for images and directly call `Image.src = url` (see Phaser source: `ImageFile.loadImage()`). WeChat's native `wx.createImage()` handles local file paths natively.

## Strategy

1. **Inject `loader.imageLoadType: 'HTMLImageElement'`** in game-config transform — the key change
2. **Simplify Image polyfill** — follow official pattern: just `wx.createImage()` + `crossOrigin` stub
3. **Simplify XHR polyfill** — remove Blob wrapping, keep local file reading + proper event objects
4. **Keep all other adapter extensions** (DOM hierarchy, canvas WebGL context caching, touch coordinate mapping, lifecycle bridging, fetch, localStorage, etc.)

## Implementation Steps

### Step 1: Add `loader.imageLoadType` to game-config transform

**File**: `packages/rollup-plugin/src/transforms/game-config.ts`

In `mergeObjectProperties()`, add a `loader` property:
- If user already has a `loader` property (ObjectExpression), merge `imageLoadType` into it
- If not, add `loader: { imageLoadType: 'HTMLImageElement' }`

### Step 2: Simplify Image polyfill

**File**: `packages/adapter/src/polyfills/image.js`

Follow official adapter pattern — return `wx.createImage()` directly. Keep only `crossOrigin` stub (Phaser sets `image.crossOrigin = 'anonymous'`). Remove entire `wxblob://` src interception and `getBlobData` import.

### Step 3: Simplify XHR polyfill

**File**: `packages/adapter/src/polyfills/xmlhttprequest.js`

Remove `WxBlob` import and blob wrapping logic. Keep:
- Local file path detection + `_sendLocal()` (Phaser loads JSON/text files locally)
- Binary remote downloads via `wx.downloadFile()`
- Proper ProgressEvent-like objects with `target` property (Phaser's `File.onLoad(xhr, event)` reads `event.target.status`)
- `responseURL` property

### Step 4: Update game-config tests

**File**: `packages/rollup-plugin/__tests__/transforms/game-config.test.ts`

Add expectations for `imageLoadType` / `HTMLImageElement` in transformed output.

### Step 5: Build and verify

1. `pnpm --filter @aspect/rollup-plugin build`
2. `cd example && npx phaser-wx build`
3. Verify in WeChat DevTools: logo displays correctly, full game works
4. `pnpm test`

## Key Files

| File | Change |
|------|--------|
| `packages/rollup-plugin/src/transforms/game-config.ts` | Add `loader: { imageLoadType: 'HTMLImageElement' }` injection |
| `packages/adapter/src/polyfills/image.js` | Simplify to official pattern |
| `packages/adapter/src/polyfills/xmlhttprequest.js` | Remove Blob wrapping, keep local file + event objects |
| `packages/rollup-plugin/__tests__/transforms/game-config.test.ts` | Add imageLoadType expectations |

## Verification

1. Build: `pnpm --filter @aspect/rollup-plugin build && cd example && npx phaser-wx build`
2. Open `dist-wx/` in WeChat DevTools → logo displays as actual image (not green square)
3. Full game flow: Boot (progress bar + logo load) → Menu (logo + title) → Game (Breakout)
4. All tests pass: `pnpm test`

## Reference: Official vs Our Adapter Comparison

| Aspect | Official weapp-adapter | Our @aspect/adapter |
|--------|----------------------|---------------------|
| Image | `wx.createImage()` directly | Was: complex wxblob:// interception → Now: same as official + crossOrigin stub |
| XHR | `wx.request()` only | Extended: + local file reading + binary downloads + proper events |
| Canvas | `wx.createCanvas()` + prototype chain | Similar: + WebGL context caching + eager WebGL |
| Touch | wx.onTouchStart → document.dispatchEvent | Similar: + DPR coordinate scaling |
| DOM hierarchy | EventTarget→Node→Element→HTMLElement | Similar approach |
| Blob/URL | Not present | Present but no longer in critical image path |
| Audio | wx.createInnerAudioContext | Similar |
