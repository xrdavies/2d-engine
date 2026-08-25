export interface AssetLoadOptions {
  signal?: AbortSignal;
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
    return this.load(url, async () => {
      const response = await fetch(url, { signal: options.signal });
      if (!response.ok)
        throw new Error(`Image request failed (${response.status}): ${url}`);
      return createImageBitmap(await response.blob());
    });
  }

  async loadJson<T>(url: string, options: AssetLoadOptions = {}): Promise<T> {
    return this.load(url, async () => {
      const response = await fetch(url, { signal: options.signal });
      if (!response.ok)
        throw new Error(`JSON request failed (${response.status}): ${url}`);
      return response.json() as Promise<T>;
    });
  }

  async loadText(url: string, options: AssetLoadOptions = {}): Promise<string> {
    return this.load(url, async () => {
      const response = await fetch(url, { signal: options.signal });
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
    return this.load(url, async () => {
      const response = await fetch(url, { signal: options.signal });
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
    return this.load(key, async () => {
      const font = new FontFace(family, source, descriptors);
      await font.load();
      if (typeof document !== "undefined") document.fonts.add(font);
      return font;
    });
  }

  get<T>(key: string): T | undefined {
    return this.values.get(key) as T | undefined;
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
}
