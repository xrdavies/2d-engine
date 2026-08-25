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
  pageIndex: number;
  x: number;
  y: number;
  uv: TextureRegion;
}

interface AtlasPage {
  index: number;
  canvas: TextCanvas;
  cursorX: number;
  cursorY: number;
  rowHeight: number;
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

  constructor(
    readonly width = 1024,
    readonly height = 1024,
  ) {}

  get pageCount(): number {
    return this.atlasPages.length;
  }

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
    };
    page.cursorX = placement.nextX;
    page.cursorY = placement.y;
    page.rowHeight = placement.nextRowHeight;
    this.entries.set(key, entry);
    this.uploadEntry(entry);
    return entry;
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
    };
    this.atlasPages.push(page);
    return page;
  }

  private findPlacement(
    page: AtlasPage,
    width: number,
    height: number,
  ): Placement | undefined {
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
