import { afterEach, describe, expect, it, vi } from "vitest";
import { TextAtlas } from "../../src/text2d/index.ts";

class FakeCanvas {
  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  getContext() {
    return {
      drawImage() {},
      clearRect() {},
      getImageData: () => ({
        data: new Uint8Array(this.width * this.height * 4),
      }),
    };
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("TextAtlas pages", () => {
  it("allocates a new logical page when existing pages are full", () => {
    vi.stubGlobal("OffscreenCanvas", FakeCanvas);
    const atlas = new TextAtlas(8, 8);
    const layout = { width: 6, height: 6, lineHeight: 6, lines: [] };
    const rasterizer = {
      rasterize: () => ({
        canvas: new FakeCanvas(6, 6),
        width: 6,
        height: 6,
        layout,
      }),
    } as never;
    const style = { font: "6px sans-serif" };

    const first = atlas.getOrCreateEntry("first", layout, style, rasterizer);
    const second = atlas.getOrCreateEntry("second", layout, style, rasterizer);

    expect(first.pageIndex).toBe(0);
    expect(second.pageIndex).toBe(1);
    expect(atlas.pageCount).toBe(2);
  });

  it("removes entries and evicts the least recently used entry", () => {
    vi.stubGlobal("OffscreenCanvas", FakeCanvas);
    const atlas = new TextAtlas(8, 8, 2);
    const layout = { width: 6, height: 6, lineHeight: 6, lines: [] };
    const rasterizer = {
      rasterize: () => ({
        canvas: new FakeCanvas(6, 6),
        width: 6,
        height: 6,
        layout,
      }),
    } as never;
    const style = { font: "6px sans-serif" };
    atlas.getOrCreateEntry("first", layout, style, rasterizer);
    atlas.getOrCreateEntry("second", layout, style, rasterizer);
    atlas.getEntry("first");

    atlas.getOrCreateEntry("third", layout, style, rasterizer);

    expect(atlas.getEntry("first")).toBeDefined();
    expect(atlas.getEntry("second")).toBeUndefined();
    expect(atlas.getEntry("third")).toBeDefined();
    expect(atlas.remove("third")).toBe(true);
    expect(atlas.getEntry("third")).toBeUndefined();
  });
});
