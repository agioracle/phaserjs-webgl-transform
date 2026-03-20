# 微信小游戏真机菜单点击无响应问题分析与修复建议

## 背景

在 `Snake` 项目中，上一轮真机启动报错已经修复，当前新现象是：

- 真机运行时 **不再报错**
- `MenuScene` 能正常显示
- 但点击 `Tap to Play` **没有反应**，无法进入 `GameScene`

这说明问题已经从“启动期异常”转变为“输入交互命中异常”。

## 结论摘要

当前高置信度判断：

> **真机触摸事件大概率已经进入 Phaser，但 `Tap to Play` 这个 `Text` 对象的 hit-test 失败了。**

换句话说，更像是：

- **不是整个 touch 系统坏了**
- 而是 **对象级 `setInteractive()` 命中区域与真实触摸坐标不一致**

因此按钮看得见，但点击没有命中，自然不会触发 `scene.start('GameScene')`。

## 关键证据

### 1. 菜单开始逻辑完全依赖对象级点击

当前 `MenuScene` 的开始流程绑定在文本按钮上：

- `btn.setInteractive({ useHandCursor: true })`
- `btn.on('pointerdown', ...)`

这意味着只有按钮本身被正确命中时，游戏才会开始。

### 2. `GameScene` 使用的是场景级输入

`GameScene` 中的输入处理基于：

- `this.input.on('pointerdown', ...)`
- `this.input.on('pointerup', ...)`

这类方式通常不依赖某个显示对象的精确命中，因此更能容忍坐标换算误差。

### 3. 适配层存在坐标系不一致风险

当前小游戏适配层中：

- 触摸桥接使用 `clientX` / `clientY`
- canvas 的 DOM 尺寸模拟依赖 `style.width/height`
- `getBoundingClientRect()`、`offsetWidth/offsetHeight` 也参与 Phaser 输入换算

如果：

- 触摸坐标采用的是显示尺寸语义
- 但 canvas DOM 尺寸上报采用的是 backing-store 或逻辑尺寸语义

那么对象 hit-test 就容易偏移。

### 4. 当前游戏是固定逻辑尺寸，未做缩放收敛

当前产物配置中使用：

- `width: 750`
- `height: 1334`
- `scale.mode: Phaser.Scale.NONE`
- `autoCenter: Phaser.Scale.NO_CENTER`

在高 DPR 真机上，这种配置更容易暴露“显示尺寸”和“输入坐标参考尺寸”不一致的问题。

## 根因判断

### 根因一：菜单入口过度依赖 `Text.setInteractive()`

`MenuScene` 把“开始游戏”完全寄托在文本对象命中上。

这在浏览器或开发者工具中通常可行，但在小游戏真机里，一旦适配层坐标转换存在偏差，文本按钮会首先失效。

### 根因二：适配层对显示尺寸与命中参考尺寸的建模可能不一致

小游戏 canvas 不是标准浏览器 DOM，适配层需要自行补齐：

- `style`
- `getBoundingClientRect()`
- `offsetWidth / offsetHeight`
- 触摸事件桥接

如果这些能力对“尺寸”的理解不一致，就会导致 Phaser 在 pointer 坐标换算和对象命中时出现误差。

## 为什么真机没有报错却点不动

这类问题的典型特点就是：

- 无异常堆栈
- 画面正常
- 触摸链路不一定彻底中断
- 但对象没有被命中

因此它更像是一个 **输入坐标 / hit-test 对齐问题**，而不是新的运行时崩溃问题。

## 修复建议

建议分成两层处理：

## 方案 A：先做业务层最小修复，立即恢复可玩

### 核心思路

不要只把开始游戏绑定在按钮对象上，而是增加 **场景级输入兜底**：

- 按钮保留视觉效果
- 按钮事件保留，方便开发者工具中交互
- 同时在 `MenuScene` 上注册 `this.input.on('pointerup', startGame)`
- 增加 `_starting` 或等价标志，防止重复进入场景
- 可将文案改成 `Tap Anywhere to Play`

### 好处

- 不依赖对象级 hit-test 是否精准
- 只要真机 touch 能进入 Phaser，菜单就能开始游戏
- 改动小、验证快、风险低

### 适用定位

这是 **止血方案**，优先级应为 **P0**。

## 方案 B：再做适配层根修，修复所有 `setInteractive()` 场景

### 核心思路

检查并统一 adapter 中以下能力对“显示尺寸”的定义：

- `canvas.style.width / height`
- `canvas.getBoundingClientRect()`
- `canvas.offsetWidth / offsetHeight`
- 触摸桥接中的坐标语义

建议这些值返回 **显示尺寸**，而不是直接把 `canvas.width / height` 当作 CSS 尺寸上报。

### 目标

让以下两类信息处于同一坐标系：

- 用户真实触摸位置
- Phaser 进行 hit-test 时使用的 canvas 显示边界

### 预期收益

- 修复 `Text.setInteractive()` 命中异常
- 修复后续 `Zone`、HUD、按钮等 UI 组件的交互问题
- 从根上收敛小游戏真机输入映射偏差

### 适用定位

这是 **根修方案**，优先级应为 **P1**。

## 推荐执行顺序

1. **先落地方案 A**：让菜单任意点击都能进入游戏
2. 真机验证是否能稳定进入 `GameScene`
3. 再落地方案 B：修 adapter 的显示尺寸与输入映射
4. 回归验证所有 `setInteractive()` 交互组件

## 验证建议

修复后应重点验证：

- 菜单任意点击是否能进入 `GameScene`
- `GameScene` 中滑动转向是否正常
- 文本按钮是否仍可在开发者工具中点击
- 后续对象级交互组件是否命中正常

## 最终建议

**优先先做方案 A，保证游戏可玩；再做方案 B，从适配层统一修复坐标映射问题。**

## 一句话总结

这不是新的真机报错，而是一个典型的：

> **触摸事件已进入系统，但对象级交互命中因坐标系不一致而失败**

对于小游戏适配层来说，业务层应提供兜底交互，适配层则应确保 **显示尺寸、触摸坐标、hit-test 参考尺寸三者一致**。
