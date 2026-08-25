import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NumericTextAtlas,
  type TextLayoutBackend,
} from "../../src/text2d/index.ts";

class FakeCanvas {
  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  getContext() {
    return {
      drawImage() {},
      clearRect() {},
      fillText() {},
      getImageData: () => ({
        data: new Uint8Array(this.width * this.height * 4),
      }),
    };
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("NumericTextAtlas", () => {
  it("composes values from a fixed glyph set", () => {
    vi.stubGlobal("OffscreenCanvas", FakeCanvas);
    vi.stubGlobal("GPUTextureUsage", { TEXTURE_BINDING: 4, COPY_DST: 2 });
    const backend: TextLayoutBackend = {
      prepare: (text, font, options = {}) => ({
        text,
        font,
        options,
        graphemes: [text],
        widths: [4],
      }),
      layout: (prepared) => ({
        width: 4,
        height: 6,
        lineHeight: 6,
        lines: [{ text: prepared.text, width: 4, start: 0, end: 1 }],
      }),
    };
    const numeric = new NumericTextAtlas({
      font: "6px sans-serif",
      characters: "012",
      layoutBackend: backend,
    });
    const device = {
      createTexture: () => ({ destroy() {} }),
      queue: { writeTexture() {} },
    } as unknown as GPUDevice;

    const first = numeric.createQuads("121", device);
    const second = numeric.createQuads("202", device);

    expect(first).toHaveLength(3);
    expect(second).toHaveLength(3);
    expect(numeric.glyphCount).toBe(3);
    expect(numeric.atlas.size).toBe(3);
    for (const item of [...first, ...second]) item.dispose();
  });
});
