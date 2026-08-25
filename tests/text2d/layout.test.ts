import { describe, expect, it } from "vitest";
import { CanvasTextLayout, TextAtlas } from "../../src/text2d/index.ts";

describe("CanvasTextLayout", () => {
  it("wraps text and reports line ranges", () => {
    const context = {
      font: "",
      measureText: (text: string) =>
        ({ width: text.length * 10 }) as TextMetrics,
    };
    const layout = new CanvasTextLayout(context).layout(
      new CanvasTextLayout(context).prepare("abcd", "10px sans-serif"),
      25,
      16,
    );
    expect(layout.lines.map((line) => line.text)).toEqual(["ab", "cd"]);
    expect(layout.height).toBe(32);
  });

  it("reuses a cached rasterized text run", () => {
    const atlas = new TextAtlas();
    const layout = { width: 10, height: 16, lineHeight: 16, lines: [] };
    const rasterizer = {
      rasterize: () => ({ canvas: {}, width: 10, height: 16, layout }),
    } as never;
    const style = { font: "10px sans-serif" };
    const first = atlas.getOrCreate("same", layout, style, rasterizer);
    const second = atlas.getOrCreate("same", layout, style, rasterizer);
    expect(first).toBe(second);
    expect(atlas.size).toBe(1);
  });
});
