# 微信分包：引擎 + 场景分包 + esbuild 压缩

## Context

当前所有文件都在主包目录下（~7.9MB），超出微信主包 4MB 限制。需要：
1. 引擎放入 `engine/` 分包，esbuild 压缩为 `phaser-engine.min.js`
2. MenuScene 放入 `menu/` 分包（代码 + 专属资源）
3. GameScene 放入 `game-play/` 分包（代码，复用 BootScene 资源）
4. 主包只含 adapter + BootScene + 其专属资源

## 加载流程

```
阶段1: 原生极简进度条（game.js，纯 wx Canvas）
  └→ wx.loadSubpackage('engine') 异步下载 ~3.5MB

阶段2: BootScene（Phaser 场景，用户可定制 loading 页面）
  ├→ preload(): 加载 BootScene 本地资源 (ball.png, ball_hit.mp3)
  ├→ 同时 wx.loadSubpackage('menu') 异步下载 MenuScene 分包
  └→ 两者均完成后 → this.scene.start('MenuScene')

阶段3: MenuScene
  ├→ preload(): 加载 menu/ 分包中的资源 (game_logo.png, bgm.mp3)
  ├→ 同时 wx.loadSubpackage('game-play') 预加载 GameScene 分包
  └→ 点击开始 → this.scene.start('GameScene')

阶段4: GameScene（复用已加载资源，无额外 preload）
```

## 目标产物结构

```
dist-wx/                                   主包 ≈ 110KB
├── game.js                     ~800B      入口 + 原生 loading + 异步加载引擎
├── phaser-wx-adapter.js        ~38KB
├── game-bundle.js              ~15KB      main.js + BootScene + utils
├── game.json                              含 subpackages 声明
├── project.config.json
├── asset-manifest.json
├── assets/                                BootScene 本地资源
│   ├── images/ball.png
│   └── audio/ball_hit.mp3
│
├── engine/                                分包1: Phaser 引擎
│   └── phaser-engine.min.js    ~3.5MB
│
├── menu/                                  分包2: MenuScene
│   ├── menu-scene.js           ~5KB
│   └── assets/                            MenuScene 专属资源
│       ├── images/game_logo.png
│       └── audio/bgm.mp3
│
└── game-play/                             分包3: GameScene
    └── game-scene.js           ~10KB
```

## 关键架构变化

### 1. 场景注册方式改变

**当前**: main.js 静态导入所有场景，传给 `new Phaser.Game({ scene: [...] })`
**改后**: main.js 只导入 BootScene，其他场景通过 `this.scene.add()` 动态注册

### 2. 场景需要改为独立 rollup 入口

MenuScene 和 GameScene 各自是独立的 rollup 入口，输出到各自分包目录。它们 `import Phaser from 'phaser'` 时，Phaser 已被标记为 external（因为引擎已在 engine/ 分包中加载到全局）。

### 3. BootScene 负责加载 menu 分包

BootScene 在 preload 资源的同时，并行 `wx.loadSubpackage('menu')`。两者都完成后才跳转 MenuScene。

## 实现步骤

### Step 1: 添加 esbuild 依赖

```bash
pnpm --filter @aspect/cli add esbuild
```

### Step 2: 修改 build.ts — 多入口构建 + 引擎压缩 + 分包目录

**File**: `packages/cli/src/commands/build.ts`

核心改动：
1. 读取新增的 `subpackages` 配置
2. 主入口 rollup 构建: main.js → game-bundle.js，Phaser 用 `manualChunks` 分离
3. 场景入口 rollup 构建: 每个场景分包单独 rollup 构建，Phaser 标记为 external
4. `bundle.generate()` + esbuild 压缩 phaser-engine chunk → `engine/phaser-engine.min.js`
5. 场景 chunk 写入对应分包目录
6. 拷贝场景专属资源到分包目录

```ts
// 主构建 (adapter + engine + game-bundle)
const mainBundle = await rollup({ input: config.entry, plugins: [...] });
const { output: mainChunks } = await mainBundle.generate({
  dir: config.output.dir,
  format: 'cjs',
  manualChunks: { 'phaser-engine': ['phaser'] },
  chunkFileNames: '[name].js',
  entryFileNames: 'game-bundle.js',
  intro: introCode,
  strict: false,
});

// 写入 chunks，压缩引擎
for (const chunk of mainChunks) {
  if (chunk.type !== 'chunk') continue;
  let code = chunk.code;
  let fileName = chunk.fileName;
  if (chunk.name === 'phaser-engine') {
    const { transform } = await import('esbuild');
    const minified = await transform(code, { minify: true, target: 'es2015' });
    code = minified.code;
    fileName = 'engine/phaser-engine.min.js';
  }
  const outPath = path.join(config.output.dir, fileName);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, code, 'utf-8');
}

// 场景分包构建
for (const sub of config.subpackages) {
  const sceneBundle = await rollup({
    input: sub.entry,
    external: ['phaser'],  // Phaser 已全局加载
    plugins: [nodeResolve({ browser: true }), commonjs(), phaserWxTransform(pluginOptions)],
  });
  await sceneBundle.write({
    file: path.join(config.output.dir, sub.root, sub.outputFile),
    format: 'cjs',
    intro: introCode, // 同样需要 polyfill 别名
    strict: false,
    paths: { phaser: '../phaser-engine' }, // 不需要，external 即可
  });
  // 拷贝场景专属资源
  if (sub.assets) {
    for (const asset of sub.assets) {
      const src = path.resolve(asset.from);
      const dest = path.join(config.output.dir, sub.root, asset.to);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }
}
```

### Step 3: 修改 config.ts — 新增 subpackages 配置

**File**: `packages/cli/src/utils/config.ts`

在 `PhaserWxConfig` 接口新增:
```ts
subpackages?: {
  name: string;       // 'menu' | 'game-play'
  root: string;       // 'menu/' | 'game-play/'
  entry: string;      // 场景 JS 入口文件路径
  outputFile: string; // 输出文件名 'menu-scene.js'
  assets?: { from: string; to: string }[];  // 场景专属资源映射
}[];
```

### Step 4: 修改 wx-project.ts — game.json 分包 + game.js 异步加载

**File**: `packages/rollup-plugin/src/output/wx-project.ts`

1. `WxProjectConfig` 接口新增 `subpackages` 字段
2. **game.json** 添加 `subpackages` 声明
3. **game.js** 两阶段加载:
   - 阶段1: 同步加载 adapter → 原生进度条 → `wx.loadSubpackage('engine')` → require engine → require game-bundle
   - game-bundle (BootScene) 自行处理后续分包

```js
// game.js
GameGlobal.__adapterExports = require('./phaser-wx-adapter.js');
if (typeof GameGlobal.__wxCustomAdapter !== 'undefined') {
  require('./phaser-wx-custom-adapter.js');
}

// 原生 loading（等待引擎分包下载）
var _info = wx.getSystemInfoSync();
var _canvas = GameGlobal.__adapterExports.canvas || wx.createCanvas();
var _ctx = _canvas.getContext('2d');
var _w = _canvas.width || _info.screenWidth;
var _h = _canvas.height || _info.screenHeight;
function _drawProgress(p) {
  _ctx.fillStyle = '#000000';
  _ctx.fillRect(0, 0, _w, _h);
  var bW = Math.min(_w * 0.6, 400), bH = 8;
  var bX = (_w - bW) / 2, bY = _h / 2;
  _ctx.fillStyle = '#333333';
  _ctx.fillRect(bX, bY, bW, bH);
  _ctx.fillStyle = '#ffffff';
  _ctx.fillRect(bX, bY, bW * Math.min(p, 1), bH);
}
_drawProgress(0);

var _task = wx.loadSubpackage({
  name: 'engine',
  success: function() {
    require('engine/phaser-engine.min.js');
    require('./game-bundle.js');
  },
  fail: function(err) { console.error('Engine subpackage failed:', err); }
});
_task.onProgressUpdate(function(res) { _drawProgress(res.progress / 100); });
```

### Step 5: 修改 example 游戏代码

#### main.js — 只注册 BootScene

```js
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';

const config = {
  type: Phaser.WEBGL,
  width: 750, height: 1334,
  backgroundColor: '#1a1a2e',
  physics: { default: 'arcade', arcade: { debug: false, checkCollision: { up: true, down: true, left: true, right: true } } },
  scene: [BootScene],  // 只注册 BootScene，其他场景动态加载
};

const game = new Phaser.Game(config);
```

#### BootScene.js — 加载自身资源 + 并行加载 menu 分包

```js
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload() {
    // 进度条 UI...（保持现有代码）

    // 只加载 BootScene 专属资源
    this.load.image('ball', 'assets/images/ball.png');
    this.load.audio('ball_hit', 'assets/audio/ball_hit.mp3');

    // 并行加载 menu 分包
    this._menuReady = false;
    wx.loadSubpackage({
      name: 'menu',
      success: () => {
        // 注册 MenuScene
        const { MenuScene } = require('menu/menu-scene.js');
        this.scene.add('MenuScene', MenuScene, false);
        this._menuReady = true;
      }
    });
  }

  create() {
    const proceed = () => {
      if (this._menuReady) {
        this.scene.start('MenuScene');
      } else {
        this.time.delayedCall(100, proceed);
      }
    };
    // 保留原有的进度条动画，完成后跳转
    this.tweens.add({
      targets: this.fillBar,
      width: this.barWidth,
      duration: 1000,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.loadingText.setText('Complete!');
        this.time.delayedCall(200, proceed);
      },
    });
  }
}
```

#### MenuScene.js — 加载自身资源 + 预加载 game-play 分包

MenuScene 新增 `preload()` 方法，加载 menu/ 分包中的资源:
```js
preload() {
  this.load.image('game_logo', 'menu/assets/images/game_logo.png');
  this.load.audio('bgm', 'menu/assets/audio/bgm.mp3');

  // 预加载 GameScene 分包
  this._gameReady = false;
  wx.loadSubpackage({
    name: 'game-play',
    success: () => {
      const { GameScene } = require('game-play/game-scene.js');
      this.scene.add('GameScene', GameScene, false);
      this._gameReady = true;
    }
  });
}
```

#### GameScene.js — 无改动（复用 ball、ball_hit 缓存）

### Step 6: 更新 example/phaser-wx.config.json

```json
{
  "appid": "wx4a4d257bc28799a0",
  "orientation": "portrait",
  "cdn": "https://cdn.example.com",
  "entry": "src/main.js",
  "assets": {
    "dir": "public/assets",
    "remoteAssetsDir": "public/remote-assets",
    "remoteSizeThreshold": 204800
  },
  "output": { "dir": "dist-wx" },
  "subpackages": [
    {
      "name": "menu",
      "root": "menu/",
      "entry": "src/scenes/MenuScene.js",
      "outputFile": "menu-scene.js",
      "assets": [
        { "from": "public/remote-assets/images/game_logo.png", "to": "assets/images/game_logo.png" },
        { "from": "public/remote-assets/audio/bgm.mp3", "to": "assets/audio/bgm.mp3" }
      ]
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

### Step 7: 重新 build rollup-plugin

```bash
pnpm --filter @aspect/rollup-plugin build
```

### Step 8: 更新测试

**File**: `packages/rollup-plugin/__tests__/output/wx-project.test.ts`
- game.json 检查 `subpackages` 含 engine/menu/game-play
- game.js 检查 `wx.loadSubpackage` 和异步加载模式

**File**: `packages/cli/__tests__/integration/full-pipeline.test.ts`
- 验证 `engine/phaser-engine.min.js` 存在
- 验证 `game-bundle.js` 不含 Phaser 引擎代码
- game.js 检查异步加载模式
- game.json 检查 subpackages

### Step 9: 运行测试

```bash
pnpm --filter @aspect/rollup-plugin test
pnpm --filter @aspect/cli test
```

## Key Files

| File | Action |
|------|--------|
| `packages/cli/package.json` | 添加 esbuild |
| `packages/cli/src/commands/build.ts` | 多入口构建 + esbuild 压缩 + 分包目录 |
| `packages/cli/src/utils/config.ts` | 新增 subpackages 配置 |
| `packages/rollup-plugin/src/output/wx-project.ts` | game.json 分包声明 + game.js 异步加载 |
| `example/src/main.js` | 只注册 BootScene |
| `example/src/scenes/BootScene.js` | 只加载自身资源 + 加载 menu 分包 |
| `example/src/scenes/MenuScene.js` | 新增 preload + 预加载 game-play 分包 |
| `example/phaser-wx.config.json` | 新增 subpackages 配置 |
| `packages/rollup-plugin/__tests__/output/wx-project.test.ts` | 更新测试 |
| `packages/cli/__tests__/integration/full-pipeline.test.ts` | 更新测试 |
