# minigame-phaserjs-transform-sdk

将 Phaser.js 3.x WebGL 游戏转换为高性能微信小游戏的工具链。

## 概述

微信小游戏运行环境没有 DOM / BOM API，而 Phaser.js 重度依赖 `window`、`document`、`Canvas`、`Image`、`Audio` 等浏览器接口。本项目通过三个协同工作的包，在不修改游戏业务代码的前提下，自动完成从标准 Web 游戏到微信小游戏的适配：

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

构建完成后，`phaser-wx` 命令可通过以下方式使用：

```bash
# 在 monorepo 内使用 pnpm exec 调用
pnpm exec phaser-wx --help

# 或者全局链接后直接使用
pnpm link packages/cli --global
phaser-wx --help
```

> **注意**：`@aspect/cli` 尚未发布到 npm，因此 `npx phaser-wx` 不可用。在 monorepo 内请使用 `pnpm exec phaser-wx`。

### 2. 创建新项目

```bash
# 使用脚手架创建完整示例项目
pnpm exec phaser-wx new my-game
```

交互式引导会询问以下信息：

- **AppID** — 微信小游戏 AppID（以 `wx` 开头）
- **屏幕方向** — `landscape`（横屏）或 `portrait`（竖屏）
- **CDN 地址** — 远程资源的 CDN 基础 URL

生成的项目结构：

```
my-game/
├── src/
│   ├── main.js              # 入口文件，创建 Phaser.Game 实例
│   ├── scenes/
│   │   ├── BootScene.js     # 加载场景（进度条）
│   │   ├── MenuScene.js     # 主菜单（标题 + 开始按钮）
│   │   └── GameScene.js     # 游戏场景（交互示例）
│   └── ui/
│       └── Button.js        # 可复用按钮组件
├── public/assets/            # 游戏资源目录
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

### 4. 在已有项目中使用

如果你已有 Phaser.js 项目，在 monorepo 内初始化配置：

```bash
cd your-existing-project
pnpm exec phaser-wx init
pnpm exec phaser-wx build
```

## CLI 命令

### `phaser-wx new <project-name>`

创建一个新的 Phaser.js + 微信小游戏项目，包含完整的场景模板、UI 组件和配置文件。

```bash
pnpm exec phaser-wx new my-game
pnpm exec phaser-wx new my-game --template full   # 等效，full 为默认模板
```

### `phaser-wx init`

在当前目录生成 `phaser-wx.config.json` 配置文件。适用于已有 Phaser.js 项目。

```bash
pnpm exec phaser-wx init
```

### `phaser-wx build`

执行构建，将 Phaser.js 项目转换为微信小游戏。

```bash
pnpm exec phaser-wx build
pnpm exec phaser-wx build --cdn https://cdn.example.com/assets   # 覆盖 CDN 地址
```

> **提示**：如果已全局安装 `@aspect/cli`（通过 `npm install -g @aspect/cli`），可省略 `pnpm exec` 前缀。在 `phaser-wx new` 创建的项目中，`npm run build` 已预配置，直接使用即可。

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
    "dir": "public/assets",          // 资源目录
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
  }
}
```

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
│  │   (WEBGL强制) │  │ · 按体积拆分本地/远程资源        │ │
│  │ · 禁用WebAudio│  │ · 生成 asset-manifest.json      │ │
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
│  · Image / Audio                                        │
│  · XMLHttpRequest / fetch       资源管理                 │
│  · localStorage                 · LRU 缓存 (50MB)       │
│  · AudioContext (stub)          · CDN 下载 + 指数退避重试 │
└─────────────────────────────────────────────────────────┘
```

### 构建流程

1. **AST 变换**（`transform` 钩子）：
   - 解析 `new Phaser.Game(config)` 调用，注入 `type: Phaser.WEBGL`、`audio: { disableWebAudio: true }`、`scale` 适配
   - 扫描所有 `this.load.image/audio/spritesheet/atlas` 等调用，收集资源引用

2. **资源管线**（`generateBundle` 钩子）：
   - 按文件大小阈值将资源拆分为本地包内资源和 CDN 远程资源
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
| `document.createElement('canvas')` | `wx.createCanvas()` / `wx.createOffscreenCanvas()` |
| `new Image()` | `wx.createImage()` |
| `new Audio()` | `wx.createInnerAudioContext()` |
| `AudioContext` | Stub（输出警告，引导使用 HTML5 Audio） |
| `XMLHttpRequest` | `wx.request()` / `wx.downloadFile()` |
| `fetch()` | `wx.request()` |
| `localStorage` | `wx.getStorageSync()` / `wx.setStorageSync()` |
| Touch 事件 | `wx.onTouchStart/Move/End/Cancel` → DOM `TouchEvent` |
| `visibilitychange` | `wx.onShow()` / `wx.onHide()` |

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

项目使用 [Vitest](https://vitest.dev/) 作为测试框架，当前包含 **168 个测试**：

| 包 | 测试数 | 测试文件数 |
|---|---|---|
| @aspect/adapter | 83 | 15 |
| @aspect/rollup-plugin | 35 | 6 |
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
| **禁用 Web Audio** | 微信 `InnerAudioContext` 与 Web Audio API 不兼容，强制使用 HTML5 Audio 模式 |
| **运行时资源 URL 解析** | 不在构建时重写 URL，而是通过 manifest + 运行时 loader 拦截实现，避免 AST 变换的复杂度和脆弱性 |
| **Canvas 启动时预创建** | `GameGlobal.__wxCanvas` 在适配器初始化时创建，避免调用顺序问题 |
| **LRU 缓存序列化写入** | 元数据通过 Promise 链串行写入，防止并发竞态 |
| **模板内嵌为字符串** | CLI 使用 tsup 打包为单文件 CJS，模板作为字符串字面量内嵌避免运行时路径解析问题 |
| **CLI 运行时依赖全量打包** | pnpm 严格模式下外部依赖不可跨包解析；`commander`、`inquirer` 等全部内联打包，仅 `rollup` 和 `@aspect/rollup-plugin` 保持外部引用（含 native binary，无法内联），通过懒加载 `await import()` 按需加载 |

## License

MIT
