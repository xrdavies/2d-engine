# 2D Engine

一个基于 WebGPU 的浏览器 2D 游戏运行时引擎。

当前范围：

- WebGPU + WGSL
- Image2D、Sprite、Text2D 和 2D / 2.5D 渲染；3D 不在当前目标内
- 浏览器原生输入、音频和资源加载
- 引擎提供输入与交互基础设施，不内置 UI 组件库
- Tilemap、网络和物理作为可选模块

完整的能力边界、模块划分、技术选型和路线图见
[docs/engine-architecture.md](docs/engine-architecture.md)。

按阶段执行的实现计划见
[docs/implementation-plan.md](docs/implementation-plan.md)。
