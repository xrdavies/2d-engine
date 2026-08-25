export type { AnimationEvent, SpriteFrame } from "./animation/index.ts";
export {
  AnimationPlayer,
  SpriteAnimationBinding,
  SpriteFrameClip,
} from "./animation/index.ts";
export type { AssetLoadOptions } from "./assets/index.ts";
export { AssetManager } from "./assets/index.ts";
export type { AudioBus, PlayAudioOptions } from "./audio/index.ts";
export { AudioManager } from "./audio/index.ts";
export type { ClockOptions, ClockStep } from "./core/clock.ts";
export { FixedClock } from "./core/clock.ts";
export type {
  EngineErrorEvent,
  EngineEventMap,
  EngineOptions,
  EngineStatus,
  EngineSystem,
  EngineViewport,
} from "./core/engine.ts";
export { Engine } from "./core/engine.ts";
export type { FrameStats } from "./debug/index.ts";
export { Diagnostics } from "./debug/index.ts";
export type { GpuCapabilities, GpuContext, GpuOptions } from "./gpu/device.ts";
export type {
  BindGroupResourceOptions,
  BufferResourceOptions,
  BufferUploadOptions,
  ComputePipelineResourceOptions,
  GpuResourceHandle,
  GpuResourceKind,
  PipelineResourceOptions,
  RenderPipelineResourceOptions,
  ResourceOptions,
  SamplerResourceOptions,
  ShaderResourceOptions,
  TextureResourceOptions,
  TextureUploadOptions,
} from "./gpu/resources.ts";
export {
  GpuResource,
  GpuResourceManager,
  ResourceCache,
} from "./gpu/resources.ts";
export type {
  ActionBinding,
  CompositionInputEvent,
  GamepadButtonState,
  GamepadInputEvent,
  InputEventType,
  InputHandler,
  InputModifiers,
  InputSourceOptions,
  KeyboardInputEvent,
  NormalizedInputEvent,
  PointerInputEvent,
  TextInputEvent,
  TouchInputEvent,
  TouchPoint,
  WheelInputEvent,
} from "./input/index.ts";
export {
  ActionMap,
  InputEventControl,
  InputSource,
} from "./input/index.ts";
export type {
  HitTest,
  InteractionHandler,
  InteractionPhase,
  InteractionTarget,
} from "./interaction/index.ts";
export {
  InteractionRouter,
  RoutedInputEvent,
} from "./interaction/index.ts";
export type {
  HttpRequestOptions,
  WebSocketFactory,
  WebSocketState,
} from "./net/index.ts";
export { HttpClient, WebSocketTransport } from "./net/index.ts";
export type {
  CoordinateElement,
  CoordinateMapper,
  InputCoordinates,
  Point2D,
} from "./platform/index.ts";
export { createCoordinateMapper } from "./platform/index.ts";
export type {
  Camera2DOptions,
  Image2DOptions,
  Renderer2DOptions,
  SamplerSource,
  SpriteOptions,
  TexturedQuad,
  TextureRegion,
  TextureSource,
} from "./render2d/index.ts";
export { Camera2D, Image2D, Renderer2D, Sprite } from "./render2d/index.ts";
export type { Aabb, SpatialEntry } from "./spatial/index.ts";
export { UniformGrid } from "./spatial/index.ts";
export type {
  PreparedText,
  PretextLayoutModule,
  PretextPreparedText,
  RasterizedText,
  Text2DOptions,
  TextAtlasEntry,
  TextCanvas,
  TextLayoutBackend,
  TextLayoutOptions,
  TextLayoutResult,
  TextLine,
  TextRasterStyle,
} from "./text2d/index.ts";
export {
  CanvasTextLayout,
  PretextTextLayout,
  Text2D,
  TextAtlas,
  TextRasterizer,
} from "./text2d/index.ts";
export type {
  ImageLayer,
  MapObject,
  ObjectLayer,
  TileChunk,
  TileLayer,
  TilemapAsset,
  TilemapOrientation,
  TileRenderOptions,
  TileRenderResult,
  Tileset,
} from "./tilemap/index.ts";
export { TiledMapImporter, TilemapRuntime } from "./tilemap/index.ts";
export { UIBridge } from "./ui-bridge/index.ts";
export type {
  EntityId,
  Matrix3,
  Transform2DOptions,
  Vector2,
} from "./world/index.ts";
export {
  ComponentStore,
  EntityManager,
  Transform2D,
  World,
} from "./world/index.ts";

export const ENGINE_VERSION = "0.1.0";
