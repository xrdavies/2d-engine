import type { GpuResourceHandle } from "../gpu/resources.ts";
import type { Vector2 } from "../world/transform2d.ts";

export interface TextureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TextureSource = GpuResourceHandle<GPUTexture> | GPUTexture;
export type SamplerSource = GpuResourceHandle<GPUSampler> | GPUSampler;

export interface TexturedQuad {
  texture: TextureSource;
  sampler?: SamplerSource;
  position: Vector2;
  size: Vector2;
  rotation: number;
  anchor: Vector2;
  uv: TextureRegion;
  uvTransform?: [number, number, number, number];
  color: [number, number, number, number];
  layer: number;
  visible: boolean;
}

export interface Image2DOptions {
  texture: TextureSource;
  sampler?: SamplerSource;
  position?: Partial<Vector2>;
  size?: Partial<Vector2>;
  rotation?: number;
  anchor?: Partial<Vector2>;
  uv?: Partial<TextureRegion>;
  color?: [number, number, number, number];
  layer?: number;
  visible?: boolean;
}

export function unwrapTexture(source: TextureSource): GPUTexture {
  return "resource" in source ? source.resource : source;
}

export function unwrapSampler(source: SamplerSource): GPUSampler {
  return "resource" in source ? source.resource : source;
}

export class Image2D implements TexturedQuad {
  texture: TextureSource;
  sampler?: SamplerSource;
  position: Vector2;
  size: Vector2;
  rotation: number;
  anchor: Vector2;
  uv: TextureRegion;
  color: [number, number, number, number];
  layer: number;
  visible: boolean;

  constructor(options: Image2DOptions) {
    this.texture = options.texture;
    this.sampler = options.sampler;
    this.position = {
      x: options.position?.x ?? 0,
      y: options.position?.y ?? 0,
    };
    this.size = { x: options.size?.x ?? 1, y: options.size?.y ?? 1 };
    this.rotation = options.rotation ?? 0;
    this.anchor = { x: options.anchor?.x ?? 0.5, y: options.anchor?.y ?? 0.5 };
    this.uv = {
      x: options.uv?.x ?? 0,
      y: options.uv?.y ?? 0,
      width: options.uv?.width ?? 1,
      height: options.uv?.height ?? 1,
    };
    this.color = options.color ?? [1, 1, 1, 1];
    this.layer = options.layer ?? 0;
    this.visible = options.visible ?? true;
  }

  toRenderItem(): TexturedQuad {
    return this;
  }
}

export interface SpriteOptions extends Omit<Image2DOptions, "uv"> {
  frame?: TextureRegion;
}

export class Sprite extends Image2D {
  get frame(): TextureRegion {
    return this.uv;
  }

  set frame(value: TextureRegion) {
    this.uv = value;
  }

  constructor(options: SpriteOptions) {
    super({ ...options, uv: options.frame });
  }
}
