# 微信小游戏真机启动报错问题分析与修复方案

## 背景

当前项目在 **微信开发者工具预览正常**，但在 **真机运行** 时出现启动阶段报错，导致游戏无法正常完成初始化。

本问题不是 Phaser 业务逻辑本身异常，而是 **小游戏运行环境适配层（adapter/polyfill）与真机宿主环境之间的兼容性缺陷**。

## 问题概述

### 真机报错 1

```text
SystemError (appServiceSDKScriptError)
Can't find variable: setTimeout
```

### 真机报错 2

```text
MiniProgramError
this.canvas.removeEventListener is not a function
```

### 影响

- 启动流程在真机上被阻断
- Phaser 初始化依赖的宿主能力不完整
- 问题属于 **P0 级启动阻塞问题**

## 结论摘要

本次问题有两个高置信度根因：

1. **adapter 中存在裸全局 `setTimeout` 调用**，真机环境下不保证可作为自由变量访问。
2. **当项目复用预创建的 `GameGlobal.__wxCanvas` 时，没有为该 canvas 补齐 DOM 风格事件能力**，导致 `removeEventListener` 缺失。

此外，微信开发者工具没有复现，主要是因为其运行时比真机更宽松：

- 对全局变量解析更宽松
- 对 canvas 的浏览器相似度更高
- 宿主注入和启动时序与真机不完全一致

## 证据链

### 证据 1：启动阶段预先创建并复用主 Canvas

项目启动时会先创建画布并写入 `GameGlobal.__wxCanvas`：

- `Snake/dist-wx/game.js`

其作用是将主 canvas 提前准备好，供后续 Phaser 启动时复用。

随后 Phaser 配置又显式使用该 canvas：

- `Snake/dist-wx/game-bundle.js`

也就是说，Phaser 初始化时拿到的不是 adapter 内新建的 canvas，而是 **外部预创建并缓存到 `GameGlobal.__wxCanvas` 的实例**。

### 证据 2：已有 Canvas 分支提前返回，未执行补丁逻辑

在 adapter 的 `packages/adapter/src/polyfills/canvas.js` 中，`createPrimaryCanvas()` 对 `GameGlobal.__wxCanvas` 做了复用判断。

当前逻辑的问题是：

- 如果检测到 `GameGlobal.__wxCanvas` 已存在
- 会直接返回这个 canvas
- 但没有执行以下兼容补丁：
  - `addEventSupport(canvas)`
  - `wrapGetContext(canvas, true)`
  - `addDomSupport(canvas)`
  - `bridgeTouchEvents(canvas)`

因此，这个被复用的 canvas 可能缺失：

- `addEventListener`
- `removeEventListener`
- `dispatchEvent`

当 Phaser 后续按 DOM canvas 的方式调用 `this.canvas.removeEventListener(...)` 时，就会在真机报错。

### 证据 3：audio polyfill 中存在裸 `setTimeout`

在 `packages/adapter/src/polyfills/audio.js` 中，`load()` 存在类似如下逻辑：

```js
load() {
  if (this._inner.src) {
    setTimeout(() => this._emit('canplaythrough'), 0);
  }
}
```

这里直接使用了自由变量 `setTimeout`。

但在微信小游戏真机环境里，虽然宿主通常提供定时器能力，**却不保证它一定能以浏览器那种“裸全局变量”方式被访问到**。因此在真机上可能出现：

```text
Can't find variable: setTimeout
```

### 证据 4：工程中其实已经有安全 timer 绑定思路

在 `packages/adapter/src/polyfills/window.js` 中，已经能看到通过宿主对象显式绑定 timer 的写法，例如：

- `setTimeout: _gScope.setTimeout.bind(_gScope)`
- `clearTimeout: _gScope.clearTimeout.bind(_gScope)`

这说明项目已经意识到：

- 真机环境下应优先使用 **绑定后的安全引用**
- 不应依赖自由变量解析

但该约束没有在 `audio.js` 中保持一致。

### 证据 5：入口层尚未显式把 timer 统一挂到全局

在 `packages/adapter/src/index.js` 中，当前尚未形成一套统一、显式、幂等的 timer 全局注入策略（如通过 `safeSet` 将 `setTimeout`、`clearTimeout` 等写到 `GameGlobal` / `globalThis`）。

这进一步放大了真机环境差异带来的风险。

## 根因分析

## 根因一：裸全局 `setTimeout` 在真机环境不可依赖

### 本质

小游戏真机不是标准浏览器环境。即使宿主具备定时器能力，也未必保证：

- `setTimeout` 可直接作为自由变量访问
- 不经绑定就拥有稳定的 `this` 指向
- 在所有机型、基础库版本上表现一致

### 直接后果

`audio.js` 中的裸 `setTimeout(...)` 在真机触发时报错，导致启动链路中断。

### 风险等级

**高**。因为这是启动期执行逻辑，失败会直接阻止资源或音频相关流程继续。

## 根因二：复用已有 Canvas 时未做幂等补丁

### 本质

当前 adapter 假设：

- 如果自己创建 canvas，就为其打补丁
- 如果外部已经创建好 canvas，就可以直接复用

但这个假设不成立。因为：

- 外部创建的 `wx.createCanvas()` 只是原生 canvas
- 它并不天然具备 DOM 风格事件接口
- Phaser 却会按浏览器 canvas 约定去使用这些接口

### 直接后果

`removeEventListener` 缺失，Phaser 在真机初始化或切换监听逻辑时直接报错。

### 风险等级

**高**。这是渲染主对象能力缺失，属于核心适配错误。

## 为什么开发者工具没有报错

开发者工具正常、真机报错，并不意味着代码没问题，而更像是 **开发者工具帮你“兜住了”问题**。

### 原因 1：全局变量解析更宽松

开发者工具通常会把一些常见全局能力暴露得更接近浏览器环境，因此裸 `setTimeout` 可能刚好可以运行。

但真机环境不应依赖这一点。

### 原因 2：Canvas 对 DOM 能力的模拟更强

开发者工具中的 canvas 对象往往比真机更接近浏览器 `HTMLCanvasElement`，可能已经具备或模拟了部分事件接口，因此没有立刻暴露 `removeEventListener` 缺失问题。

### 原因 3：宿主注入顺序与真机不同

开发者工具和真机在以下方面可能不同：

- 全局对象挂载时机
- 运行容器初始化顺序
- 对第三方适配层的兼容行为

因此某些“依赖时序凑巧成立”的代码，在开发者工具中能跑，在真机上就会失败。

### 结论

**开发者工具可运行不能作为真机兼容性的充分证据。**

对小游戏适配层而言，应始终以 **真机宿主能力边界** 为准进行实现。

## 修复方案

建议按 **先止血、后收敛、再增强** 的顺序处理。

## 方案一：修复 `canvas.js`，确保已有 `__wxCanvas` 也会被补丁化

### 目标

无论主 canvas 是：

- adapter 内部新建
- 还是业务入口预创建并缓存到 `GameGlobal.__wxCanvas`

都必须被统一补丁成 Phaser 可用的“类 DOM canvas”。

### 建议修改点

文件：`packages/adapter/src/polyfills/canvas.js`

将 `createPrimaryCanvas()` 改为：

1. 先拿到 canvas：优先复用 `GameGlobal.__wxCanvas`，否则调用 `wx.createCanvas()`
2. 对该 canvas 执行一次幂等补丁
3. 再写回 `GameGlobal.__wxCanvas`
4. 返回补丁后的 canvas

### 建议实现原则

- **幂等**：重复调用不应重复包装或重复绑定
- **统一路径**：无论 canvas 来源如何，最终走同一套补丁逻辑
- **低侵入**：尽量不改变外部启动流程

### 推荐设计

可增加标记位，例如：

- `canvas.__phaserPatched = true`

伪代码：

```js
export function createPrimaryCanvas() {
  const canvas =
    typeof GameGlobal !== 'undefined' && GameGlobal.__wxCanvas
      ? GameGlobal.__wxCanvas
      : wx.createCanvas();

  if (!canvas.__phaserPatched) {
    addEventSupport(canvas);
    wrapGetContext(canvas, true);
    addDomSupport(canvas);
    bridgeTouchEvents(canvas);
    canvas.__phaserPatched = true;
  }

  if (typeof GameGlobal !== 'undefined') {
    GameGlobal.__wxCanvas = canvas;
  }

  return canvas;
}
```

### 预期收益

- 修复 `removeEventListener is not a function`
- 解决预创建 canvas 与 adapter 补丁路径割裂的问题
- 为后续更多 DOM-like 能力扩展打基础

## 方案二：修复 `audio.js`，禁止裸用 `setTimeout`

### 目标

所有 timer 能力都使用：

- `window.setTimeout`
- 或显式绑定后的安全引用
- 或统一从 `GameGlobal/globalThis` 注入后的对象读取

### 建议修改点

文件：`packages/adapter/src/polyfills/audio.js`

将裸调用：

```js
setTimeout(() => this._emit('canplaythrough'), 0);
```

替换为安全调用，例如：

```js
window.setTimeout(() => this._emit('canplaythrough'), 0);
```

如果不希望依赖 `window`，也可以在模块级封装安全 timer 获取逻辑，再统一使用。

### 推荐原则

- **不要依赖自由变量**
- **不要假设宿主总是浏览器**
- **对所有 polyfill 文件保持一致写法**

### 预期收益

- 修复 `Can't find variable: setTimeout`
- 降低真机、基础库版本、不同容器实现差异带来的不确定性

## 方案三：在 `index.js` 中统一注入安全 timer（增强项）

### 目标

在 adapter 初始化阶段，显式将定时器能力稳定挂到统一全局上，避免各 polyfill 文件各自“猜测”如何访问宿主能力。

### 建议修改点

文件：`packages/adapter/src/index.js`

通过类似 `safeSet` 的机制，统一挂载：

- `setTimeout`
- `clearTimeout`
- `setInterval`
- `clearInterval`
- `requestAnimationFrame`
- `cancelAnimationFrame`

### 建议价值

这是一个 **增强稳定性** 的措施，不一定是最小修复必需项，但非常值得做，因为它能：

- 收敛不同 polyfill 的调用方式
- 降低未来新增模块继续踩同类坑的概率
- 明确 adapter 的“受控全局能力边界”

## 修复优先级建议

### P0：立即修复

1. `packages/adapter/src/polyfills/canvas.js`
2. `packages/adapter/src/polyfills/audio.js`

这两项直接对应当前真机启动报错，应优先落地。

### P1：同轮补强

3. `packages/adapter/src/index.js` 的 timer 统一注入

### P2：后续防回归

4. 增加真机导向的适配回归用例或构建后检查脚本
5. 梳理其余 polyfill 中是否还存在裸全局调用

## 推荐的落地策略

可以分两层修：

### 路径 A：从 SDK 源码根修

适用场景：

- 希望问题从根上解决
- 后续所有基于该 adapter 的项目都受益

建议直接修改：

- `packages/adapter/src/polyfills/canvas.js`
- `packages/adapter/src/polyfills/audio.js`
- `packages/adapter/src/index.js`

**优点**：

- 方案干净
- 可长期维护
- 避免项目层重复热修

### 路径 B：对当前项目做最小热修

适用场景：

- 需要先快速恢复当前项目真机可运行
- 暂时无法立即重发 adapter 包

可在生成产物或项目入口层做临时补丁：

- 启动前为 `GameGlobal.__wxCanvas` 手动补齐事件方法
- 显式把安全 timer 写到可访问全局

**缺点**：

- 容易形成项目特例
- 后续维护成本更高
- 不适合作为最终方案

### 建议

**优先选择路径 A，路径 B 仅作为临时止血。**

## 验证方案

修复后建议按以下顺序验证。

### 1. 基础验证

- 重新构建小游戏产物
- 在微信开发者工具中确认启动正常
- 在至少一台真机上验证启动

### 2. 关键验证点

#### Timer 相关

确认真机启动时不再出现：

```text
Can't find variable: setTimeout
```

#### Canvas 相关

确认真机启动时不再出现：

```text
this.canvas.removeEventListener is not a function
```

#### 渲染与输入相关

确认以下能力正常：

- Phaser 正常创建游戏实例
- 主场景可进入
- 触摸事件可响应
- WebGL / Canvas 上下文创建正常

### 3. 回归验证

额外检查：

- 音频加载事件是否按预期触发
- canvas 事件桥接是否正常
- 重复初始化时不会因重复补丁产生副作用

## 风险与注意事项

### 风险 1：重复补丁导致副作用

如果 `addEventSupport()`、`wrapGetContext()` 等逻辑不是幂等的，直接重复执行可能带来：

- 事件监听重复注册
- 方法被重复包裹
- 上下文对象行为异常

因此在实现时必须增加明确标记位。

### 风险 2：只修产物、不修源码

如果仅在 `dist-wx` 层热修，而不修改 adapter 源码，则后续重新构建后问题可能再次出现。

### 风险 3：同类问题可能不止一处

既然已经发现 `audio.js` 中存在裸 `setTimeout`，理论上其余 polyfill 也可能存在类似问题。建议后续统一排查：

- 裸 `setTimeout`
- 裸 `clearTimeout`
- 裸 `setInterval`
- 裸 `requestAnimationFrame`
- 对 `document/window/canvas` 能力的隐式假设

## 最终建议

当前问题的最佳修复顺序为：

1. **先修 `canvas.js` 的已有 canvas 补丁缺失问题**
2. **再修 `audio.js` 的裸 `setTimeout` 问题**
3. **随后在 `index.js` 中统一收敛 timer 注入策略**
4. **最后补一轮真机导向回归检查，避免同类问题再次出现**

## 一句话总结

这不是“真机偶发异常”，而是一个典型的 **小游戏适配层对真机宿主能力假设过强** 的问题：

- 一处体现在 **裸用全局 timer**
- 一处体现在 **复用已有 canvas 时漏打补丁**

只要把这两条链路修正为 **显式、统一、幂等** 的适配方式，问题就能稳定收敛。
