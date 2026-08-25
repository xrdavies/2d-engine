# Implementation Plan

当前实现状态：M0-M9 的第一版运行时已完成并通过 P1/P2 复核与跨浏览器回归。

已完成的原限制项：

- Renderer2D 支持静态 RenderItem 排序缓存和显式失效。
- World/Transform2D 支持固定逻辑步之间的位置、缩放和旋转插值。
- CanvasTextLayout 支持 whitespace 归一化、pre-wrap、word-break 和 grapheme fallback；复杂 bidi/typography 可使用 Pretext 后端。
- TilemapRuntime 支持正交、等距、hexagonal/staggered 基础投影；异步 importer 支持外部 tileset、CSV/base64 和 gzip/deflate tile data。
- GPU timestamp-query 通过可选 `GpuTimestampQuery` 接入；benchmark 有持久化 baseline 和 regression gate。

当前上限：TextAtlas 使用单页缓存，页面满时会显式报错；多页 atlas 在实际内容证明需要时加入。zstd tile data 需要浏览器提供相应解压能力后再启用。

## 1. 实施原则

- 先做可运行的垂直切片，再扩展抽象。
- 运行时保持零第三方依赖；依赖只进入开发工具或可选扩展。
- 每个阶段都必须有一个可运行示例和最小验证。
- Renderer2D 只消费通用 RenderItem，不理解游戏领域对象。
- 不为了未来 3D、UI 或网络同步提前实现对应系统。
- 阶段结束后再冻结该阶段的公共 API，避免一次设计完整引擎。

3D 不属于当前实施路线。当前不创建 `src/3d`、3D 公共 API、3D 示例或 3D 性能目标；未来是否增加 3D 需要另行立项和评审。

## 2. 依赖关系

```text
M0 Toolchain
  -> M1 Platform / WebGPU Device
    -> M2 GPU Resources
      -> M3 Renderer2D
        -> M4 Time / World / Transform2D
          -> M5 Assets / Input / Animation / Audio
            -> M6 Text2D
              -> M7 Spatial / Tilemap
                  -> M8 Interaction / UI Bridge / Network
                  -> M9 Hardening / Release
```

M7 的 Tilemap 不阻塞 M6；M8 的 Network Transport 不阻塞核心 2D runtime。它们可以在前一阶段稳定后并行实现，但不能改变已经冻结的核心 API。

## 3. 阶段划分

### M0：工具链和仓库骨架

目标：可以编译、测试、启动示例并发布一个空的 ESM 包。

实现：

- `package.json`、ESM、TypeScript strict
- Vite library mode 和开发服务器
- Vitest CPU 测试
- Playwright 浏览器 smoke test
- Biome 格式化和静态检查
- `src/index.ts` 公共入口
- `examples/triangle` 和 `tests/`
- `npm run check`、`npm run test`、`npm run build`

验收：

- 全新环境可以安装、检查、测试和构建
- 示例可以由 Vite 启动
- 生成 ESM 和类型声明
- 提交不包含构建产物

### M1：Platform 和 WebGPU Device

目标：可靠管理 Canvas、WebGPU device 和浏览器生命周期。

实现：

- Canvas adapter
- `requestAdapter`/`requestDevice`
- feature/limit capability tier
- Canvas resize、DPR 和 viewport
- `requestAnimationFrame` 基础循环
- 页面隐藏、暂停和恢复
- `GPUDevice.lost`
- error scope 和 uncaptured error
- 统一引擎销毁流程

示例：`examples/device`，显示 adapter、limits、feature 和错误状态。

验收：

- 无 WebGPU 或 device 创建失败时有明确错误
- resize 和 DPR 变化后画面尺寸正确
- 页面切后台再回来不会产生超长 delta
- Chromium SwiftShader WebGPU gate 通过；Firefox/WebKit 完成非 GPU smoke test

### M2：GPU Resource Core

目标：建立 Renderer2D 之外可复用的 GPU 资源生命周期。

实现：

- Buffer、Texture、Sampler、Shader、Pipeline、BindGroup 句柄
- WGSL 加载和 shader 编译错误
- buffer 写入和纹理上传
- 资源缓存和显式 `dispose`
- pipeline cache
- bind group 创建辅助
- debug label

不实现：

- Render Graph
- WebGL abstraction
- 自动 WGSL reflection
- 完整材质系统

验收：

- 三角形示例不直接管理临时 GPU 资源
- 资源销毁后不会继续提交
- shader 编译失败可以定位到资源名
- 句柄和缓存有 CPU 单元测试

### M3：Renderer2D 和 TexturedQuad

目标：完成普通图片和 Sprite 的统一 2D 绘制路径。

实现顺序：

1. Camera2D 和世界/屏幕坐标转换
2. TexturedQuad RenderItem
3. Image2D，完整 UV 图片
4. Sprite，atlas frame UV
5. alpha blending、layer 和 sort key
6. instance buffer 和 batch sorting
7. viewport culling
8. scissor 和基础裁剪
9. 静态 RenderItem 缓存

示例：

- `examples/image`
- `examples/sprites`
- `examples/benchmark`

验收：

- 普通图片和 atlas Sprite 使用同一个 batcher
- draw 数量按 batch 数量增长，而不是按对象数量增长
- Camera pan/zoom、anchor 和层级排序正确
- benchmark 能记录对象数、batch 数、draw 数、CPU frame time

### M4：Time、World 和 Transform2D

目标：让渲染对象由可更新的运行时世界产生。

实现：

- 固定 timestep
- render interpolation
- Entity ID
- 简单 ComponentStore
- Transform2D
- 父子层级和 dirty propagation
- RenderItem extraction
- entity 创建、销毁和重用策略

验收：

- 逻辑更新与渲染帧率无关
- Transform 层级和相机转换有纯逻辑测试
- entity 销毁后不会出现在 RenderItem 中
- World 提供泛型 RenderItem extraction，销毁 entity 后不会被提取
- 示例可以用 World 驱动 Image2D 和 Sprite

### M5：Assets、Input、Interaction、Animation 和 Audio

目标：形成不依赖 UI 框架的可用 2D runtime。

实现顺序：

1. Asset Manager：图片、JSON、WGSL、音频、字体句柄
2. Pointer、Keyboard、Touch、Gamepad 标准化
3. screen/viewport/world 坐标转换
4. action mapping
5. Interaction Router：capture、target、bubble、focus、pointer capture
6. AnimationPlayer、SpriteFrameClip、SpriteAnimationBinding
7. Web Audio context、bus、sound/music、pause/resume

示例：`examples/animation` 和 `examples/audio`。

验收：

- 资源加载、缓存、错误和 dispose 可观察
- 输入事件可以被消费或继续传播
- IME composition 事件不会被吞掉
- Sprite 动画由 AnimationSystem 推进，Renderer2D 只读取当前 frame
- 用户手势后音频可以解锁并播放

### M6：Text2D

目标：提供世界文字、地图标签、飘字和 debug label，不实现 UI 文本控件。

实现顺序：

1. `TextLayout` 内部协议
2. Canvas `measureText` 的单行基线实现
3. Canvas2D/OffscreenCanvas text-run rasterizer
4. TextAtlas 和 text-run cache
5. TexturedQuad 生成和 Renderer2D 批处理
6. 多行 layout 和 line range
7. `@chenglou/pretext` 可选 layout adapter

Pretext 只负责测量、换行和行范围。字体栅格化仍由 Canvas2D，最终绘制仍由 Renderer2D 完成。

示例：`examples/text`，覆盖中英文、CJK、长文本、多行、缩放和缓存命中。

验收：

- 文本宽度、行高和换行结果可重复
- 文本宽度变化只重新 layout，不重复 prepare
- TextAtlas 可以复用相同字体、样式和 text run
- prepared text 在宽度变化时复用，只重新执行 layout
- Text2D text run 通过 GPU atlas 页面生成 Renderer2D quad
- 世界文字不依赖 DOM UI
- 大量短文本的缓存和 batch 数可观测

### M7：Spatial 和 Tilemap

目标：提供通用大地图数据和空间查询，不解释游戏语义。

实现顺序：

1. 均匀空间网格
2. viewport、点、矩形和邻近查询
3. TileLayer、ObjectLayer、ImageLayer、Tileset、Chunk
4. 一个地图格式 importer，优先 Tiled JSON
5. chunk load/unload
6. 静态 tile chunk 缓存
7. tile picking 和基础 overlay

验收：

- tile 数据和游戏对象语义分离
- 只重建 dirty chunk
- 支持 chunk load/unload、Tiled infinite chunk 和 ImageLayer
- 支持正交和等距坐标转换
- 摄像机外的 chunk 不参与绘制
- tilemap 和动态 entity 使用独立更新路径
- importer 不让运行时依赖 Tiled 编辑器或 JSON 结构

### M8：UI Bridge 和 Network

目标：为未来 UI 扩展和网络游戏提供稳定的接入边界。

UI Bridge 实现：

- DOM overlay mount point
- Canvas/DOM 尺寸同步
- screen/world 坐标转换
- UI 输入捕获和释放
- focus/pointer capture 协作

不实现 Button、Panel、List、布局、主题或 UI 渲染器。

HTTP request/response 实现：

- 原生 `fetch` 封装
- `AbortSignal` 取消
- timeout
- HTTP status 检查
- JSON、文本和 ArrayBuffer 响应

WebSocket realtime transport 实现：

- WebSocket 连接状态
- 文本和 ArrayBuffer 收发
- timeout、close、reconnect
- message envelope

HTTP 用于启动配置、登录、资源元数据、存档和非实时命令；WebSocket 用于服务器推送、实时事件和长连接状态变化。

不实现鉴权流程、API 路径、序列化 schema、服务器权威、快照、预测、回滚或游戏协议。

验收：

- UI 扩展不修改 Renderer2D 和 Interaction Router
- DOM overlay 与 Canvas resize 同步
- 一个 fake transport 和 WebSocket transport 可以复用相同上层消息 API
- WebSocket 连接超时、受控重连、Blob 和 MessageEnvelope 有测试

### M9：稳定化、性能和发布

目标：把运行时从示例代码收敛为可被游戏项目使用的包。

实现：

- GPU/CPU 资源统计
- GPU resource kind/total 统计和空资源释放检查
- 资源泄漏检查
- device lost 恢复策略
- 多浏览器 smoke test
- Chromium SwiftShader WebGPU 强制路径；Firefox/WebKit 平台 smoke test
- 性能基准和回归记录
- 公共 API 文档
- package exports 和版本策略
- 示例最小化和发布包验证

延后到出现数据后：

- Render Graph
- indirect draw / compute culling
- SDF/MSDF
- Worker/OffscreenCanvas 主循环
- sparse set / archetype ECS
- WebGL fallback

验收：

- 新项目可以只安装引擎包和必要开发工具运行示例
- public API 有明确的稳定/实验标记
- benchmark 可重复运行并比较 commit 前后结果
- 工作区无构建产物和临时资源

当前明确的可选边界：`timestamp-query` 只在 adapter/device feature 可用时接入，不能作为所有浏览器的启动条件。

## 4. 每阶段的工作节奏

每个阶段按同样顺序执行：

1. 写该阶段的最小 API 和一个失败测试。
2. 实现最短路径，先让示例运行。
3. 补齐错误处理、资源释放和边界测试。
4. 运行 `check`、单元测试、浏览器 smoke test 和阶段 benchmark。
5. 更新架构/实现文档和示例。
6. 创建一个聚焦的 Conventional Commit 并推送。

阶段中发现的未来需求记录为 issue，不直接扩大当前阶段的公共 API。

## 5. 首批可执行任务

按以下顺序开始，不提前创建空模块：

1. M0：建立 `package.json`、TypeScript、Vite、Vitest、Playwright、Biome 配置。
2. M1：实现 Engine create/destroy、Canvas adapter 和 WebGPU device 初始化。
3. M1：完成三角形示例和第一个浏览器 smoke test。
4. M2：实现 Texture、Shader、Pipeline 的最小句柄和销毁路径。
5. M3：实现 Camera2D、TexturedQuad、Image2D 和单一 batch。
6. M3：实现 Sprite atlas frame 和 benchmark。

M3 完成并通过基准前，不创建 Tilemap、UI 组件或网络同步目录；3D 始终不属于当前实施计划。
