import type { TextureRegion } from "../render2d/quad.ts";
import type { TextLayoutResult } from "./layout.ts";
import type {
  RasterizedText,
  TextCanvas,
  TextRasterizer,
  TextRasterStyle,
} from "./rasterizer.ts";

export interface TextAtlasEntry {
  rasterized: RasterizedText;
  x: number;
  y: number;
  uv: TextureRegion;
}

interface GpuPage {
  device: GPUDevice;
  texture: GPUTexture;
}

function createCanvas(width: number, height: number): TextCanvas {
  if (typeof OffscreenCanvas !== "undefined")
    return new OffscreenCanvas(width, height);
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new Error("Text atlas requires a browser canvas or OffscreenCanvas");
}

export class TextAtlas {
  private readonly rasterized = new Map<string, RasterizedText>();
  private readonly entries = new Map<string, TextAtlasEntry>();
  private readonly pages = new Set<GpuPage>();
  private canvasValue: TextCanvas | undefined;
  private cursorX = 0;
  private cursorY = 0;
  private rowHeight = 0;

  constructor(
    readonly width = 1024,
    readonly height = 1024,
  ) {}

  get(key: string): RasterizedText | undefined {
    return this.rasterized.get(key);
  }

  getEntry(key: string): TextAtlasEntry | undefined {
    return this.entries.get(key);
  }

  getOrCreate(
    key: string,
    layout: TextLayoutResult,
    style: TextRasterStyle,
    rasterizer: TextRasterizer,
  ): RasterizedText {
    const existing = this.rasterized.get(key);
    if (existing) return existing;
    const value = rasterizer.rasterize(layout, style);
    this.rasterized.set(key, value);
    return value;
  }

  getOrCreateEntry(
    key: string,
    layout: TextLayoutResult,
    style: TextRasterStyle,
    rasterizer: TextRasterizer,
  ): TextAtlasEntry {
    const existing = this.entries.get(key);
    if (existing) return existing;
    const value = this.getOrCreate(key, layout, style, rasterizer);
    if (value.width > this.width || value.height > this.height) {
      throw new RangeError("Text run is larger than the atlas page");
    }
    if (this.cursorX + value.width > this.width) {
      this.cursorX = 0;
      this.cursorY += this.rowHeight;
      this.rowHeight = 0;
    }
    if (this.cursorY + value.height > this.height) {
      // ponytail: one atlas page; add page allocation when real content exceeds it.
      throw new RangeError("Text atlas page is full");
    }
    const canvas = this.canvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to create the text atlas context");
    context.drawImage(value.canvas, this.cursorX, this.cursorY);
    const entry: TextAtlasEntry = {
      rasterized: value,
      x: this.cursorX,
      y: this.cursorY,
      uv: {
        x: this.cursorX / this.width,
        y: this.cursorY / this.height,
        width: value.width / this.width,
        height: value.height / this.height,
      },
    };
    this.entries.set(key, entry);
    this.uploadEntry(entry);
    this.cursorX += value.width;
    this.rowHeight = Math.max(this.rowHeight, value.height);
    return entry;
  }

  createTexture(device: GPUDevice): GPUTexture {
    for (const page of this.pages) {
      if (page.device === device) return page.texture;
    }
    const texture = device.createTexture({
      label: "text-atlas",
      size: { width: this.width, height: this.height, depthOrArrayLayers: 1 },
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    const page = { device, texture };
    this.pages.add(page);
    for (const entry of this.entries.values())
      this.uploadEntryToPage(entry, page);
    return texture;
  }

  clear(): void {
    this.rasterized.clear();
    this.entries.clear();
    for (const page of this.pages) page.texture.destroy();
    this.pages.clear();
    this.canvasValue = undefined;
    this.cursorX = 0;
    this.cursorY = 0;
    this.rowHeight = 0;
  }

  get size(): number {
    return this.rasterized.size;
  }

  private get canvas(): TextCanvas {
    this.canvasValue ??= createCanvas(this.width, this.height);
    return this.canvasValue;
  }

  private uploadEntry(entry: TextAtlasEntry): void {
    for (const page of this.pages) this.uploadEntryToPage(entry, page);
  }

  private uploadEntryToPage(entry: TextAtlasEntry, page: GpuPage): void {
    const context = entry.rasterized.canvas.getContext("2d");
    if (!context) throw new Error("Unable to read rasterized text pixels");
    const pixels = context.getImageData(
      0,
      0,
      entry.rasterized.width,
      entry.rasterized.height,
    );
    page.device.queue.writeTexture(
      { texture: page.texture, origin: { x: entry.x, y: entry.y } },
      pixels.data,
      { bytesPerRow: entry.rasterized.width * 4 },
      {
        width: entry.rasterized.width,
        height: entry.rasterized.height,
        depthOrArrayLayers: 1,
      },
    );
  }
}
