import type { GpuContext } from "../gpu/device.ts";
import type { Camera2D } from "./camera.ts";
import { type TexturedQuad, unwrapSampler, unwrapTexture } from "./quad.ts";

const shaderCode = /* wgsl */ `
struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

@group(0) @binding(0) var imageSampler: sampler;
@group(0) @binding(1) var imageTexture: texture_2d<f32>;

@vertex
fn vertexMain(
  @location(0) local: vec2<f32>,
  @location(1) transform0: vec4<f32>,
  @location(2) transform1: vec4<f32>,
  @location(3) transform2: vec4<f32>,
  @location(4) transform3: vec4<f32>,
) -> VertexOut {
  var output: VertexOut;
  let position = vec2<f32>(
    transform0.x * local.x + transform0.z * local.y + transform1.x,
    transform0.y * local.x + transform0.w * local.y + transform1.y,
  );
  output.position = vec4<f32>(position, 0.0, 1.0);
  output.uv = transform1.zw + vec2<f32>(
    transform2.x * local.x + transform3.z * local.y,
    transform3.w * local.x + transform2.y * local.y,
  );
  output.color = vec4<f32>(transform2.zw, transform3.xy);
  return output;
}

@fragment
fn fragmentMain(input: VertexOut) -> @location(0) vec4<f32> {
  return textureSample(imageTexture, imageSampler, input.uv) * input.color;
}
`;

const quadVertices = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);

interface Batch {
  texture: GPUTexture;
  sampler: GPUSampler;
  items: TexturedQuad[];
}

export interface Renderer2DOptions {
  clearColor?: GPUColor;
  maxInstances?: number;
}

export interface Renderer2DRenderOptions {
  scissor?: { x: number; y: number; width: number; height: number };
  staticItems?: boolean;
  targetView?: GPUTextureView;
  clearColor?: GPUColor;
  loadOp?: GPULoadOp;
  storeOp?: GPUStoreOp;
}

export function writeTexturedQuadInstance(
  target: Float32Array,
  index: number,
  item: TexturedQuad,
  camera: Camera2D,
): void {
  const sx = (2 * camera.zoom) / camera.viewportWidth;
  const sy = (2 * camera.zoom) / camera.viewportHeight;
  const cos = Math.cos(item.rotation);
  const sin = Math.sin(item.rotation);
  const ax = item.anchor.x * item.size.x;
  const ay = item.anchor.y * item.size.y;
  const txWorld = item.position.x - cos * ax + sin * ay;
  const tyWorld = item.position.y - sin * ax - cos * ay;
  target[index] = cos * item.size.x * sx;
  target[index + 1] = -sin * item.size.x * sy;
  target[index + 2] = -sin * item.size.y * sx;
  target[index + 3] = -cos * item.size.y * sy;
  target[index + 4] = (txWorld - camera.position.x) * sx;
  target[index + 5] = -(tyWorld - camera.position.y) * sy;
  target[index + 6] = item.uv.x;
  target[index + 7] = item.uv.y;
  const uv = item.uvTransform ?? [item.uv.width, 0, 0, item.uv.height];
  target[index + 8] = uv[0];
  target[index + 9] = uv[3];
  target[index + 10] = item.color[0];
  target[index + 11] = item.color[1];
  target[index + 12] = item.color[2];
  target[index + 13] = item.color[3];
  target[index + 14] = uv[1];
  target[index + 15] = uv[2];
}

export class Renderer2D {
  readonly context: GPUCanvasContext;
  readonly device: GPUDevice;
  readonly clearColor: GPUColor;
  private readonly pipeline: GPURenderPipeline;
  private readonly format: GPUTextureFormat;
  private readonly vertexBuffer: GPUBuffer;
  private instanceBuffer: GPUBuffer;
  private readonly defaultSampler: GPUSampler;
  private readonly viewCache = new WeakMap<GPUTexture, GPUTextureView>();
  private readonly bindGroups = new Map<string, GPUBindGroup>();
  private readonly textureIds = new WeakMap<object, number>();
  private readonly staticSorted = new WeakMap<
    readonly TexturedQuad[],
    TexturedQuad[]
  >();
  private nextTextureId = 1;

  constructor(gpu: GpuContext, options: Renderer2DOptions = {}) {
    this.context = gpu.context;
    this.device = gpu.device;
    this.clearColor = options.clearColor ?? { r: 0.04, g: 0.05, b: 0.08, a: 1 };
    this.format = gpu.capabilities.format;
    const shader = this.device.createShaderModule({
      code: shaderCode,
      label: "renderer2d",
    });
    this.pipeline = this.device.createRenderPipeline({
      label: "renderer2d",
      layout: "auto",
      vertex: {
        module: shader,
        entryPoint: "vertexMain",
        buffers: [
          {
            arrayStride: 8,
            stepMode: "vertex",
            attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
          },
          {
            arrayStride: 64,
            stepMode: "instance",
            attributes: [
              { shaderLocation: 1, offset: 0, format: "float32x4" },
              { shaderLocation: 2, offset: 16, format: "float32x4" },
              { shaderLocation: 3, offset: 32, format: "float32x4" },
              { shaderLocation: 4, offset: 48, format: "float32x4" },
            ],
          },
        ],
      },
      fragment: {
        module: shader,
        entryPoint: "fragmentMain",
        targets: [
          {
            format: this.format,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: { topology: "triangle-list" },
    });
    this.vertexBuffer = this.device.createBuffer({
      label: "renderer2d-quad",
      size: quadVertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.vertexBuffer, 0, quadVertices);
    this.instanceBuffer = this.createInstanceBuffer(
      options.maxInstances ?? 1024,
    );
    this.defaultSampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });
  }

  render(
    items: readonly TexturedQuad[],
    camera: Camera2D,
    options: Renderer2DRenderOptions = {},
  ): { batches: number; draws: number; visibleItems: number } {
    const sorted = options.staticItems
      ? this.getStaticSorted(items)
      : [...items].sort(
          (left, right) =>
            left.layer - right.layer ||
            this.textureKey(left.texture) - this.textureKey(right.texture),
        );
    const visible = sorted.filter(
      (item) => item.visible && this.isVisible(item, camera),
    );
    const batches: Batch[] = [];
    for (const item of visible) {
      const texture = unwrapTexture(item.texture);
      const sampler = item.sampler
        ? unwrapSampler(item.sampler)
        : this.defaultSampler;
      const previous = batches[batches.length - 1];
      if (
        previous &&
        previous.texture === texture &&
        previous.sampler === sampler
      ) {
        previous.items.push(item);
      } else {
        batches.push({ texture, sampler, items: [item] });
      }
    }

    if (visible.length > this.instanceCapacity()) {
      this.replaceInstanceBuffer(visible.length);
    }
    const encoder = this.device.createCommandEncoder({ label: "renderer2d" });
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view:
            options.targetView ?? this.context.getCurrentTexture().createView(),
          clearValue: options.clearColor ?? this.clearColor,
          loadOp: options.loadOp ?? "clear",
          storeOp: options.storeOp ?? "store",
        },
      ],
    });
    pass.setPipeline(this.pipeline);
    if (options.scissor) {
      const { x, y, width, height } = options.scissor;
      if (width < 0 || height < 0) {
        throw new RangeError(
          "Renderer scissor dimensions must be non-negative",
        );
      }
      pass.setScissorRect(x, y, width, height);
    }
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.setVertexBuffer(1, this.instanceBuffer);
    let offset = 0;
    for (const batch of batches) {
      const batchOffset = offset;
      const instances = new Float32Array(batch.items.length * 16);
      for (const [index, item] of batch.items.entries()) {
        writeTexturedQuadInstance(instances, index * 16, item, camera);
        offset += 64;
      }
      this.device.queue.writeBuffer(
        this.instanceBuffer,
        batchOffset,
        instances,
      );
      pass.setBindGroup(0, this.getBindGroup(batch.texture, batch.sampler));
      pass.draw(6, batch.items.length, 0, batchOffset / 64);
    }
    pass.end();
    this.device.queue.submit([encoder.finish()]);
    return {
      batches: batches.length,
      draws: batches.length,
      visibleItems: visible.length,
    };
  }

  createRenderTarget(
    width: number,
    height: number,
    usage: GPUTextureUsageFlags = GPUTextureUsage.RENDER_ATTACHMENT |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_SRC,
  ): GPUTexture {
    if (!(width > 0) || !(height > 0)) {
      throw new RangeError("Render target dimensions must be positive");
    }
    return this.device.createTexture({
      label: "renderer2d-target",
      size: { width, height, depthOrArrayLayers: 1 },
      format: this.format,
      usage,
    });
  }

  invalidateStatic(items: readonly TexturedQuad[]): void {
    this.staticSorted.delete(items);
  }

  dispose(): void {
    this.vertexBuffer.destroy();
    this.instanceBuffer.destroy();
    this.bindGroups.clear();
  }

  private isVisible(item: TexturedQuad, camera: Camera2D): boolean {
    const bounds = camera.visibleWorldBounds();
    return (
      item.position.x + item.size.x >= bounds.left &&
      item.position.x - item.size.x <= bounds.right &&
      item.position.y + item.size.y >= bounds.top &&
      item.position.y - item.size.y <= bounds.bottom
    );
  }

  private getStaticSorted(
    items: readonly TexturedQuad[],
  ): readonly TexturedQuad[] {
    const cached = this.staticSorted.get(items);
    if (cached) return cached;
    const sorted = [...items].sort(
      (left, right) =>
        left.layer - right.layer ||
        this.textureKey(left.texture) - this.textureKey(right.texture),
    );
    this.staticSorted.set(items, sorted);
    return sorted;
  }

  private getBindGroup(texture: GPUTexture, sampler: GPUSampler): GPUBindGroup {
    const key = `${this.textureKey(texture)}:${this.textureKey(sampler)}`;
    const cached = this.bindGroups.get(key);
    if (cached) return cached;
    const view = this.viewCache.get(texture) ?? texture.createView();
    this.viewCache.set(texture, view);
    const group = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: view },
      ],
    });
    this.bindGroups.set(key, group);
    return group;
  }

  private textureKey(value: object): number {
    let key = this.textureIds.get(value);
    if (key === undefined) {
      key = this.nextTextureId++;
      this.textureIds.set(value, key);
    }
    return key;
  }

  private createInstanceBuffer(capacity: number): GPUBuffer {
    return this.device.createBuffer({
      label: "renderer2d-instances",
      size: Math.max(1, capacity) * 64,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
  }

  private instanceCapacity(): number {
    return this.instanceBuffer.size / 64;
  }

  private replaceInstanceBuffer(required: number): void {
    const next = Math.max(required, this.instanceCapacity() * 2);
    this.instanceBuffer.destroy();
    this.instanceBuffer = this.createInstanceBuffer(next);
  }
}
