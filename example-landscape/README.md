# phaser-wx-example (landscape)

Example Phaser.js 3.x FlappyBird game (landscape) for WeChat Mini-Game, built with `phaser-wx`.

This project serves as both a development/test target and the source template for `phaser-wx new` (landscape orientation).

## Getting Started

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Build for WeChat Mini-Game
npm run build
```

## Scene Flow

```
game.js  ──→  BootScene  ──→  MenuScene  ──→  GameScene
(闪屏+引擎下载)  (加载资源+下载menu分包)  (加载资源+预下载game-play)  (游戏)
```

1. **game.js** — "Made with Phaser" 闪屏（渐显 + 呼吸灯），同时异步下载 engine 分包
2. **BootScene** — Phaser 加载画面（进度条），加载 game_logo，并行下载 menu 分包
3. **MenuScene** — 标题界面 + Start 按钮，加载 bgm，预下载 game-play 分包
4. **GameScene** — FlappyBird 游戏（小鸟、管道、计分）

## Subpackage Structure

本示例使用分包机制，将 Phaser 引擎和各场景拆分为独立加载的包，主包体积约 50KB：

| 分包 | 内容 | 说明 |
|------|------|------|
| 主包 | game.js + adapter + game-bundle.js | 闪屏 + BootScene |
| `engine/` | phaser-engine.min.js | Phaser 引擎（esbuild 压缩） |
| `menu/` | menu-scene.js | MenuScene 代码 |
| `game-play/` | game-scene.js + assets/ | GameScene 代码 + 本地资源 |

分包配置在 `phaser-wx.config.json` 的 `subpackages` 字段中声明。

### Asset Distribution

| 资源 | 存放位置 | 加载方式 |
|------|----------|----------|
| `game_logo.png` | `public/remote-assets/images/` | CDN 远程加载 |
| `bgm.mp3` | `public/remote-assets/audio/` | CDN 远程加载 |
| `bird.png` | `public/assets/images/` | 构建时自动复制到 `game-play/` 分包 |
| `bird_hit.mp3` | `public/assets/audio/` | 构建时自动复制到 `game-play/` 分包 |

- `remote-assets/` 下的资源始终从 CDN 加载，不打包进小游戏
- `assets/` 下的资源由构建工具根据场景引用自动复制到对应分包目录

## Project Structure

```
src/
  main.js              Entry point — only registers BootScene
  scenes/
    BootScene.js       Loading screen + downloads menu subpackage
    MenuScene.js       Title screen + preloads game-play subpackage
    GameScene.js       FlappyBird game scene
  utils/
    safe-area.js       Safe area helper for notch devices
public/
  assets/              Local assets (auto-copied to subpackage dirs at build time)
    images/
    audio/
  remote-assets/       Remote assets (loaded from CDN, never bundled)
    images/
    audio/
phaser-wx.config.json  Build configuration (includes subpackages)
```
