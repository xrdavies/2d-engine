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

3D 只保留未来独立扩展的可能，不进入当前目标、目录、公共 API、示例、依赖或验收标准。未来若重新立项，应单独进行架构评审；当前不为 3D 提前创建模块。

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
  ├── Text2D
  ├── World and Transform2D
  ├── Assets
  ├── Animation
  ├── Audio
  ├── Spatial (optional)
  ├── Tilemap (optional)
  ├── Network (optional)
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
- Wheel
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

带初始 data 的 Buffer/Texture 默认不缓存，避免相同 descriptor 复用不同内容；需要缓存时由调用方显式提供 `cache: true` 或 `cacheKey`。`GpuContext.withErrorScope()` 用于捕获 validation/out-of-memory/internal 错误。

设备丢失后，Engine 进入 `device-lost` 状态并停止帧循环。调用 `Engine.recreate()` 可重新创建 device 和 runtime；外部资源/Renderer 实例需要由上层按资源描述重新创建。

### 3.5 Renderer2D

Renderer2D 是通用 2D 绘制层，不等同于 Sprite Renderer。它负责组织 render pass、相机、排序、裁剪和批处理，不负责加载资源、推进动画或排版文字。

第一版支持：

- 正交相机
- Image2D、Sprite 和纹理图集
- 实例化 quad
- 动态 instance buffer
- alpha blending
- layer / sort key
- scissor 和简单裁剪
- render target（在需要后处理时启用）

内部以 TexturedQuad 作为主要渲染原语：

```text
TexturedQuad
  texture
  uv
  transform
  size
  anchor
  color
  layer / sort key
```

普通图片使用完整 UV 的 Image2D；Sprite 使用纹理图集中的局部 UV 和 frame 信息；Tilemap 会生成大量同类 quad。它们共享同一个批处理器，不需要为“普通图片”和“Sprite”维护两条 GPU 渲染路径。

```text
Image2D ───────────────┐
Sprite -> atlas frame ─┼─> TexturedQuad Batch -> Renderer2D
Tilemap -> chunk data ─┘
```

Image2D 只描述当前图片的绘制状态。Sprite 在 Image2D 之上增加 atlas frame 语义，但不保存播放时间、循环状态或动画状态机。

典型批处理流程：

```text
RenderItem
  -> 按 pipeline / blend / atlas / layer 排序
  -> 写入 instance buffer
  -> 每个 batch 一次 draw
```

不要每个 Image2D 或 Sprite 一次 draw。静态内容可缓存，动态内容独立批处理。Render Graph 延后到出现多个真实渲染 pass 后再实现。

`Renderer2D.render(..., { staticItems: true })` 会缓存静态数组的排序结果；内容变化后调用 `invalidateStatic()`。

`targetView` 可将相同 pipeline format 的内容渲染到离屏 texture；`createRenderTarget()` 创建兼容的 render attachment。

### 3.6 Text2D

文字排版和字形生成不放入 Renderer2D，但 Text2D 是引擎自带的 2D 能力。它负责把文字转换为 Renderer2D 可以批量绘制的纹理 quad。

Text2D 分为三个步骤：

```text
TextLayout
  -> line/segment positions
TextRasterizer
  -> glyph/text-run pixels
TextAtlas
  -> TexturedQuad Batch -> Renderer2D
```

第一版的 rasterizer 使用浏览器原生字体能力：

- `FontFace` 加载字体
- Canvas2D 或 OffscreenCanvas 栅格化 text run
- 将结果缓存到 text atlas
- 生成一个或多个 TexturedQuad
- Renderer2D 负责最终绘制

测量和换行使用可替换的 TextLayout 后端。简单单行文字可以直接使用 Canvas `measureText()`；多语言、多行、虚拟列表和频繁 resize 场景使用可选的 `@chenglou/pretext`。Pretext 只负责测量、断行和行范围，不负责字体栅格化、文字图集或 WebGPU 绘制。

第一版优先缓存完整 text run，让浏览器处理 CJK、ligature 和复杂字体组合，避免立即引入自研 shaping 或逐 glyph 布局。大量动态数字或需要连续缩放时，再增加数字图集或 SDF/MSDF 字体路径。

Text2D 面向世界文字、地图标签、飘字和 debug label。DOM UI 中的按钮、列表、输入框和正文仍由 UI 扩展负责，不通过 Text2D 绘制。IME 和文本编辑也不属于 Text2D。

TextAtlas 使用共享多页缓存 text run；每个 entry 记录 page 和 UV，`Text2D.createTexture()` 返回对应页的 GPU texture。Atlas 支持 remove、maxEntries LRU、`clearScene()` 和 page/occupancy/hit-rate 统计。布局后端缓存 prepared text，宽度变化只重新执行 layout。

未显式传入 atlas 的 Text2D 使用共享 `defaultTextAtlas`。`toQuad()` 会 retain entry，并返回带 `dispose()` 的 TextQuad；LRU 只淘汰未被活跃 quad 引用的 entry。

动态数字使用 `NumericTextAtlas` 的固定字形集合组合 quad，不为每个完整数字字符串创建缓存条目。

### 3.7 World and Transform2D

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

不提前引入四元数和 3D Transform。未来若重新立项，可增加独立 Transform3D，不强迫 2D API 变成 3D API。

World 在每个 fixed step 前保存 Transform2D 前态，并通过 `extractInterpolatedRenderItems()` 和 interpolation alpha 提供平滑渲染状态。

### 3.8 Assets

使用浏览器原生能力：

- 图片：`fetch` + `createImageBitmap`
- 字体：`FontFace`
- JSON：`fetch` + `response.json`
- 音频：`AudioContext.decodeAudioData`
- WGSL：文本资源
- 取消：`AbortSignal`

资源加载和 HTTP 请求都使用浏览器 Fetch API。Asset Manager 负责资源语义；网络模块只提供薄的请求封装，不重复实现 HTTP 协议。

Asset Manager 负责：

- URL/ID 到资源的缓存
- 异步加载和并发控制
- GPU 上传
- 资源错误
- 显式 dispose
- 可选 manifest 和预加载

`uploadImage()` 可将 ImageBitmap/Canvas 上传为 GPU texture；网络请求复用 Fetch 的取消和 timeout 语义。

内建 loader 使用 image/json/text/audio/font/gpu 独立缓存命名空间，避免同一 URL 的不同资源类型互相覆盖。

第一版不做资源数据库、复杂依赖图和编辑器工程文件。

### 3.9 Animation

动画系统与具体渲染器分离：

- AnimationClip
- Track
- Sprite frame animation
- 数值 keyframe
- loop、playback rate、pause
- animation event marker
- 基础 easing

Sprite 只保存当前 frame/UV，Animator 保存播放时间和状态。Sprite animation binding 负责将采样结果写回 Sprite：

```text
Time
  -> AnimationSystem
  -> SpriteAnimationBinding
  -> Sprite.frame / uv
  -> Renderer2D
```

第一版只实现 AnimationPlayer、SpriteFrameClip、SpriteAnimationBinding 和动画事件。Transform、颜色等 Track 在出现第二个实际动画目标后再增加，不提前实现属性反射、状态机或 Blend Tree。

UI 展开、淡入淡出等优先使用 CSS/Web Animations。角色和地图中的可视对象使用引擎 Animation。

### 3.10 Audio

使用 Web Audio API：

- AudioContext 生命周期和用户手势解锁
- 音效和音乐播放
- master、music、sfx bus
- 音量、暂停、恢复
- 简单淡入淡出
- 可选 2D panning

不引入 Howler 等播放封装。空间音频和复杂混音等需求出现后再扩展。

### 3.11 Spatial

第一版提供简单均匀网格或 AABB 查询：

- viewport culling
- 点选查询
- 矩形范围查询
- 邻近对象查询
- chunk 查询

不预先实现 quadtree、R-tree 或 navmesh。通过基准测试确定需要后再替换内部实现。

### 3.12 Tilemap（可选模块）

Tilemap 不属于引擎核心，但可作为通用扩展：

```text
TileLayer
ObjectLayer
ImageLayer
Chunk
Tileset
```

引擎只保存和渲染通用数据，不创建 `Building`、`Unit` 或 `ResourcePoint`。

TilemapRuntime 将 dense layer 或 Tiled infinite chunks 切成 runtime chunks，支持 load/unload、dirty rebuild、可见 chunk 裁剪、ImageLayer 和正交/等距坐标转换。chunk 只输出 TexturedQuad，不解释游戏对象。

异步 Tiled importer 还支持外部 tileset、CSV/base64、gzip/deflate 数据；Tiled `zlib` 映射为原生 `deflate`。zstd 运行时解压不受当前浏览器原生 API 支持，importer 会给出明确错误，内容构建阶段应转换为 zlib 或 gzip。hexagonal/staggered 提供基础投影坐标转换。

地图工具建议优先使用 Tiled，通过 importer 转换为内部 `MapAsset`。运行时不直接依赖 Tiled JSON，也不同时支持多个地图格式。

### 3.13 Network（可选模块）

网络模块包含两种互补的传输：

HTTP request/response：

- 原生 `fetch`
- `AbortSignal` 取消
- timeout
- HTTP status 检查
- headers、JSON、文本和 ArrayBuffer 响应
- 可选的请求 ID 和基础日志

WebSocket realtime transport：

- WebSocket 连接
- 收发文本或 ArrayBuffer
- connection state
- timeout 和 reconnect
- message envelope

HTTP 适合启动配置、登录、资源元数据、存档和非实时命令；WebSocket 适合服务器推送、实时事件和长连接状态变化。

服务器权威、鉴权流程、API 路径、序列化 schema、快照、插值、预测、回滚和业务协议属于游戏层，不进入引擎核心。引擎不引入 axios、ky、Socket.IO 等网络封装库。

WebSocketTransport 提供连接超时、受控重连、Blob 归一化和 `MessageEnvelope`；FakeTransport 使用同一 `MessageTransport` 接口供测试和本地模拟。

并发 `connect()` 复用同一个连接 Promise，不重复创建 socket。

### 3.14 UI Bridge（不提供 UI 组件）

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

UIBridge 通过 ResizeObserver 和 window resize/scroll 自动同步，并直接桥接原生 focus 和 pointer capture。

### 3.15 Diagnostics

Diagnostics 只记录引擎运行时指标，不决定性能策略：

- frame、delta、CPU frame time
- batch 数量和 draw 数量
- 可见对象数量
- GPU timestamp（设备支持时由上层接入）
- 资源统计和错误标签

统计结果可供示例、开发工具和性能回归使用，不进入游戏业务状态。

设备支持 `timestamp-query` 时可使用 `GpuTimestampQuery`；benchmark baseline checker 用持久化预算和容差检测 CPU/GPU 回归。

Engine 使用 `performance.now()` 测量 system update/render 的实际 CPU 时间；runtime system 异常会发出 `source: "runtime"` 错误并与后续系统隔离。

`Engine` 集成 World、InputSource、GpuResourceManager 和 Diagnostics。World 提供泛型 `extractRenderItems()`，不绑定任何 Sprite 或游戏领域组件。

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
| 多语言文本测量和换行 | `@chenglou/pretext` | Text2D 或 UI 扩展需要多行布局、虚拟列表或频繁测量时 |

明确不引入无作用域的 `pretext`（Markdown-inspired markup 工具）、PixiJS、Phaser、Three.js、Howler、Socket.IO、RxJS、ECS 库、通用 tween 库和 WGSL 反射库。

## 5. 仓库结构

```text
src/
  core/
  platform/
  input/
  interaction/
  gpu/
  render2d/
  text2d/
  world/
  animation/
  assets/
  audio/
  spatial/
  tilemap/
  net/
  ui-bridge/
  debug/

examples/
  triangle/
  sprites/
  text/
  animation/
  audio/
  tilemap/
  benchmark/

tests/
```

示例是引擎验收工具，不是验证游戏。至少保留：Image2D/Sprite 批处理、Text2D、动画/音频、Tilemap chunk 和性能基准示例。

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
- Image2D、Sprite 和 atlas
- 实例化 batch
- Camera2D
- layer/sort
- viewport culling
- 基础 benchmark

验收：Image2D 和 Sprite 数量增加时，draw 数量按 batch 增长，而不是按对象数量增长；普通图片与 atlas frame 共享批处理路径。

### 阶段 2：运行时基础

- World 和 Entity ID
- Transform2D
- Assets
- Text2D 和 text atlas
- Input 和 action mapping
- Animation
- Sprite animation binding
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
Image2D
Sprite
Text2D
```

游戏层可以获取必要的只读状态和扩展点，但不直接接管 GPU 资源生命周期。引擎内部实现可以变化，公共 API 不应暴露尚未稳定的 ECS、Render Graph 或 UI 组件抽象。

## 8. 验收标准

引擎第一阶段不以完整游戏为验收标准，而以以下能力为准：

- WebGPU 正确初始化和恢复
- 普通图片、Sprite 和 Tilemap 共享有效的 TexturedQuad 批处理
- 世界文字可以通过 Text2D 缓存并绘制，DOM UI 文字不进入该路径
- 资源加载、缓存和释放可观察
- 固定 timestep 稳定
- 动画和音频独立工作
- 输入、焦点、IME 和事件路由有明确行为
- Tilemap 作为可选模块工作
- UI 扩展不需要修改核心渲染器
- 有浏览器 smoke test 和可重复性能基准
