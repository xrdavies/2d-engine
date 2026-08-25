import type { GpuContext } from "./device.ts";

export type GpuResourceKind =
  | "buffer"
  | "texture"
  | "sampler"
  | "shader"
  | "pipeline"
  | "bindGroup";

type GpuResourceObject =
  | GPUBuffer
  | GPUTexture
  | GPUSampler
  | GPUShaderModule
  | GPURenderPipeline
  | GPUComputePipeline
  | GPUBindGroup;

export interface ResourceOptions {
  label?: string;
  /** Set false for resources which should never be deduplicated. */
  cache?: boolean;
  /** Use an explicit cache key when descriptor identity is not stable. */
  cacheKey?: string;
}

export interface GpuResourceStats {
  total: number;
  byKind: Readonly<Partial<Record<GpuResourceKind, number>>>;
}

export type BufferResourceOptions = GPUBufferDescriptor &
  ResourceOptions & {
    data?: BufferSource;
  };

export type TextureResourceOptions = GPUTextureDescriptor &
  ResourceOptions & {
    data?: BufferSource;
    dataLayout?: GPUImageDataLayout;
    dataSize?: GPUExtent3D;
  };

export type SamplerResourceOptions = GPUSamplerDescriptor & ResourceOptions;

export type ShaderResourceOptions = ResourceOptions & {
  code: string;
  hints?: Record<string, GPUShaderModuleCompilationHint>;
};

export type RenderPipelineResourceOptions = GPURenderPipelineDescriptor &
  ResourceOptions;
export type ComputePipelineResourceOptions = GPUComputePipelineDescriptor &
  ResourceOptions;
export type PipelineResourceOptions =
  | (RenderPipelineResourceOptions & { type?: "render" })
  | (ComputePipelineResourceOptions & { type: "compute" });
export type BindGroupResourceOptions = GPUBindGroupDescriptor & ResourceOptions;

export interface TextureUploadOptions {
  /** Byte offset into the source data. */
  offset?: number;
  /** Number of bytes in one source row. Defaults to width * 4 for RGBA formats. */
  bytesPerRow?: number;
  rowsPerImage?: number;
  size?: GPUExtent3D;
  origin?: GPUOrigin3D;
  mipLevel?: number;
  aspect?: GPUTextureAspect;
}

export interface BufferUploadOptions {
  offset?: number;
  dataOffset?: number;
  size?: number;
}

/** A small, dependency-free cache that can also be used independently in tests. */
export class ResourceCache<T> {
  private readonly entries = new Map<string, T>();

  get(key: string): T | undefined {
    return this.entries.get(key);
  }

  set(key: string, value: T): void {
    this.entries.set(key, value);
  }

  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

export interface GpuResourceHandle<
  T extends GpuResourceObject = GpuResourceObject,
> {
  readonly id: number;
  readonly kind: GpuResourceKind;
  readonly label?: string;
  readonly disposed: boolean;
  readonly resource: T;
  readonly gpu: T;
  dispose(): void;
}

/**
 * Owns one WebGPU object. Accessing a disposed handle fails early, before an
 * invalid object can be submitted to a command encoder.
 */
export class GpuResource<T extends GpuResourceObject = GpuResourceObject>
  implements GpuResourceHandle<T>
{
  private isDisposed = false;
  private currentLabel: string | undefined;

  public constructor(
    public readonly id: number,
    public readonly kind: GpuResourceKind,
    private readonly value: T,
    label: string | undefined,
    private readonly onDispose?: (resource: T, handle: GpuResource<T>) => void,
  ) {
    this.currentLabel = label;
  }

  get label(): string | undefined {
    return this.currentLabel;
  }

  get disposed(): boolean {
    return this.isDisposed;
  }

  get resource(): T {
    this.assertAlive();
    return this.value;
  }

  get gpu(): T {
    return this.resource;
  }

  setDebugLabel(label: string): void {
    this.assertAlive();
    this.currentLabel = label;
    // GPU labels are diagnostic only. Some test doubles expose a writable label.
    try {
      (this.value as unknown as { label?: string }).label = label;
    } catch {
      // Native WebGPU objects may expose label as readonly.
    }
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    if (this.onDispose) {
      this.onDispose(this.value, this);
    } else if (
      typeof (this.value as { destroy?: unknown }).destroy === "function"
    ) {
      (this.value as GPUBuffer | GPUTexture).destroy();
    }
  }

  assertAlive(): void {
    if (this.isDisposed) {
      throw new Error(`GPU ${this.kind} resource ${this.id} has been disposed`);
    }
  }
}

type AnyHandle = GpuResource<GpuResourceObject>;
type ResourceContext = GpuContext | Pick<GpuContext, "device"> | GPUDevice;

function getDevice(context: ResourceContext): GPUDevice {
  if ("createBuffer" in context) return context;
  return context.device;
}

const identityIds = new WeakMap<object, number>();
let nextIdentity = 1;
const textureSizes = new WeakMap<GPUTexture, GPUExtent3D>();
const textureFormats = new WeakMap<GPUTexture, GPUTextureFormat>();

function descriptorKey(value: unknown, seen = new Set<unknown>()): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "number":
      return Number.isNaN(value) ? "NaN" : String(value);
    case "boolean":
      return value ? "true" : "false";
    case "undefined":
      return "undefined";
    case "bigint":
      return `${value}n`;
    case "function":
      return objectIdentity(value);
    case "object":
      break;
    default:
      return String(value);
  }

  if (seen.has(value)) return objectIdentity(value);
  seen.add(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => descriptorKey(item, seen)).join(",")}]`;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return objectIdentity(value);
  }
  const object = value as Record<string, unknown>;
  const keys = Object.keys(object).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${descriptorKey(object[key], seen)}`)
    .join(",")}}`;
}

function objectIdentity(value: object): string {
  let id = identityIds.get(value);
  if (id === undefined) {
    id = nextIdentity++;
    identityIds.set(value, id);
  }
  return `@${id}`;
}

function cacheKey(
  kind: GpuResourceKind,
  options: ResourceOptions,
  descriptor: unknown,
): string | undefined {
  if (options.cache === false) return undefined;
  return `${kind}:${options.cacheKey ?? descriptorKey(descriptor)}`;
}

function bytes(data: BufferSource): Uint8Array {
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(data);
}

function widthFromExtent(size: GPUExtent3D): number {
  if (typeof size === "number") return size;
  if (Array.isArray(size)) return size[0] ?? 1;
  return size.width;
}

function textureFormatBytesPerPixel(
  format: GPUTextureFormat,
): number | undefined {
  if (
    format === "rgba8unorm" ||
    format === "rgba8unorm-srgb" ||
    format === "bgra8unorm" ||
    format === "bgra8unorm-srgb" ||
    format === "rgba8snorm" ||
    format === "rgba8uint" ||
    format === "rgba8sint"
  ) {
    return 4;
  }
  if (format === "r8unorm" || format === "r8uint" || format === "r8sint") {
    return 1;
  }
  if (format === "rg8unorm" || format === "rg8uint" || format === "rg8sint") {
    return 2;
  }
  return undefined;
}

export class GpuResourceManager {
  readonly device: GPUDevice;
  readonly cache = new ResourceCache<AnyHandle>();
  private readonly resources = new Map<number, AnyHandle>();
  private nextId = 1;

  public constructor(context: ResourceContext) {
    this.device = getDevice(context);
  }

  get size(): number {
    return this.resources.size;
  }

  stats(): GpuResourceStats {
    const byKind: Partial<Record<GpuResourceKind, number>> = {};
    for (const resource of this.resources.values()) {
      byKind[resource.kind] = (byKind[resource.kind] ?? 0) + 1;
    }
    return { total: this.resources.size, byKind };
  }

  get<T extends GpuResourceObject>(
    handle: GpuResourceHandle<T>,
  ): GpuResource<T> {
    handleResource(handle).assertAlive();
    return handleResource(handle) as unknown as GpuResource<T>;
  }

  createBuffer(options: BufferResourceOptions): GpuResource<GPUBuffer> {
    const { data, cache, cacheKey: explicitKey, ...descriptor } = options;
    const key = cacheKey(
      "buffer",
      { cache, cacheKey: explicitKey },
      descriptor,
    );
    const cached = key ? this.cache.get(key) : undefined;
    if (cached) return cached as GpuResource<GPUBuffer>;
    if (!Number.isInteger(descriptor.size) || descriptor.size <= 0) {
      throw new Error("GPU buffer size must be a positive integer");
    }
    if (!descriptor.usage) throw new Error("GPU buffer usage is required");

    const resource = this.device.createBuffer(descriptor);
    const handle = this.register("buffer", resource, descriptor.label, key);
    try {
      if (data) {
        if (descriptor.mappedAtCreation) {
          const target = new Uint8Array(
            resource.getMappedRange(0, descriptor.size),
          );
          const source = bytes(data);
          if (source.byteLength > target.byteLength) {
            throw new RangeError(
              "GPU buffer initial data is larger than the buffer",
            );
          }
          target.set(source);
          resource.unmap();
        } else {
          this.uploadBuffer(handle, data);
        }
      } else if (descriptor.mappedAtCreation) {
        resource.unmap();
      }
    } catch (error) {
      handle.dispose();
      throw error;
    }
    return handle;
  }

  createTexture(options: TextureResourceOptions): GpuResource<GPUTexture> {
    const {
      data,
      dataLayout,
      dataSize,
      cache,
      cacheKey: explicitKey,
      ...descriptor
    } = options;
    const key = cacheKey(
      "texture",
      { cache, cacheKey: explicitKey },
      descriptor,
    );
    const cached = key ? this.cache.get(key) : undefined;
    if (cached) return cached as GpuResource<GPUTexture>;
    if (!descriptor.size) throw new Error("GPU texture size is required");
    if (!descriptor.usage) throw new Error("GPU texture usage is required");

    const resource = this.device.createTexture(descriptor);
    textureSizes.set(resource, descriptor.size);
    textureFormats.set(resource, descriptor.format);
    const handle = this.register("texture", resource, descriptor.label, key);
    try {
      if (data)
        this.uploadTexture(handle, data, { ...dataLayout, size: dataSize });
    } catch (error) {
      handle.dispose();
      throw error;
    }
    return handle;
  }

  createSampler(options: SamplerResourceOptions = {}): GpuResource<GPUSampler> {
    const { cache, cacheKey: explicitKey, ...descriptor } = options;
    const key = cacheKey(
      "sampler",
      { cache, cacheKey: explicitKey },
      descriptor,
    );
    const cached = key ? this.cache.get(key) : undefined;
    if (cached) return cached as GpuResource<GPUSampler>;
    return this.register(
      "sampler",
      this.device.createSampler(descriptor),
      descriptor.label,
      key,
    );
  }

  createShader(
    options: ShaderResourceOptions | string,
  ): GpuResource<GPUShaderModule> {
    const normalized: ShaderResourceOptions =
      typeof options === "string" ? { code: options } : options;
    const { code, hints, cache, cacheKey: explicitKey, label } = normalized;
    if (!code) throw new Error("WGSL shader code is required");
    const key = cacheKey(
      "shader",
      { cache, cacheKey: explicitKey },
      { code, hints },
    );
    const cached = key ? this.cache.get(key) : undefined;
    if (cached) return cached as GpuResource<GPUShaderModule>;
    return this.register(
      "shader",
      this.device.createShaderModule({ code, label }),
      label,
      key,
    );
  }

  async validateShader(
    handle: GpuResourceHandle<GPUShaderModule>,
  ): Promise<void> {
    const module = this.get(handle).resource;
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter((message) => message.type === "error");
    if (errors.length) {
      const label = handleResource(handle).label ?? `shader ${handle.id}`;
      throw new Error(
        `${label}: ${errors.map((error) => error.message).join("; ")}`,
      );
    }
  }

  createRenderPipeline(
    options: RenderPipelineResourceOptions,
  ): GpuResource<GPURenderPipeline> {
    const { cache, cacheKey: explicitKey, ...descriptor } = options;
    const key = cacheKey(
      "pipeline",
      { cache, cacheKey: explicitKey },
      { type: "render", ...descriptor },
    );
    const cached = key ? this.cache.get(key) : undefined;
    if (cached) return cached as GpuResource<GPURenderPipeline>;
    return this.register(
      "pipeline",
      this.device.createRenderPipeline(descriptor),
      descriptor.label,
      key,
    );
  }

  createComputePipeline(
    options: ComputePipelineResourceOptions,
  ): GpuResource<GPUComputePipeline> {
    const { cache, cacheKey: explicitKey, ...descriptor } = options;
    const key = cacheKey(
      "pipeline",
      { cache, cacheKey: explicitKey },
      { type: "compute", ...descriptor },
    );
    const cached = key ? this.cache.get(key) : undefined;
    if (cached) return cached as GpuResource<GPUComputePipeline>;
    return this.register(
      "pipeline",
      this.device.createComputePipeline(descriptor),
      descriptor.label,
      key,
    );
  }

  createPipeline(
    options: PipelineResourceOptions,
  ): GpuResource<GPURenderPipeline | GPUComputePipeline> {
    if (options.type === "compute") {
      const { type: _type, ...descriptor } = options;
      return this.createComputePipeline(descriptor) as unknown as GpuResource<
        GPURenderPipeline | GPUComputePipeline
      >;
    }
    const { type: _type, ...descriptor } = options;
    return this.createRenderPipeline(descriptor) as unknown as GpuResource<
      GPURenderPipeline | GPUComputePipeline
    >;
  }

  createBindGroup(
    options: BindGroupResourceOptions,
  ): GpuResource<GPUBindGroup> {
    const { cache, cacheKey: explicitKey, ...descriptor } = options;
    const key = cacheKey(
      "bindGroup",
      { cache, cacheKey: explicitKey },
      descriptor,
    );
    const cached = key ? this.cache.get(key) : undefined;
    if (cached) return cached as GpuResource<GPUBindGroup>;
    return this.register(
      "bindGroup",
      this.device.createBindGroup(descriptor),
      descriptor.label,
      key,
    );
  }

  uploadBuffer(
    handle: GpuResourceHandle<GPUBuffer>,
    data: BufferSource,
    options: BufferUploadOptions = {},
  ): void {
    const resource = this.get(handle).resource;
    const source = bytes(data);
    const dataOffset = options.dataOffset ?? 0;
    const size = options.size ?? source.byteLength - dataOffset;
    const offset = options.offset ?? 0;
    if (dataOffset < 0 || size < 0 || dataOffset + size > source.byteLength) {
      throw new RangeError(
        "GPU buffer upload range is outside the source data",
      );
    }
    if (
      offset < 0 ||
      offset % 4 !== 0 ||
      size % 4 !== 0 ||
      dataOffset % 4 !== 0
    ) {
      throw new RangeError(
        "GPU buffer uploads require 4-byte aligned offset and size",
      );
    }
    this.device.queue.writeBuffer(
      resource,
      offset,
      source.buffer,
      source.byteOffset + dataOffset,
      size,
    );
  }

  uploadTexture(
    handle: GpuResourceHandle<GPUTexture>,
    data: BufferSource,
    options: TextureUploadOptions = {},
  ): void {
    const resourceHandle = this.get(handle);
    const source = bytes(data);
    const format = textureFormats.get(resourceHandle.resource);
    const size =
      options.size ??
      textureSizes.get(resourceHandle.resource) ??
      descriptorSize(resourceHandle.resource);
    const width = widthFromExtent(size);
    const inferredBytesPerPixel = format
      ? textureFormatBytesPerPixel(format)
      : undefined;
    const bytesPerRow =
      options.bytesPerRow ??
      (inferredBytesPerPixel ? inferredBytesPerPixel * width : undefined);
    if (
      bytesPerRow === undefined ||
      !Number.isFinite(bytesPerRow) ||
      bytesPerRow <= 0
    ) {
      throw new Error(
        `bytesPerRow is required for texture format ${format ?? "unknown"}`,
      );
    }
    const layout: GPUImageDataLayout = {
      offset: options.offset ?? 0,
      bytesPerRow,
      rowsPerImage: options.rowsPerImage,
    };
    this.device.queue.writeTexture(
      {
        texture: resourceHandle.resource,
        mipLevel: options.mipLevel ?? 0,
        origin: options.origin,
        aspect: options.aspect,
      },
      source,
      layout,
      size,
    );
  }

  setDebugLabel<T extends GpuResourceObject>(
    handle: GpuResourceHandle<T>,
    label: string,
  ): void {
    this.get(handle).setDebugLabel(label);
  }

  dispose(handle: GpuResourceHandle): void {
    handleResource(handle).dispose();
  }

  disposeAll(): void {
    for (const resource of [...this.resources.values()]) resource.dispose();
  }

  private register<T extends GpuResourceObject>(
    kind: GpuResourceKind,
    resource: T,
    label: string | undefined,
    key: string | undefined,
  ): GpuResource<T> {
    const handle = new GpuResource<T>(
      this.nextId++,
      kind,
      resource,
      label,
      (value, owner) => {
        if (typeof (value as { destroy?: unknown }).destroy === "function") {
          (value as GPUBuffer | GPUTexture).destroy();
        }
        this.resources.delete(owner.id);
        if (key && this.cache.get(key) === (owner as unknown as AnyHandle))
          this.cache.delete(key);
      },
    );
    this.resources.set(handle.id, handle as unknown as AnyHandle);
    if (key) this.cache.set(key, handle as unknown as AnyHandle);
    return handle;
  }
}

function handleResource(handle: GpuResourceHandle): GpuResource {
  if (!(handle instanceof GpuResource)) {
    // Handles from another manager remain valid structural handles.
    return handle as GpuResource;
  }
  return handle;
}

function descriptorSize(_texture: GPUTexture): GPUExtent3D {
  // GPUTexture does not expose its descriptor dimensions. Callers should pass
  // size for non-trivial textures; 1x1x1 keeps the default useful for tests.
  return { width: 1, height: 1, depthOrArrayLayers: 1 };
}

export { GpuResourceManager as ResourceManager };
