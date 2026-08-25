export interface AssetLoadOptions {
  signal?: AbortSignal;
  timeout?: number;
}

function disposeValue(value: unknown): void {
  if (value && typeof value === "object") {
    const disposable = value as {
      dispose?: () => void;
      close?: () => void;
      destroy?: () => void;
    };
    if (typeof disposable.dispose === "function") disposable.dispose();
    else if (typeof disposable.close === "function") disposable.close();
    else if (typeof disposable.destroy === "function") disposable.destroy();
  }
}

const textureUsage = (): GPUTextureUsageFlags =>
  typeof GPUTextureUsage === "undefined"
    ? 0x04 | 0x02
    : GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST;

export class AssetManager {
  private readonly values = new Map<string, unknown>();
  private readonly pending = new Map<string, Promise<unknown>>();

  async load<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = this.values.get(key);
    if (cached !== undefined) return cached as T;
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<T>;
    const pending = loader().then(
      (value) => {
        this.pending.delete(key);
        this.values.set(key, value);
        return value;
      },
      (error: unknown) => {
        this.pending.delete(key);
        throw error;
      },
    );
    this.pending.set(key, pending);
    return pending;
  }

  async loadImage(
    url: string,
    options: AssetLoadOptions = {},
  ): Promise<ImageBitmap> {
    return this.load(this.key("image", url), async () => {
      const response = await this.fetch(url, options);
      if (!response.ok)
        throw new Error(`Image request failed (${response.status}): ${url}`);
      return createImageBitmap(await response.blob());
    });
  }

  async loadJson<T>(url: string, options: AssetLoadOptions = {}): Promise<T> {
    return this.load(this.key("json", url), async () => {
      const response = await this.fetch(url, options);
      if (!response.ok)
        throw new Error(`JSON request failed (${response.status}): ${url}`);
      return response.json() as Promise<T>;
    });
  }

  async loadText(url: string, options: AssetLoadOptions = {}): Promise<string> {
    return this.load(this.key("text", url), async () => {
      const response = await this.fetch(url, options);
      if (!response.ok)
        throw new Error(`Text request failed (${response.status}): ${url}`);
      return response.text();
    });
  }

  async loadAudio(
    url: string,
    context: BaseAudioContext,
    options: AssetLoadOptions = {},
  ): Promise<AudioBuffer> {
    return this.load(this.key("audio", url), async () => {
      const response = await this.fetch(url, options);
      if (!response.ok)
        throw new Error(`Audio request failed (${response.status}): ${url}`);
      return context.decodeAudioData(await response.arrayBuffer());
    });
  }

  async loadFont(
    key: string,
    family: string,
    source: string | ArrayBuffer,
    descriptors?: FontFaceDescriptors,
  ): Promise<FontFace> {
    return this.load(this.key("font", key), async () => {
      const font = new FontFace(family, source, descriptors);
      await font.load();
      if (typeof document !== "undefined") document.fonts.add(font);
      return font;
    });
  }

  async uploadImage(
    key: string,
    image: ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas,
    device: GPUDevice,
    options: { format?: GPUTextureFormat; usage?: GPUTextureUsageFlags } = {},
  ): Promise<GPUTexture> {
    return this.load(this.key("gpu", key), async () => {
      const width = image.width;
      const height = image.height;
      const texture = device.createTexture({
        label: key,
        size: { width, height, depthOrArrayLayers: 1 },
        format: options.format ?? "rgba8unorm",
        usage: options.usage ?? textureUsage(),
      });
      device.queue.copyExternalImageToTexture(
        { source: image },
        { texture },
        { width, height, depthOrArrayLayers: 1 },
      );
      return texture;
    });
  }

  get<T>(key: string): T | undefined {
    return this.values.get(key) as T | undefined;
  }

  getImage(url: string): ImageBitmap | undefined {
    return this.get(this.key("image", url));
  }

  getJson<T>(url: string): T | undefined {
    return this.get<T>(this.key("json", url));
  }

  getText(url: string): string | undefined {
    return this.get(this.key("text", url));
  }

  disposeAsset(
    type: "image" | "json" | "text" | "audio" | "font" | "gpu",
    key: string,
  ): boolean {
    return this.dispose(this.key(type, key));
  }

  has(key: string): boolean {
    return this.values.has(key);
  }

  dispose(key: string): boolean {
    const value = this.values.get(key);
    if (value === undefined) return false;
    this.values.delete(key);
    disposeValue(value);
    return true;
  }

  clear(): void {
    for (const value of this.values.values()) disposeValue(value);
    this.values.clear();
  }

  private async fetch(
    url: string,
    options: AssetLoadOptions,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout =
      options.timeout === undefined
        ? undefined
        : setTimeout(() => controller.abort(), options.timeout);
    const abort = (): void => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", abort, { once: true });
    try {
      return await fetch(url, { signal: controller.signal });
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
    }
  }

  private key(type: string, key: string): string {
    return `${type}:${key}`;
  }
}
