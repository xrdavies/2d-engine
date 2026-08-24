# 2D Engine Architecture

## 1. 定位

本项目是一个基于 WebGPU 的浏览器 2D 游戏运行时引擎，目标是提供可复用的 2D/2.5D 能力，而不是直接实现某一款 SLG、RPG 或完整 3D 引擎。

引擎的验证方式是独立示例和基准场景。验证游戏可以后续接入，但游戏中的建筑、单位、任务、战斗和 UI 内容不进入引擎核心。

当前明确不实现：

- 真 3D mesh、PBR、骨骼 3D 动画和 3D 物理
- WebGL 后端
- 游戏玩法、服务端业务和存档模型
- UI 组件库、布局引擎和主题系统
- 地图编辑器
- 自研 ECS、物理引擎、网络协议和脚本语言

## 2. 总体边界

```text
Browser Platform
  ├── WebGPU Canvas
  ├── DOM input / focus / IME
  ├── Web Audio
  └── WebSocket (optional)

Engine Runtime
  ├── Core Runtime
  ├── Platform and Input
  ├── Interaction Router
  ├── GPU Core
  ├── Renderer2D
  ├── World and Transform2D
  ├── Assets
  ├── Animation
  ├── Audio
  ├── Spatial (optional)
  ├── Tilemap (optional)
  ├── Network Transport (optional)
  └── Diagnostics

Extensions / Game
  ├── UI DOM or UI GPU extension
  ├── Game rules and data
  ├── Map semantics
  ├── Network replication
  └── Content and tools
```

引擎负责通用的时间、资源、输入、交互、渲染和空间能力。引擎不解释“建筑”“单位”“任务目标”等领域对象。

## 3. 核心子系统

### 3.1 Core Runtime

职责：

- 启动和销毁
- `requestAnimationFrame` 驱动
- 固定逻辑步长与渲染帧分离
- 页面隐藏、暂停和恢复
- resize、DPR 和 viewport 通知
- 系统注册和执行顺序
- 可取消的生命周期

逻辑更新使用固定 timestep，渲染使用当前帧和插值。帧 delta 必须限制上限，避免页面切回后出现超长逻辑帧。

### 3.2 Platform and Input

引擎统一浏览器输入源：

- Pointer、鼠标、触摸
- 键盘和 Gamepad
- 滚轮
- 浏览器焦点
- Clipboard（按需）
- IME composition 和 `beforeinput`/`input`

原始事件标准化为引擎事件：

```text
PointerInput
KeyboardInput
TouchInput
CompositionInput
GamepadInput
```

引擎处理设备差异、坐标转换、pointer id、按键状态、modifier、输入取消和 action mapping。文本框、光标、选区和输入法候选框属于 UI 扩展。

### 3.3 Interaction Router

UI 不是交互系统本身，而是交互系统的一个消费者。地图实体、场景节点和未来 UI 控件都可以接入同一套路由。

支持：

- capture / target / bubble 事件传播
- `preventDefault` 和 `stopPropagation`
- pointer capture
- focus scope
- Modal 或输入框的输入优先级
- Canvas 与 DOM 之间的事件消费
- 通用命中测试结果

输入路由顺序：

```text
Modal / focused UI
  -> UI panel
    -> game canvas
      -> game action
```

### 3.4 GPU Core

直接使用 WebGPU 和 WGSL，不建立 WebGL 兼容抽象。

职责：

- adapter/device 初始化
- adapter feature 和 limit 检测
- device lost 和 uncaptured error
- buffer、texture、sampler、shader、pipeline 管理
- bind group 和上传队列
- 资源销毁
- 可选 GPU timing

第一版只依赖 WebGPU 基础能力：render pass、compute pass、buffer、texture、sampler、bind group、WGSL 和基础 blending。`timestamp-query`、subgroups、indirect draw 和 render bundle 都是可选优化，不作为启动条件。

资源对象使用引擎句柄，底层 `GPUDevice` 通过受控的 debug/escape hatch 暴露，而不是让业务代码到处直接管理资源。

### 3.5 Renderer2D

第一版只实现 2D 渲染：

- 正交相机
- Sprite 和纹理图集
- 实例化 quad
- 动态 instance buffer
- alpha blending
- layer / sort key
- scissor 和简单裁剪
- render target（在需要后处理时启用）

典型批处理流程：

```text
RenderItem
  -> 按 pipeline / blend / atlas / layer 排序
  -> 写入 instance buffer
  -> 每个 batch 一次 draw
```

不要每个 Sprite 一次 draw。静态内容可缓存，动态内容独立批处理。Render Graph 延后到出现多个真实渲染 pass 后再实现。

### 3.6 World and Transform2D

第一版使用数字 Entity ID 和简单组件存储，不引入 ECS 库：

```text
EntityId: number
ComponentStore<T>: Map<EntityId, T>
```

渲染热路径再转换为连续 TypedArray。只有基准测试证明 `Map` 或对象分配是瓶颈时，才升级为 sparse set 或 archetype 数据结构。

Transform2D 支持：

- position、rotation、scale
- local/world transform
- 父子层级
- dirty 标记和缓存矩阵
- anchor / pivot

不提前引入四元数和 3D Transform。未来若需要 3D，增加独立 Transform3D，不强迫 2D API 变成 3D API。

### 3.7 Assets

使用浏览器原生能力：

- 图片：`fetch` + `createImageBitmap`
- JSON：`fetch` + `response.json`
- 音频：`AudioContext.decodeAudioData`
- WGSL：文本资源
- 取消：`AbortSignal`

Asset Manager 负责：

- URL/ID 到资源的缓存
- 异步加载和并发控制
- GPU 上传
- 资源错误
- 显式 dispose
- 可选 manifest 和预加载

第一版不做资源数据库、复杂依赖图和编辑器工程文件。

### 3.8 Animation

动画系统与具体渲染器分离：

- AnimationClip
- Track
- Sprite frame animation
- 数值 keyframe
- loop、playback rate、pause
- animation event marker
- 基础 easing

UI 展开、淡入淡出等优先使用 CSS/Web Animations。角色和地图中的可视对象使用引擎 Animation。

### 3.9 Audio

使用 Web Audio API：

- AudioContext 生命周期和用户手势解锁
- 音效和音乐播放
- master、music、sfx bus
- 音量、暂停、恢复
- 简单淡入淡出
- 可选 2D panning

不引入 Howler 等播放封装。空间音频和复杂混音等需求出现后再扩展。

### 3.10 Spatial

第一版提供简单均匀网格或 AABB 查询：

- viewport culling
- 点选查询
- 矩形范围查询
- 邻近对象查询
- chunk 查询

不预先实现 quadtree、R-tree 或 navmesh。通过基准测试确定需要后再替换内部实现。

### 3.11 Tilemap（可选模块）

Tilemap 不属于引擎核心，但可作为通用扩展：

```text
TileLayer
ObjectLayer
ImageLayer
Chunk
Tileset
```

引擎只保存和渲染通用数据，不创建 `Building`、`Unit` 或 `ResourcePoint`。

地图工具建议优先使用 Tiled，通过 importer 转换为内部 `MapAsset`。运行时不直接依赖 Tiled JSON，也不同时支持多个地图格式。

### 3.12 Network Transport（可选模块）

引擎只提供通用传输能力：

- WebSocket 连接
- 收发文本或 ArrayBuffer
- connection state
- timeout 和 reconnect
- message envelope

服务器权威、快照、插值、预测、回滚和业务协议属于游戏层，不进入引擎核心。

### 3.13 UI Bridge（不提供 UI 组件）

引擎提供：

- DOM overlay mount point
- Canvas/DOM 尺寸同步
- screen/world 坐标转换
- UI 输入捕获通知
- focus 和 pointer capture 协作

以下内容延后到 UI 扩展：

- DOM/CSS renderer
- WebGPU UI renderer
- 组件树
- 布局和样式
- Button、Panel、List、Modal
- 文本排版
- 主题和可访问性

UI 扩展可以选择 DOM/CSS 或引擎渲染，但不应改变核心 Input/Interaction API。

## 4. 技术选型

### 必选

| 项目 | 选择 | 说明 |
|---|---|---|
| 语言 | TypeScript | 公共 API、类型和工具链统一 |
| 模块 | ESM | 浏览器原生和现代构建支持 |
| 图形 | WebGPU | 直接访问现代浏览器 GPU 能力 |
| Shader | WGSL | WebGPU 原生着色器语言 |
| 构建 | Vite library mode | 示例、WGSL raw import 和开发服务器 |
| 类型 | `@webgpu/types` | WebGPU TypeScript 类型 |
| 测试 | Vitest + Playwright | CPU 测试和真实浏览器 GPU 测试 |
| 质量 | Biome | 单一 formatter/linter 工具 |

### 运行时第三方依赖

```text
无
```

浏览器原生 API 足以覆盖输入、音频、资源加载、网络和基础 2D 数学。

### 按需引入

| 需求 | 选择 | 引入时机 |
|---|---|---|
| 2D 物理 | Rapier 2D 官方 JS/WASM binding | 游戏玩法确认需要刚体物理后 |
| 地图编辑 | Tiled 外部工具 | 开始制作地图内容后 |
| 纹理图集 | 外部图集工具 | 美术资源流程稳定后 |

明确不引入 PixiJS、Phaser、Three.js、Howler、Socket.IO、RxJS、ECS 库、通用 tween 库和 WGSL 反射库。

## 5. 仓库结构

```text
src/
  core/
  platform/
  input/
  interaction/
  gpu/
  render2d/
  world/
  animation/
  assets/
  audio/
  spatial/
  tilemap/
  net/
  debug/

examples/
  triangle/
  sprites/
  animation/
  audio/
  tilemap/
  benchmark/

tests/
```

示例是引擎验收工具，不是验证游戏。至少保留：Sprite 批处理、动画/音频、Tilemap chunk 和性能基准四个示例。

## 6. 实施阶段

### 阶段 0：工程和 GPU 基础

- TypeScript、Vite、测试和发布配置
- WebGPU 初始化
- feature/limit 检测
- error scope 和 device lost
- Canvas resize/DPR
- 三角形和最小 render pass

验收：设备初始化失败、resize、暂停恢复和 shader 错误都有可见结果。

### 阶段 1：2D 渲染

- Texture、Sampler、Shader、Pipeline
- Sprite 和 atlas
- 实例化 batch
- Camera2D
- layer/sort
- viewport culling
- 基础 benchmark

验收：Sprite 数量增加时，draw 数量按 batch 增长，而不是按 Sprite 数量增长。

### 阶段 2：运行时基础

- World 和 Entity ID
- Transform2D
- Assets
- Input 和 action mapping
- Animation
- Audio
- Interaction Router
- Debug stats

验收：一个不依赖 UI 框架的示例可以移动、动画、播放声音和响应输入。

### 阶段 3：可选通用模块

- Spatial 查询
- Tilemap importer 和 chunk
- UI Bridge
- WebSocket transport
- Worker/OffscreenCanvas 评估

验收：模块可以独立启用，不污染核心 API。

### 阶段 4：稳定化

- 资源释放和内存统计
- 多浏览器 WebGPU smoke test
- 性能基准和回归阈值
- 公共 API 文档
- 包发布和版本策略

## 7. API 约束

公共 API 保持小而稳定：

```text
Engine
Time
World
Assets
Input
Interaction
Audio
Renderer2D
Camera2D
```

游戏层可以获取必要的只读状态和扩展点，但不直接接管 GPU 资源生命周期。引擎内部实现可以变化，公共 API 不应暴露尚未稳定的 ECS、Render Graph 或 UI 组件抽象。

## 8. 验收标准

引擎第一阶段不以完整游戏为验收标准，而以以下能力为准：

- WebGPU 正确初始化和恢复
- 2D Sprite 批处理有效
- 资源加载、缓存和释放可观察
- 固定 timestep 稳定
- 动画和音频独立工作
- 输入、焦点、IME 和事件路由有明确行为
- Tilemap 作为可选模块工作
- UI 扩展不需要修改核心渲染器
- 有浏览器 smoke test 和可重复性能基准

