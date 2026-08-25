import { describe, expect, it } from "vitest";
import { CanvasTextLayout } from "../../src/text2d/index.ts";

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
});
