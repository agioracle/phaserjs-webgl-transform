# minigame-phaserjs-transform-sdk

将 Phaser.js 3.x WebGL 游戏转换为高性能微信小游戏的工具链。

## 概述

微信小游戏运行环境没有 DOM / BOM API，而 Phaser.js 重度依赖 `window`、`document`、`Canvas`、`Image`、`Audio` 等浏览器接口。本项目通过三个协同工作的包，自动完成从标准 Web 游戏到微信小游戏的核心适配（渲染、输入、音频、资源加载等），仅安全区域等设备相关的 UI 布局需要少量游戏侧调整：

| 包 | 说明 |
|---|---|
| **@aspect/adapter** | 运行时 DOM/BOM polyfill 层，将 `wx.*` API 桥接为浏览器标准接口 |
| **@aspect/rollup-plugin** | Babel AST 变换 + 资源管线，自动注入小游戏兼容配置并处理资源分发 |
| **@aspect/cli** | 命令行工具 `phaser-wx`，提供项目创建、配置初始化、构建打包一站式流程 |

## 兼容性

- **Phaser**: 3.x（WebGL 渲染器）
- **微信基础库**: >= 2.10.0
- **Node.js**: >= 18
- **pnpm**: >= 8

## 快速开始

### 1. 安装

```bash
# 克隆仓库并安装依赖
git clone <repo-url>
cd wechat-minigame-phaserjs-webgl-transform
pnpm install

# 构建所有包
pnpm build
```

构建完成后，全局链接 `phaser-wx` 命令：

```bash
cd packages/cli && npm link && cd ../..
phaser-wx --help
```

> **注意**：`@aspect/cli` 尚未发布到 npm，因此 `npx phaser-wx` 不可用。请先执行上述全局链接步骤。

### 2. 创建新项目

```bash
# 创建新项目。注意尽量在其他目录中创建新项目，避免与模板项目冲突！
phaser-wx new my-game
```

交互式引导会询问以下信息：

- **AppID** — 微信小游戏 AppID（以 `wx` 开头）
- **屏幕方向** — `landscape`（横屏）或 `portrait`（竖屏）
- **CDN 地址** — 远程资源的 CDN 基础 URL。如果暂时不需要远程资源，可跳过不填

生成的项目结构：

```
my-game/
├── src/
│   ├── main.js              # 入口文件，创建 Phaser.Game 实例
│   └── scenes/
│       ├── BootScene.js     # 加载场景（进度条）
│       ├── MenuScene.js     # 主菜单（标题 + 开始按钮）
│       └── GameScene.js     # 游戏场景（交互示例）
├── public/
│   ├── assets/              # 本地资源（打包进小游戏）
│   └── remote-assets/       # 远程资源（需手动上传 CDN）
├── phaser-wx.config.json    # 小游戏构建配置
├── package.json
└── README.md
```

### 3. 开发与构建

```bash
cd my-game
npm install

# 本地预览（标准浏览器）
npm run dev

# 构建微信小游戏包
npm run build
```

构建产物输出到 `dist-wx/`，可直接在微信开发者工具中打开。


## CLI 命令

### `phaser-wx new <project-name>`

创建一个新的 Phaser.js + 微信小游戏项目，包含完整的场景模板、UI 组件和配置文件。

```bash
phaser-wx new my-game
phaser-wx new my-game --template full   # 等效，full 为默认模板
```


### `phaser-wx build`

执行构建，将 Phaser.js 项目转换为微信小游戏。

```bash
phaser-wx build
phaser-wx build --cdn https://cdn.example.com/assets   # 覆盖 CDN 地址
```

> **提示**：在 `phaser-wx new` 创建的项目中，`npm run build` 已预配置为 `phaser-wx build`，直接使用即可。

## 配置文件

`phaser-wx.config.json` 完整字段说明：

```jsonc
{
  // [必填] 微信小游戏 AppID，必须以 "wx" 开头
  "appid": "wx1234567890abcdef",

  // [必填] 屏幕方向："portrait" | "landscape"
  "orientation": "landscape",

  // [必填] CDN 基础 URL，用于远程资源访问
  "cdn": "https://cdn.example.com/game-assets",

  // [必填] 游戏入口文件路径
  "entry": "src/main.js",

  // 资源配置
  "assets": {
    "dir": "public/assets",          // 本地资源目录
    "remoteAssetsDir": "public/remote-assets",  // 远程资源目录（该目录下的资源标记为 remote，需手动上传 CDN）
    "remoteSizeThreshold": 204800,   // 超过此大小(字节)的资源上传 CDN，默认 200KB
    "cacheMaxSize": 52428800,        // 本地缓存上限，默认 50MB
    "downloadRetries": 3,            // 下载重试次数
    "downloadTimeout": 30000         // 下载超时(毫秒)
  },

  // 输出配置
  "output": {
    "dir": "dist-wx"                 // 构建产物目录
  },

  // WebGL 配置
  "webgl": {
    "version": 1,                    // WebGL 版本
    "antialias": false,              // 抗锯齿
    "preserveDrawingBuffer": false   // 保留绘制缓冲区
  },

  // [可选] 场景分包配置，详见"分包机制"章节
  "subpackages": [
    {
      "name": "menu",               // 分包名称
      "root": "menu/",              // 分包目录（须以 / 结尾）
      "entry": "src/scenes/MenuScene.js",  // 场景源码入口
      "outputFile": "menu-scene.js"        // 构建产物文件名
    }
  ]
}
```

## 分包机制

微信小游戏主包限制 4MB。Phaser 引擎本身约 3.5MB，加上游戏代码和资源很容易超限。分包机制将游戏拆分为多个独立加载的包：

### 构建产物结构

```
dist-wx/                              主包 ≈ 50KB
├── game.js                           启动入口 + "Made with Phaser" 闪屏
├── phaser-wx-adapter.js              适配器
├── game-bundle.js                    主入口 + BootScene
├── game.json                         含 subpackages 声明
├── project.config.json
├── asset-manifest.json
│
├── engine/                           分包: Phaser 引擎 ≈ 3.5MB
│   └── phaser-engine.min.js
│
├── menu/                             分包: MenuScene
│   ├── menu-scene.js
│   └── assets/                       该场景的本地资源（自动复制）
│
└── game-play/                        分包: GameScene
    ├── game-scene.js
    └── assets/                       该场景的本地资源（自动复制）
```

### 启动流程

1. **闪屏阶段** — `game.js` 在 WebGL canvas 上渲染 "Made with Phaser" 文字（渐显 + 呼吸灯动画），同时异步下载 engine 分包
2. **BootScene** — 引擎加载完毕后启动 Phaser，BootScene 加载自身资源并并行下载下一个场景分包
3. **后续场景** — 每个场景在前一个场景中预加载，通过 `wx.loadSubpackage()` 下载后动态注册

### 配置

在 `phaser-wx.config.json` 中添加 `subpackages` 数组：

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

### 游戏代码适配

#### 1. 主入口只注册首屏场景

```js
// src/main.js
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';

const config = {
  // ...
  scene: [BootScene], // 其他场景从分包动态加载
};
const game = new Phaser.Game(config);
```

#### 2. 场景中加载下一个分包并动态注册

```js
// src/scenes/BootScene.js — preload()
this._menuReady = false;
wx.loadSubpackage({
  name: 'menu',
  success: () => {
    const { MenuScene } = require('menu/menu-scene.js');
    this.scene.add('MenuScene', MenuScene, false);
    this._menuReady = true;
  }
});

// create() 中等待分包就绪后跳转
if (this._menuReady) {
  this.scene.start('MenuScene');
}
```

### 资源自动分发

构建工具会自动扫描每个场景源码中的 `this.load.*` 调用：

- **`assets/` 路径的资源**（本地资源）：自动复制到对应分包目录，并重写代码中的资源路径。例如场景代码中写 `this.load.image('ball', 'assets/images/ball.png')`，构建后该文件会被复制到 `game-play/assets/images/ball.png`，代码中的路径也会自动更新
- **`remote-assets/` 路径的资源**（远程资源）：始终从 CDN 加载，不会复制到任何分包中

> **提示**：不需要在配置文件中手动声明每个分包的资源列表，构建工具会自动处理。

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                     phaser-wx CLI                        │
│  new · init · build                                     │
├─────────────────────────────────────────────────────────┤
│                  @aspect/rollup-plugin                   │
│                                                         │
│  ┌──────────────┐  ┌──────────────────────────────────┐ │
│  │ AST 变换      │  │ 资源管线                         │ │
│  │              │  │                                  │ │
│  │ · 游戏配置注入│  │ · 扫描 Phaser loader 调用        │ │
│  │   (WEBGL强制) │  │ · remoteAssetsDir → 强制远程     │ │
│  │ · 禁用WebAudio│  │ · 按体积拆分本地/远程资源        │ │
│  │ · 图片直加模式│  │ · 生成 asset-manifest.json      │ │
│  │ · Scale适配   │  │ · SHA-256 去重                   │ │
│  └──────────────┘  └──────────────────────────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────────┐│
│  │ 输出生成                                             ││
│  │ · game.js / game.json / project.config.json         ││
│  │ · 适配器注入 · 包体积检查 (16MB 警告 / 20MB 错误)    ││
│  └──────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│                    @aspect/adapter                       │
│                                                         │
│  Polyfill 层                    桥接层                   │
│  · window / document            · Touch 事件映射         │
│  · navigator                    · 生命周期桥接           │
│  · Canvas (WebGL)               · 屏幕尺寸同步           │
│  · Image / Audio                · 安全区域 (safeArea)     │
│  · XMLHttpRequest / fetch       资源管理                 │
│  · localStorage                 · LRU 缓存 (50MB)       │
│  · AudioContext (stub)          · CDN 下载 + 指数退避重试 │
└─────────────────────────────────────────────────────────┘
```

### 构建流程

1. **AST 变换**（`transform` 钩子）：
   - 解析 `new Phaser.Game(config)` 调用，注入 `type: Phaser.WEBGL`、`canvas: GameGlobal.__wxCanvas`、`parent: null`、`audio: { disableWebAudio: true }`、`loader: { imageLoadType: 'HTMLImageElement' }`、`scale: { mode: NONE, autoCenter: NO_CENTER }`
   - 扫描所有 `this.load.image/audio/spritesheet/atlas` 等调用，收集资源引用

2. **资源管线**（`generateBundle` 钩子）：
   - `remoteAssetsDir` 目录下的资源自动标记为远程（不复制到输出目录，防止意外打包）
   - 按文件大小阈值将其余资源拆分为本地包内资源和 CDN 远程资源
   - 对资源文件计算 SHA-256 哈希，自动去重
   - 生成 `asset-manifest.json` 供运行时加载器使用

3. **输出生成**：
   - 生成 `game.js`（适配器 → 自定义适配器 → 游戏代码的加载链）
   - 生成 `game.json`（屏幕方向、网络超时等配置）
   - 生成 `project.config.json`（微信开发者工具项目配置）
   - 复制适配器脚本到输出目录

4. **包体积检查**：
   - 本地包体积 > 16MB：输出警告
   - 本地包体积 > 20MB：构建失败并输出文件大小明细

### 运行时适配

`@aspect/adapter` 在小游戏启动时将所有 polyfill 注入全局作用域：

| 浏览器 API | 微信小游戏实现 |
|---|---|
| `window` | 属性代理到 `wx.getSystemInfoSync()` |
| `document.createElement('canvas')` | `wx.createCanvas()`（离屏画布） |
| `document.createElement('audio')` | 返回 `WxAudio` 实例（Phaser 用于格式检测） |
| `new Image()` | `wx.createImage()` + `crossOrigin` stub |
| `new Audio()` | `wx.createInnerAudioContext()` + `canPlayType` / `dataset` 支持 |
| `AudioContext` | Stub（输出警告，引导使用 HTML5 Audio） |
| `XMLHttpRequest` | `wx.request()` / `wx.downloadFile()` |
| `fetch()` | `wx.request()` |
| `localStorage` | `wx.getStorageSync()` / `wx.setStorageSync()` |
| Touch 事件 | `wx.onTouchStart/Move/End/Cancel` → DOM `TouchEvent` |
| `visibilitychange` | `wx.onShow()` / `wx.onHide()` |
| Safe Area | `wx.getWindowInfo().safeArea` → `GameGlobal.__safeArea` |

## 开发

### 项目结构

```
wechat-minigame-phaserjs-webgl-transform/
├── packages/
│   ├── adapter/           # 运行时适配器 (JavaScript)
│   ├── rollup-plugin/     # Rollup 插件 (TypeScript)
│   └── cli/               # CLI 工具 (TypeScript)
├── docs/                  # 设计文档和实现计划
├── package.json           # 根 package.json
└── pnpm-workspace.yaml
```

### 常用命令

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 运行所有测试
pnpm test

# 仅运行某个包的测试
pnpm --filter @aspect/adapter test
pnpm --filter @aspect/rollup-plugin test
pnpm --filter @aspect/cli test

# 清理构建产物
pnpm clean
```

### 测试

项目使用 [Vitest](https://vitest.dev/) 作为测试框架，当前包含 **170 个测试**：

| 包 | 测试数 | 测试文件数 |
|---|---|---|
| @aspect/adapter | 83 | 15 |
| @aspect/rollup-plugin | 37 | 6 |
| @aspect/cli | 50 | 6 |

覆盖范围包括：
- 每个 polyfill 的单元测试
- Touch / 生命周期 / 屏幕桥接测试
- LRU 缓存和资源加载器测试
- AST 变换测试（游戏配置注入、资源扫描）
- 资源拆分器和清单生成器测试
- CLI 命令测试（init、build、new）
- 端到端集成测试（完整构建管线）

## 设计决策

| 决策 | 原因 |
|---|---|
| **图片直接加载（HTMLImageElement 模式）** | 构建工具自动注入 `loader: { imageLoadType: 'HTMLImageElement' }`，让 Phaser 跳过 XHR+Blob 管线，直接通过 `Image.src = path` 加载图片。微信的 `wx.createImage()` 原生支持本地文件路径，无需 Blob/URL 中间层 |
| **禁用 Web Audio** | 微信 `InnerAudioContext` 与 Web Audio API 不兼容，强制使用 HTML5 Audio 模式 |
| **运行时资源 URL 解析** | 不在构建时重写 URL，而是通过 manifest + 运行时 loader 拦截实现，避免 AST 变换的复杂度和脆弱性 |
| **远程资源目录分离** | `remoteAssetsDir` 下的资源在 manifest 中自动标记为 `remote: true`，构建时**不复制到输出目录**，防止用户不小心将所有资源打包进小游戏。用户需手动上传到 CDN，运行时通过 `LoaderPlugin.start` 拦截自动从 CDN 加载 |
| **Canvas 启动时预创建** | `GameGlobal.__wxCanvas` 在适配器初始化时创建，避免调用顺序问题 |
| **LRU 缓存序列化写入** | 元数据通过 Promise 链串行写入，防止并发竞态 |
| **模板内嵌为字符串** | CLI 使用 tsup 打包为单文件 CJS，模板作为字符串字面量内嵌避免运行时路径解析问题 |
| **CLI 运行时依赖全量打包** | pnpm 严格模式下外部依赖不可跨包解析；`commander`、`inquirer` 等全部内联打包，仅 `rollup` 和 `@aspect/rollup-plugin` 保持外部引用（含 native binary，无法内联），通过懒加载 `await import()` 按需加载 |

## 开发指南

### 资源管理：本地资源 vs 远程资源

项目支持两种资源存放方式：

| 目录 | 类型 | 行为 |
|------|------|------|
| `public/assets/` | 本地资源 | 打包进小游戏包内，直接加载 |
| `public/remote-assets/` | 远程资源 | **不打包**，在 `asset-manifest.json` 中标记为 `remote: true`，运行时从 CDN 加载 |

**使用场景**：
- **本地资源**：小体积、高频使用的资源（UI 图标、音效、小图片等）
- **远程资源**：大体积资源（背景音乐、高清图片、视频等），避免撑大小游戏包体积

#### 配置

在 `phaser-wx.config.json` 中指定远程资源目录：

```json
{
  "assets": {
    "dir": "public/assets",
    "remoteAssetsDir": "public/remote-assets"
  }
}
```

#### 代码中使用

```js
// BootScene.js — preload 中加载

// 本地资源（从 assets/ 加载）
this.load.image('logo', 'assets/images/logo.png');
this.load.audio('hit', 'assets/audio/hit.mp3');

// 远程资源（运行时会自动从 CDN 下载）
this.load.audio('bgm', 'remote-assets/audio/bgm.mp3');
```

#### 构建与部署

构建完成后，控制台会提示需要手动上传远程资源：

```
✅ Build complete!
  Total size: 8.00 MB
  Local files: 9
  Remote assets: 1

📦 1 remote asset(s) need to be uploaded to CDN.
  Upload the contents of "public/remote-assets" to:
  https://cdn.example.com/remote-assets/
```

**部署步骤**：

1. 将 `public/remote-assets/` 中的文件上传到 CDN 对应路径（保持目录结构），例如：
   - `public/remote-assets/audio/bgm.mp3` → `https://cdn.example.com/remote-assets/audio/bgm.mp3`
2. 将 `dist-wx/` 目录导入微信开发者工具

> **重要**：`remote-assets/` 中的资源**不会**被复制到 `dist-wx/` 输出目录中，以防止用户不小心将所有资源打包进小游戏（微信限制包体积 20MB）。这些资源必须上传到 CDN 后才能正常加载。
>
> **本地开发**：如需在微信开发者工具中本地调试，可以先将 CDN 资源部署到测试环境，或使用本地静态服务器配合 `cdn` 配置项指向 `http://127.0.0.1:PORT`。
>
> `asset-manifest.json` 中 `remote: true` 的资源，运行时会通过 `cdnBase + 资源路径` 拼接完整 URL 下载。请确保 CDN 上的文件路径与 `remote-assets/` 内的目录结构一致。

### 图片加载

构建工具会自动在 Phaser 游戏配置中注入 `loader.imageLoadType: 'HTMLImageElement'`，**用户无需手动配置**。这使得 Phaser 通过 `Image.src` 直接加载图片，而非走 XHR → Blob → URL.createObjectURL 管线。

图片资源放在 `public/assets/` 目录下，在场景中正常使用 Phaser 的加载 API 即可：

```js
// BootScene.js — preload 中加载
this.load.image('logo', 'assets/images/logo.png');
this.load.image('ball', 'assets/images/ball.png');

// 其他场景中使用
this.add.image(400, 300, 'logo');
```

### 音频播放

构建工具自动注入 `audio: { disableWebAudio: true }`，Phaser 使用 HTML5 Audio 模式，适配器将其桥接到微信的 `wx.createInnerAudioContext()`。

音频资源同样放在 `public/assets/` 目录下：

```js
// BootScene.js — preload 中加载
this.load.audio('bgm', 'assets/audio/bgm.mp3');
this.load.audio('hit', 'assets/audio/hit.mp3');

// 其他场景中播放
this.sound.play('bgm', { loop: true, volume: 0.5 });
this.sound.play('hit', { volume: 0.3 });
```

**支持格式**：mp3、aac/m4a、wav（推荐 mp3，兼容性最佳）。

> **注意**：微信小游戏没有浏览器的自动播放限制，音频可以在任意时机播放，无需等待用户交互。

### 安全区域适配

在刘海屏、挖孔屏、灵动岛等设备上，屏幕边缘区域可能被遮挡。适配器通过 `wx.getWindowInfo()` 读取设备安全区域信息，并暴露到 `GameGlobal.__safeArea`：

```js
// GameGlobal.__safeArea 的结构（值为物理屏幕像素）
{
  top: 47,          // 顶部内缩（状态栏/刘海）
  bottom: 34,       // 底部内缩（Home 指示条）
  left: 0,          // 左侧内缩
  right: 0,         // 右侧内缩
  width: 375,       // 安全区域宽度
  height: 731,      // 安全区域高度
  screenWidth: 375,  // 屏幕总宽度
  screenHeight: 812  // 屏幕总高度
}
```

**核心原则**：游戏场景全屏渲染（无黑边），只将 UI 元素（分数、生命值、按钮等）定位在安全区域内。

**使用方式**——编写一个工具函数，将物理像素转换为游戏坐标系：

```js
// src/utils/safe-area.js
export function getSafeArea(scene) {
  const raw = (typeof GameGlobal !== 'undefined' && GameGlobal.__safeArea) || {};
  const gameW = scene.cameras.main.width;
  const gameH = scene.cameras.main.height;
  const screenW = raw.screenWidth || gameW;
  const screenH = raw.screenHeight || gameH;
  return {
    top:    (raw.top    || 0) * (gameH / screenH),
    bottom: (raw.bottom || 0) * (gameH / screenH),
    left:   (raw.left   || 0) * (gameW / screenW),
    right:  (raw.right  || 0) * (gameW / screenW),
  };
}
```

在场景中使用：

```js
import { getSafeArea } from '../utils/safe-area.js';

create() {
  const W = this.cameras.main.width;
  const H = this.cameras.main.height;
  const sa = getSafeArea(this);

  // UI 元素——使用 sa.top / sa.bottom 偏移
  this.add.text(24, sa.top + 16, 'Score: 0', { ... });
  this.add.text(W - 24, sa.top + 16, '❤ 3', { ... });

  // 底部元素——从安全区域底部向上偏移
  const paddleY = H - sa.bottom - 100;
  this.add.rectangle(W / 2, paddleY, 150, 20, 0xe8e8e8);

  // 游戏内容——不需要偏移，全屏渲染
  // 砖块、球、特效等正常放置
}
```

> **说明**：在没有刘海/挖孔的设备上，`safeArea` 所有 inset 值为 0，布局效果与无适配时一致。

## License

MIT
