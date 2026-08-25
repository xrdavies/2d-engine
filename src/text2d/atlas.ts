import type { TextLayoutResult } from "./layout.ts";
import type {
  RasterizedText,
  TextRasterizer,
  TextRasterStyle,
} from "./rasterizer.ts";

export class TextAtlas {
  private readonly entries = new Map<string, RasterizedText>();

  get(key: string): RasterizedText | undefined {
    return this.entries.get(key);
  }

  getOrCreate(
    key: string,
    layout: TextLayoutResult,
    style: TextRasterStyle,
    rasterizer: TextRasterizer,
  ): RasterizedText {
    const existing = this.entries.get(key);
    if (existing) return existing;
    const value = rasterizer.rasterize(layout, style);
    this.entries.set(key, value);
    return value;
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
