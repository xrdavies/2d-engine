import type { TextureRegion } from "../render2d/quad.ts";
import type { TextLayoutResult } from "./layout.ts";
import type {
  RasterizedText,
  TextCanvas,
  TextRasterizer,
  TextRasterStyle,
} from "./rasterizer.ts";

export interface TextAtlasEntry {
  key: string;
  scene: string;
  rasterized: RasterizedText;
  pageIndex: number;
  x: number;
  y: number;
  uv: TextureRegion;
  lastUsed: number;
}

interface FreeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AtlasPage {
  index: number;
  canvas: TextCanvas;
  cursorX: number;
  cursorY: number;
  rowHeight: number;
  entries: Set<string>;
  freeRects: FreeRect[];
}

interface GpuPage {
  device: GPUDevice;
  pageIndex: number;
  texture: GPUTexture;
}

interface Placement {
  x: number;
  y: number;
  nextX: number;
  nextRowHeight: number;
  freeIndex?: number;
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
  private readonly atlasPages: AtlasPage[] = [];
  private readonly gpuPages = new Set<GpuPage>();
  private accessCounter = 0;

  constructor(
    readonly width = 1024,
    readonly height = 1024,
    readonly maxEntries = Number.POSITIVE_INFINITY,
  ) {
    if (!(maxEntries > 0))
      throw new RangeError("Text atlas maxEntries must be positive");
  }

  get pageCount(): number {
    return this.atlasPages.length;
  }

  get(key: string): RasterizedText | undefined {
    this.touch(key);
    return this.rasterized.get(key);
  }

  getEntry(key: string): TextAtlasEntry | undefined {
    const entry = this.entries.get(key);
    if (entry) entry.lastUsed = ++this.accessCounter;
    return entry;
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
    scene = "global",
  ): TextAtlasEntry {
    const existing = this.getEntry(key);
    if (existing) return existing;
    while (this.entries.size >= this.maxEntries) this.evictLru();
    const value = this.getOrCreate(key, layout, style, rasterizer);
    if (value.width > this.width || value.height > this.height) {
      throw new RangeError("Text run is larger than an atlas page");
    }

    let page: AtlasPage | undefined;
    let placement: Placement | undefined;
    for (const candidate of this.atlasPages) {
      const available = this.findPlacement(
        candidate,
        value.width,
        value.height,
      );
      if (available) {
        page = candidate;
        placement = available;
        break;
      }
    }
    page ??= this.createPage();
    placement ??= this.findPlacement(page, value.width, value.height);
    if (!placement)
      throw new RangeError("Text run is larger than an atlas page");

    const context = page.canvas.getContext("2d");
    if (!context) throw new Error("Unable to create the text atlas context");
    context.drawImage(value.canvas, placement.x, placement.y);
    const entry: TextAtlasEntry = {
      key,
      scene,
      rasterized: value,
      pageIndex: page.index,
      x: placement.x,
      y: placement.y,
      uv: {
        x: placement.x / this.width,
        y: placement.y / this.height,
        width: value.width / this.width,
        height: value.height / this.height,
      },
      lastUsed: ++this.accessCounter,
    };
    if (placement.freeIndex !== undefined) {
      const free = page.freeRects.splice(placement.freeIndex, 1)[0];
      if (free) this.splitFreeRect(page, free, value.width, value.height);
    } else {
      page.cursorX = placement.nextX;
      page.cursorY = placement.y;
      page.rowHeight = placement.nextRowHeight;
    }
    page.entries.add(key);
    this.entries.set(key, entry);
    this.uploadEntry(entry);
    return entry;
  }

  remove(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    this.entries.delete(key);
    this.rasterized.delete(key);
    const page = this.atlasPages[entry.pageIndex];
    if (page) {
      page.entries.delete(key);
      page.freeRects.push({
        x: entry.x,
        y: entry.y,
        width: entry.rasterized.width,
        height: entry.rasterized.height,
      });
      if (page.entries.size === 0) this.resetPage(page);
    }
    return true;
  }

  clearScene(scene: string): number {
    const keys = [...this.entries.values()]
      .filter((entry) => entry.scene === scene)
      .map((entry) => entry.key);
    for (const key of keys) this.remove(key);
    return keys.length;
  }

  evictLru(count = 1): readonly string[] {
    const removed: string[] = [];
    for (let index = 0; index < count; index += 1) {
      let oldest: TextAtlasEntry | undefined;
      for (const entry of this.entries.values()) {
        if (!oldest || entry.lastUsed < oldest.lastUsed) oldest = entry;
      }
      if (!oldest) break;
      removed.push(oldest.key);
      this.remove(oldest.key);
    }
    return removed;
  }

  createTexture(device: GPUDevice, pageIndex = 0): GPUTexture {
    const page = this.atlasPages[pageIndex];
    if (!page) throw new RangeError(`Unknown text atlas page: ${pageIndex}`);
    for (const gpuPage of this.gpuPages) {
      if (gpuPage.device === device && gpuPage.pageIndex === pageIndex) {
        return gpuPage.texture;
      }
    }
    const texture = device.createTexture({
      label: `text-atlas-${pageIndex}`,
      size: { width: this.width, height: this.height, depthOrArrayLayers: 1 },
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    const gpuPage = { device, pageIndex, texture };
    this.gpuPages.add(gpuPage);
    for (const entry of this.entries.values()) {
      if (entry.pageIndex === pageIndex) this.uploadEntryToPage(entry, gpuPage);
    }
    return texture;
  }

  clear(): void {
    this.rasterized.clear();
    this.entries.clear();
    for (const page of this.gpuPages) page.texture.destroy();
    this.gpuPages.clear();
    this.atlasPages.length = 0;
    this.accessCounter = 0;
  }

  get size(): number {
    return this.rasterized.size;
  }

  private createPage(): AtlasPage {
    const page: AtlasPage = {
      index: this.atlasPages.length,
      canvas: createCanvas(this.width, this.height),
      cursorX: 0,
      cursorY: 0,
      rowHeight: 0,
      entries: new Set(),
      freeRects: [],
    };
    this.atlasPages.push(page);
    return page;
  }

  private findPlacement(
    page: AtlasPage,
    width: number,
    height: number,
  ): Placement | undefined {
    const freeIndex = page.freeRects.findIndex(
      (rect) => width <= rect.width && height <= rect.height,
    );
    if (freeIndex >= 0) {
      const rect = page.freeRects[freeIndex] as FreeRect;
      return {
        x: rect.x,
        y: rect.y,
        nextX: page.cursorX,
        nextRowHeight: page.rowHeight,
        freeIndex,
      };
    }
    let x = page.cursorX;
    let y = page.cursorY;
    let rowHeight = page.rowHeight;
    if (x + width > this.width) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    if (y + height > this.height) return undefined;
    return {
      x,
      y,
      nextX: x + width,
      nextRowHeight: Math.max(rowHeight, height),
    };
  }

  private splitFreeRect(
    page: AtlasPage,
    rect: FreeRect,
    width: number,
    height: number,
  ): void {
    if (rect.width > width) {
      page.freeRects.push({
        x: rect.x + width,
        y: rect.y,
        width: rect.width - width,
        height,
      });
    }
    if (rect.height > height) {
      page.freeRects.push({
        x: rect.x,
        y: rect.y + height,
        width: rect.width,
        height: rect.height - height,
      });
    }
  }

  private resetPage(page: AtlasPage): void {
    page.cursorX = 0;
    page.cursorY = 0;
    page.rowHeight = 0;
    page.freeRects.length = 0;
    const context = page.canvas.getContext("2d");
    context?.clearRect(0, 0, this.width, this.height);
    for (const gpuPage of [...this.gpuPages]) {
      if (gpuPage.pageIndex !== page.index) continue;
      gpuPage.texture.destroy();
      this.gpuPages.delete(gpuPage);
    }
  }

  private touch(key: string): void {
    const entry = this.entries.get(key);
    if (entry) entry.lastUsed = ++this.accessCounter;
  }

  private uploadEntry(entry: TextAtlasEntry): void {
    for (const page of this.gpuPages) {
      if (page.pageIndex === entry.pageIndex)
        this.uploadEntryToPage(entry, page);
    }
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
