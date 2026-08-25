import { describe, expect, it } from "vitest";
import { PretextTextLayout } from "../../src/text2d/index.ts";

describe("PretextTextLayout", () => {
  it("adapts prepare and line layout without importing Pretext", () => {
    const backend = new PretextTextLayout({
      prepareWithSegments: (text) => ({ text }),
      layoutWithLines: (prepared, _width, lineHeight) => ({
        height: lineHeight,
        lines: [{ text: (prepared as { text: string }).text, width: 42 }],
      }),
    });
    const prepared = backend.prepare("世界", "16px sans-serif");
    expect(backend.layout(prepared, 100, 20).lines[0]?.text).toBe("世界");
  });
});
