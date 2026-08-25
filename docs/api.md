# Public API

The package exports its supported runtime surface from `src/index.ts`:

- Runtime: `Engine`, `FixedClock`, `World`, `ComponentStore`, `Transform2D`
- GPU: `GpuResourceManager` and typed resource handles
- Rendering: `Renderer2D`, `Camera2D`, `Image2D`, `Sprite`, `TexturedQuad`
- Content: `AssetManager`, `Text2D`, `TextAtlas`, `NumericTextAtlas`, `TilemapRuntime`
- Interaction: `InputSource`, `ActionMap`, `InteractionRouter`, `UIBridge`
- Media and network: `AudioManager`, `HttpClient`, `WebSocketTransport`
- Diagnostics: `Diagnostics`

APIs exported from the package root are supported for the `0.1.x` line. APIs
imported from internal source paths are experimental and may change without
notice.
