import { describe, expect, it } from "vitest";
import type { Renderer2DRenderOptions } from "../../src/render2d/index.ts";

describe("Renderer2D scissor contract", () => {
  it("accepts a non-negative viewport rectangle", () => {
    const options: Renderer2DRenderOptions = {
      scissor: { x: 0, y: 0, width: 100, height: 80 },
    };
    expect(options.scissor?.width).toBe(100);
  });
});
