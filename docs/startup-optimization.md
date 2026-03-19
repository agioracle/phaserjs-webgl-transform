# 微信小游戏启动优化分析与方案

> 基于微信官方文档：[启动性能优化最佳实践](https://developers.weixin.qq.com/minigame/dev/guide/performance/perf-action-start2.html)

## 当前问题分析

### 问题 1：首包过大，无代码分包（严重）

**官方建议**：首包不超过 4MB，合理使用分包加载。

**现状**：`game-bundle.js` **7.9MB**，包含 Phaser 引擎（~7.8MB）+ adapter（~38KB）+ 游戏代码（~50KB），全部打进单文件，无分包。微信需要一次性下载、解析、执行整个 7.9MB 文件才能开始渲染。

### 问题 2：Adapter 代码重复加载（中等）

**现状**：adapter 代码存在于两处：

1. 独立文件 `phaser-wx-adapter.js`（38KB）—— `game.js` 中 `require` 加载并执行
2. `game-bundle.js` 的 `intro` 中又内联了一份完整 adapter（另外 38KB）

两份代码都会被执行，浪费 38KB 传输和解析时间。

### 问题 3：全量同步加载，阻塞首屏渲染（严重）

**官方建议**：尽快渲染，降低首屏渲染所需资源，缩短代码注入到首屏渲染的时间。

**现状**：`game.js` 同步 `require` 所有文件，7.9MB JS 必须全部解析执行完才能开始渲染：

```js
require('./phaser-wx-adapter.js');   // 38KB
require('./game-bundle.js');          // 7.9MB — 阻塞！
```

用户看到的是长时间黑屏。

### 问题 4：未利用引擎插件能力（中等）

**官方建议**：使用微信提供的引擎插件，本地已有同类引擎时可直接复用或增量下载。

**现状**：Phaser 引擎完整打包进 `game-bundle.js`，未使用微信引擎插件机制。每次启动都要重新下载/解析完整引擎。

### 问题 5：未利用并行下载能力（低）

**官方建议**：在启动流程中使用网络 I/O 提前下载后续所需资源。

**现状**：所有资源加载都在 Phaser 场景的 `preload` 中才开始，没有在引擎加载期间提前并行下载。

---

## 优化方案

| 优先级 | 方案 | 预期收益 | 改动范围 |
|--------|------|----------|----------|
| **P0** | 分包：Phaser 引擎与游戏代码分离 | 首包从 7.9MB 降至 ~50KB，引擎走子包加载 | build.ts, rollup config, wx-project.ts |
| **P0** | 去除 adapter 重复：`game-bundle.js` 不再内联 adapter，改为依赖 `game.js` 中已执行的全局 polyfill | 减少 38KB 冗余，加快解析 | build.ts |
| **P1** | 引擎插件：检测微信是否已缓存 Phaser 引擎插件，有则复用 | 二次启动接近零下载 | wx-project.ts, game.js 模板 |
| **P1** | 首屏快速渲染：在 `game.js` 中用原生 Canvas API 绘制简单 loading 画面，再异步加载引擎 | 用户立即看到画面，不再黑屏等待 | wx-project.ts |
| **P2** | 并行预下载：在引擎加载期间，同步用 `wx.downloadFile` 预下载游戏资源 | 缩短进入游戏的总等待时间 | wx-project.ts, game.js 模板 |

---

## 当前构建产物分析

| 文件 | 大小 | 说明 |
|------|------|------|
| `game-bundle.js` | 7.9 MB | Phaser + adapter (内联) + 游戏代码 |
| `phaser-wx-adapter.js` | 38 KB | 独立 adapter（与 bundle 中的重复） |
| `game.js` | 169 B | 入口，同步 require 以上两个文件 |
| `game.json` | 191 B | 微信游戏配置 |
| `project.config.json` | 223 B | 微信项目配置 |
| `asset-manifest.json` | 702 B | 资源清单 |
| `assets/` | ~12 KB | 本地资源文件 |

### game.js 当前加载流程

```
game.js (同步)
  ├── require('./phaser-wx-adapter.js')    // 38KB — 设置全局 polyfill
  └── require('./game-bundle.js')          // 7.9MB — adapter再次内联 + Phaser + 游戏代码
      ├── adapter (intro, 再执行一次)
      ├── Phaser 引擎 (~7.8MB)
      └── 游戏代码 (~50KB)
```
