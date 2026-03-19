# P0 启动优化：去除 Adapter 重复 + Phaser 引擎分包

## Context

当前 `game-bundle.js` 为 7.9MB 单文件，包含 adapter（38KB，与独立文件重复）+ Phaser 引擎（~7.8MB）+ 游戏代码（~50KB）。微信需一次性下载解析全部 7.9MB 才能渲染首帧，违反官方"首包 ≤ 4MB"和"尽快渲染"的最佳实践。

**目标**：
1. 去除 adapter 重复内联（节省 38KB + 解析时间）
2. 将 Phaser 引擎分离为独立文件，利用微信分包机制，降低首包体积

## 当前架构

```
game.js (入口, 169B)
  ├── require('./phaser-wx-adapter.js')     // 38KB — 设置 GameGlobal 全局 polyfill
  └── require('./game-bundle.js')           // 7.9MB
      ├── [intro] adapter 再次内联执行 (38KB) ← 重复！
      ├── [intro] var window = __adapter_exports.window  ← 模块作用域别名
      ├── [intro] var document = __adapter_exports.document
      ├── [intro] ...
      ├── [intro] __initRemoteAssetLoader()
      ├── Phaser 引擎 (~7.8MB)
      └── 游戏代码 (~50KB)
```

## 关键约束

**为什么 adapter 会被内联？** Phaser 代码中有大量裸引用 `document`、`window` 等。在 CJS 模块作用域中，这些名字会沿作用域链查找。当前方案在 `intro` 中用 `var window = ...` 创建模块级变量来遮蔽全局，确保 Phaser 使用 polyfill 而非微信原生（可能不存在的）API。

**拆分后如何保证 Phaser 仍使用 polyfill？** 关键洞察：adapter 通过 `safeSet` 已将 polyfill 写入 `GameGlobal` 和 `globalThis`。`game-bundle.js` 的 `intro` 不需要重新执行 adapter 代码，只需从 `GameGlobal` 读取属性创建 `var` 别名即可。

## 方案

### Step 1：去除 adapter 重复内联

**File**: `packages/cli/src/commands/build.ts`

修改 `intro` 生成逻辑：

- **删除**：adapter 代码内联执行（`var __adapter_exports = (function() { ... })();`）
- **保留**：所有 `var` 别名声明，改为从 `GameGlobal`（已由 `phaser-wx-adapter.js` 设置）读取
- **保留**：`__initRemoteAssetLoader` 函数（不依赖 adapter exports）

变更前：
```js
// intro 中（在 game-bundle.js 内部）
var __adapter_exports = (function() {
  var module = { exports: {} }; var exports = module.exports;
  /* 38KB adapter code */
  return module.exports;
})();
var window = __adapter_exports.window;
var document = __adapter_exports.document;
// ...
```

变更后：
```js
// intro 中（在 game-bundle.js 内部）
var _g = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;
var window = _g.window;
var document = _g.document;
var navigator = _g.navigator;
var canvas = _g.canvas;
var screen = _g.screen || {};
var Image = _g.Image;
var Audio = _g.Audio;
var AudioContext = _g.AudioContext;
var XMLHttpRequest = _g.XMLHttpRequest;
var fetch = _g.fetch;
var localStorage = _g.localStorage;
var Blob = _g.Blob;
var URL = _g.URL;
var webkitAudioContext = _g.AudioContext;
var self = _g.window;
var setTimeout = _g.window.setTimeout;
var clearTimeout = _g.window.clearTimeout;
var setInterval = _g.window.setInterval;
var clearInterval = _g.window.clearInterval;
var requestAnimationFrame = _g.window.requestAnimationFrame;
var cancelAnimationFrame = _g.window.cancelAnimationFrame;
var HTMLElement = _g.HTMLElement || function HTMLElement() {};
var HTMLCanvasElement = _g.HTMLCanvasElement || function HTMLCanvasElement() {};
// __initRemoteAssetLoader 保持不变
```

同时：
- **删除** adapter 打包逻辑（`rollup` adapter bundle 部分），adapter 文件改为由 `generateWxProject`（rollup-plugin）负责输出。
- **保留** `phaser-wx-adapter.js` 的独立输出（已由 `wx-project.ts` 处理，只需确保 adapter 在 build.ts 中仍被打包输出）。

实际上当前 build.ts 和 wx-project.ts 都会输出 adapter 文件，保留 build.ts 中的打包输出即可（它会 rollup bundle adapter 源码为 CJS 并写入 dist-wx）。

### Step 2：Phaser 引擎分包

**Files**: `packages/cli/src/commands/build.ts`, `packages/rollup-plugin/src/output/wx-project.ts`

将 Phaser 引擎从 `game-bundle.js` 中分离：

1. **build.ts**：使用 rollup 的 `output.manualChunks` 将 `phaser` npm 包分离为 `phaser-engine.js`
   ```js
   await bundle.write({
     dir: config.output.dir,        // 改 file → dir
     format: 'cjs',
     manualChunks: {
       'phaser-engine': ['phaser'],
     },
     chunkFileNames: '[name].js',
     entryFileNames: 'game-bundle.js',
     intro: (chunk) => chunk.isEntry ? introCode : '',  // 仅注入到 entry chunk
     strict: false,
   });
   ```

2. **wx-project.ts**：更新 `game.js` 模板，加载顺序：
   ```js
   require('./phaser-wx-adapter.js');
   require('./phaser-engine.js');
   require('./game-bundle.js');
   ```

3. **game.json**：添加分包配置（可选，如果需要微信分包加载机制）

### Step 3：更新测试

**File**: `packages/cli/__tests__/integration/full-pipeline.test.ts`

- 验证 `dist-wx/phaser-engine.js` 存在且包含 Phaser 代码
- 验证 `game-bundle.js` 不包含完整 Phaser 代码（体积大幅缩小）
- 验证 `game-bundle.js` 的 intro 不包含 adapter 源码
- 验证 `phaser-wx-adapter.js` 仍然存在

### Step 4：验证

1. `pnpm --filter @aspect/cli test`
2. `pnpm --filter @aspect/rollup-plugin test`
3. 在外部目录创建游戏项目并 build，验证 dist-wx 中：
   - `phaser-wx-adapter.js` 存在（~38KB）
   - `phaser-engine.js` 存在（~7.8MB）
   - `game-bundle.js` 大幅缩小（~50KB 级别）
   - `game.js` 正确按顺序 require 三个文件

## Key Files

| File | Action |
|------|--------|
| `packages/cli/src/commands/build.ts` | 重写 intro 生成 + rollup 输出改为 dir + manualChunks |
| `packages/rollup-plugin/src/output/wx-project.ts` | 更新 game.js 模板 |
| `packages/cli/__tests__/integration/full-pipeline.test.ts` | 更新验证 |
