# 给 `phaser-wx build` 添加 `--target h5` 支持

## Context

当前 `phaser-wx build` 只能输出微信小游戏格式（CJS + adapter + 分包 + game.js）。需要支持 H5 浏览器构建，让同一套游戏源码可以同时发布到微信小游戏和 Web 平台。

核心策略：**在现有 `build` 命令上加 `--target wx|h5` 参数**（默认 `wx`），~70% 构建逻辑可复用。

## 改动范围

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/cli/src/index.ts` | 修改 | build 命令添加 `--target` option |
| `packages/cli/src/commands/build.ts` | 修改 | 核心：按 target 分支构建逻辑 |
| `packages/rollup-plugin/src/index.ts` | 修改 | options 加 target，generateBundle 分支 |
| `packages/rollup-plugin/src/output/h5-project.ts` | **新建** | 生成 index.html |

**不改动**：splitter.ts、manifest.ts、config.ts、new.ts、adapter、游戏源码。

---

## 实现步骤

### Step 1: CLI 入口 — 添加 `--target` option

**`packages/cli/src/index.ts`** — build command 加 `.option('--target <platform>', 'Build target: wx or h5', 'wx')`

**`packages/cli/src/commands/build.ts`** — `BuildOptions` 加 `target?: 'wx' | 'h5'`

### Step 2: build.ts — H5 构建主逻辑

在 `buildCommand()` 开头加 `const isH5 = options.target === 'h5'`，然后 6 个分支点：

#### 2a. 输出目录 — H5 用 `dist-h5/`

```typescript
const outputDir = isH5 ? 'dist-h5' : config.output.dir;
```

#### 2b. 跳过 adapter（L85-117）

```typescript
if (!isH5 && adapterPath && fs.existsSync(adapterPath)) { /* 现有逻辑 */ }
```

#### 2c. intro 代码分支（L119-192）

- **wx**: 保持现有（GameGlobal 别名 + `wx.getFileSystemManager` 读 manifest）
- **h5**: 精简版 remote asset loader，用同步 `XMLHttpRequest` 读 manifest（逻辑和 wx 版几乎一样，只是读取方式不同，不需要 GameGlobal/wx 引用）

提取为两个函数：`buildWxIntro()` / `buildH5Intro()`

#### 2d. H5 入口生成 + Bundle（替代 L197-342 的 wx 构建流程）

**核心问题**：H5 需要所有场景打入单 bundle，且运行时注册到 Phaser。当前源码中 `main.js` 只注册 BootScene，其他场景通过 `wx.loadSubpackage` + `scene.add()` 动态加载。

**方案**：构建时生成临时包装入口 `_h5_entry.js`：
1. 读 `main.js` 源码
2. 从 `config.subpackages` 获取每个子包的 entry 文件
3. 用正则从每个 entry 提取 `export class XXX`（场景类名）
4. 在 main.js 顶部追加 `import { XXX } from './sub-entry';`
5. 在 `scene: [BootScene]` 中追加所有场景类名 → `scene: [BootScene, MenuScene, GameScene]`
6. 写入临时文件 `_h5_entry.js`，作为 rollup input
7. 构建完成后删除临时文件

rollup 配置：
```typescript
format: 'iife', name: 'PhaserGame', strict: false
```

不做 manualChunks（单文件），esbuild 压缩，输出 `game.js`。

#### 2e. 跳过分包构建（L253-342）

H5 模式完全跳过 subpackage build 循环。

#### 2f. 资产处理 — 复用 splitAssets + generateManifest

复用现有逻辑。H5 和 wx 都需要 asset-manifest.json 支持 CDN。本地资产复制到 `dist-h5/assets/`，远程资产复制到 `dist-h5/remote/`。

Size check 部分：H5 跳过 20MB 限制检查，只输出构建摘要。

### Step 3: rollup-plugin — target 透传

**`packages/rollup-plugin/src/index.ts`**：
- `PhaserWxTransformOptions` 加 `target?: 'wx' | 'h5'`
- `generateBundle` 中：wx 调 `generateWxProject()`，h5 调 `generateH5Project()`

### Step 4: 新建 h5-project.ts

**`packages/rollup-plugin/src/output/h5-project.ts`**：

生成 `index.html`：
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
  <title>Phaser Game</title>
  <style>
    * { margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    canvas { display: block; margin: 0 auto; }
  </style>
</head>
<body>
  <script src="game.js"></script>
</body>
</html>
```

### Step 5: 重建 CLI

```bash
pnpm run build
```

---

## 验证

1. `phaser-wx build` → 输出 `dist-wx/`，行为不变（回归测试）
2. `phaser-wx build --target h5` → 输出 `dist-h5/`：
   - `index.html` + `game.js`（IIFE）+ `asset-manifest.json` + `assets/` + `remote/`
3. FlappyBird: `phaser-wx build --target h5 && npx serve dist-h5` → 浏览器可玩
4. Snake: 同上验证
