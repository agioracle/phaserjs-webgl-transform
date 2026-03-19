# 微信分包：引擎 + 场景分包 + esbuild 压缩

## Context

微信小游戏主包限制 4MB。Phaser 引擎约 3.5MB，加上游戏代码和资源很容易超限。通过分包机制将游戏拆分为多个独立加载的包：

1. 引擎放入 `engine/` 分包，esbuild 压缩为 `phaser-engine.min.js`
2. MenuScene 放入 `menu/` 分包（代码）
3. GameScene 放入 `game-play/` 分包（代码 + 本地资源）
4. 主包只含 adapter + BootScene（~50KB）

## 加载流程

```
阶段1: "Made with Phaser" WebGL 闪屏（game.js）
  ├→ 渐显(1.2s) → 呼吸灯动画(持续至引擎就绪)
  └→ wx.loadSubpackage('engine') 异步下载 ~3.5MB

阶段2: BootScene（Phaser 场景）
  ├→ preload(): 从 CDN 加载 game_logo.png (remote-assets)
  ├→ 同时 wx.loadSubpackage('menu') 异步下载 MenuScene 分包
  └→ 两者均完成后 → this.scene.start('MenuScene')

阶段3: MenuScene
  ├→ preload(): 从 CDN 加载 bgm.mp3 (remote-assets)，复用 game_logo 缓存
  ├→ 同时 wx.loadSubpackage('game-play') 预加载 GameScene 分包
  └→ 点击开始 → this.scene.start('GameScene')

阶段4: GameScene
  └→ preload(): 加载 ball.png、ball_hit.mp3 (从 game-play/ 分包本地资源)
```

## 构建产物结构

```
dist-wx/                                   主包 ≈ 50KB
├── game.js                     ~2KB       WebGL 闪屏 + 异步加载引擎
├── phaser-wx-adapter.js        ~40KB
├── game-bundle.js              ~6KB       main.js + BootScene
├── game.json                              含 subpackages 声明
├── project.config.json
├── asset-manifest.json
│
├── engine/                                分包1: Phaser 引擎
│   ├── phaser-engine.min.js    ~3.5MB     esbuild 压缩
│   └── game.js                            分包入口 (stub)
│
├── menu/                                  分包2: MenuScene
│   ├── menu-scene.js           ~5KB
│   └── game.js                            分包入口 (stub)
│
└── game-play/                             分包3: GameScene
    ├── game-scene.js           ~10KB
    ├── game.js                            分包入口 (stub)
    └── assets/                            该场景的本地资源（自动复制）
        ├── images/ball.png
        └── audio/ball_hit.mp3
```

## 资源分发规则

| 资源路径前缀 | 处理方式 |
|-------------|----------|
| `remote-assets/` | 始终从 CDN 加载，不复制到任何分包 |
| `assets/` | 构建工具自动扫描场景入口中的 `this.load.*` 调用，将引用的本地资源复制到对应分包目录，并重写代码中的路径 |

示例：GameScene.js 中 `this.load.image('ball', 'assets/images/ball.png')`
- 构建时：`public/assets/images/ball.png` → `dist-wx/game-play/assets/images/ball.png`
- 代码重写：`'assets/images/ball.png'` → `'game-play/assets/images/ball.png'`

## 关键架构

### 1. game.js — WebGL 闪屏 + 引擎异步加载

game.js 是微信小游戏的入口文件，负责：
- 创建主 canvas 并获取 **WebGL** 上下文（不能用 2D，否则 Phaser 无法复用）
- 在离屏 2D canvas 上绘制 "Made with Phaser" 文字，作为 WebGL 纹理显示
- 渐显动画(1.2s) → 呼吸灯动画（alpha 在 0.5~1.0 间按正弦曲线循环，周期 2s）
- 并行 `wx.loadSubpackage('engine')` 下载引擎分包
- 引擎就绪后：停止动画 → 清理 WebGL 资源 → require adapter → require engine → require game-bundle

```js
// 核心流程
var _canvas = wx.createCanvas();
GameGlobal.__wxCanvas = _canvas;       // adapter 复用此 canvas
var _gl = _canvas.getContext('webgl');  // 必须用 WebGL，不能用 2D

// ... WebGL shader + texture setup (off-screen 2D canvas for text) ...

function _boot() {
  if (!_engineReady) return;
  cancelAnimationFrame(_splashRafId);
  // 清理 WebGL 资源
  _gl.deleteTexture(_tex);
  _gl.deleteBuffer(_buf);
  _gl.deleteProgram(_prog);
  // 加载链
  GameGlobal.__adapterExports = require('./phaser-wx-adapter.js');
  require('engine/phaser-engine.min.js');
  require('./game-bundle.js');
}

wx.loadSubpackage({
  name: 'engine',
  success: function() { _engineReady = true; _boot(); }
});
```

> **重要**：微信中 canvas 的 context 类型一旦确定不能切换。如果闪屏用 `getContext('2d')`，Phaser 后续 `getContext('webgl')` 会返回 null。

### 2. 场景注册方式

main.js 只静态导入 BootScene，其他场景通过分包加载后动态注册：

```js
// main.js
import { BootScene } from './scenes/BootScene.js';
const config = {
  scene: [BootScene], // 只注册 BootScene
};
const game = new Phaser.Game(config);
```

### 3. 场景中加载下一个分包

每个场景在 preload 中并行加载下一个场景的分包：

```js
// BootScene.js — preload()
this._menuReady = false;
if (typeof wx !== 'undefined' && wx.loadSubpackage) {
  wx.loadSubpackage({
    name: 'menu',
    success: () => {
      const { MenuScene } = require('menu/menu-scene.js');
      this.scene.add('MenuScene', MenuScene, false);
      this._menuReady = true;
    },
  });
} else {
  this._menuReady = true; // 非微信环境 fallback
}
```

### 4. 跨分包 Phaser 访问

引擎分包中的 Phaser 通过全局变量共享：
- game-bundle.js 构建后自动追加：`GameGlobal.Phaser = Phaser`
- 场景分包中 `require('phaser')` 被替换为 `GameGlobal.Phaser`

### 5. 跨分包 require 路径修复

微信中 `require()` 相对于当前文件解析。如果 menu-scene.js 中引用 `require('game-play/game-scene.js')`，实际解析为 `menu/game-play/game-scene.js`（错误）。构建工具自动重写为 `require('../game-play/game-scene.js')`。

## 配置

`phaser-wx.config.json` 中的 `subpackages` 字段：

```json
{
  "subpackages": [
    {
      "name": "menu",
      "root": "menu/",
      "entry": "src/scenes/MenuScene.js",
      "outputFile": "menu-scene.js"
    },
    {
      "name": "game-play",
      "root": "game-play/",
      "entry": "src/scenes/GameScene.js",
      "outputFile": "game-scene.js"
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `name` | 分包名称，用于 `wx.loadSubpackage({ name })` |
| `root` | 分包目录，须以 `/` 结尾 |
| `entry` | 场景源码入口文件路径 |
| `outputFile` | 构建后的文件名 |

> 不需要手动配置 `assets` 字段，构建工具自动扫描场景入口文件中的 `this.load.*` 调用来发现和复制资源。

## 构建流程

### 主构建（game-bundle.js + phaser-engine）

```ts
const mainBundle = await rollup({ input: config.entry, plugins: [...] });
const { output: mainChunks } = await mainBundle.generate({
  dir: config.output.dir,
  format: 'cjs',
  manualChunks: { 'phaser-engine': ['phaser'] },
  chunkFileNames: '[name].js',
  entryFileNames: 'game-bundle.js',
  intro: introCode,  // polyfill 别名 (window, document 等)
  strict: false,
});

// 后处理
for (const chunk of mainChunks) {
  if (chunk.name === 'phaser-engine') {
    // esbuild 压缩 → engine/phaser-engine.min.js
    const minified = await esbuildTransform(code, { minify: true, target: 'es2015' });
  } else if (chunk.isEntry) {
    // 重写 require 路径: require('./phaser-engine.js') → require('engine/phaser-engine.min.js')
    // 追加: GameGlobal.Phaser = Phaser
  }
}
```

### 场景分包构建

```ts
for (const sub of config.subpackages) {
  const sceneBundle = await rollup({
    input: sub.entry,
    external: ['phaser'],  // Phaser 已全局加载
    plugins: [nodeResolve({ browser: true }), commonjs()],
  });

  // generate() + 后处理
  // 1. require('phaser') → GameGlobal.Phaser
  // 2. 跨分包 require 路径加 ../ 前缀
  // 3. scanAssets() 扫描资源引用 → 复制到分包目录 → 重写路径
}
```

## 已知局限

1. **`scanAssets` 只扫描入口文件表层** — 如果资源加载写在被 import 的工具模块中，不会被发现
2. **场景中的分包加载代码需要用户手写** — 构建工具不会自动注入 `wx.loadSubpackage()` / `require()` / `scene.add()` 代码
3. **跨分包 require 路径修复假设扁平目录结构** — 分包 root 不支持嵌套路径（如 `scenes/menu/`）
4. **共享工具模块会重复打包** — 每个场景分包独立构建，import 的工具模块在每个分包中各有一份副本

## 涉及文件

| 文件 | 职责 |
|------|------|
| `packages/rollup-plugin/src/output/wx-project.ts` | 生成 game.js (WebGL 闪屏) + game.json (分包声明) + 分包 game.js stub |
| `packages/cli/src/commands/build.ts` | 多入口构建 + esbuild 压缩 + 分包目录 + 资源扫描复制 + 路径重写 |
| `packages/cli/src/utils/config.ts` | subpackages 配置解析 |
| `packages/cli/tsup.config.ts` | esbuild 加入 external 列表 |
| `packages/rollup-plugin/src/asset-pipeline/scanner.ts` | 扫描 `this.load.*` 调用发现资源引用 |
| `example/src/main.js` | 只注册 BootScene |
| `example/src/scenes/BootScene.js` | 加载 game_logo (CDN) + 并行下载 menu 分包 |
| `example/src/scenes/MenuScene.js` | 加载 bgm (CDN) + 预下载 game-play 分包 |
| `example/src/scenes/GameScene.js` | 加载 ball.png、ball_hit.mp3 (分包本地资源) |
| `example/phaser-wx.config.json` | subpackages 配置示例 |
