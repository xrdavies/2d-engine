import { describe, expect, it } from "vitest";
import {
  CanvasTextLayout,
  defaultTextAtlas,
  Text2D,
  TextAtlas,
  type TextLayoutBackend,
} from "../../src/text2d/index.ts";

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

  it("can reuse prepared text across width changes", () => {
    let prepares = 0;
    const backend: TextLayoutBackend = {
      prepare: (text, font, options = {}) => {
        prepares += 1;
        return {
          text,
          font,
          options,
          graphemes: [...text],
          widths: [...text].map(() => 10),
        };
      },
      layout: (prepared, maxWidth, lineHeight) => ({
        width: Math.min(maxWidth, 40),
        height: lineHeight,
        lineHeight,
        lines: [
          {
            text: prepared.text,
            width: 40,
            start: 0,
            end: prepared.text.length,
          },
        ],
      }),
    };
    const text = new Text2D(
      { text: "abcd", font: "10px sans-serif", maxWidth: 20 },
      backend,
    );
    text.layout();
    text.maxWidth = 40;
    text.layout();
    expect(prepares).toBe(1);
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

  it("collapses whitespace and prefers word boundaries", () => {
    const context = {
      font: "",
      measureText: (text: string) =>
        ({ width: text.length * 10 }) as TextMetrics,
    };
    const backend = new CanvasTextLayout(context);
    const prepared = backend.prepare("hello   world", "10px sans-serif");
    const result = backend.layout(prepared, 60, 16);
    expect(result.lines.map((line) => line.text)).toEqual(["hello", "world"]);
  });

  it("shares the default atlas across text objects", () => {
    const backend: TextLayoutBackend = {
      prepare: (text, font, options = {}) => ({
        text,
        font,
        options,
        graphemes: [...text],
        widths: [...text].map(() => 1),
      }),
      layout: (prepared) => ({
        width: prepared.text.length,
        height: 10,
        lineHeight: 10,
        lines: [],
      }),
    };
    const first = new Text2D({ text: "a", font: "10px sans-serif" }, backend);
    const second = new Text2D({ text: "b", font: "10px sans-serif" }, backend);
    expect(first.atlas).toBe(defaultTextAtlas);
    expect(second.atlas).toBe(defaultTextAtlas);
  });
});
