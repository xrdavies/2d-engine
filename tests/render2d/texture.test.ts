import { describe, expect, it } from "vitest";
import { solidTextureBytes } from "../../src/render2d/texture.ts";
import { Shape2D } from "../../src/render2d/shape.ts";

describe("solid textures and shapes", () => {
  it("packs RGBA bytes for a 1x1 solid", () => {
    expect([...solidTextureBytes([226, 192, 120, 255])]).toEqual([
      226, 192, 120, 255,
    ]);
    expect([...solidTextureBytes()]).toEqual([255, 255, 255, 255]);
  });

  it("builds a tinted shape quad", () => {
    const texture = {} as GPUTexture;
    const shape = new Shape2D({
      texture,
      position: { x: 10, y: 20 },
      size: { x: 40, y: 16 },
      color: [1, 0.8, 0.4, 1],
      layer: 3,
    });
    expect(shape.texture).toBe(texture);
    expect(shape.size).toEqual({ x: 40, y: 16 });
    expect(shape.color[0]).toBe(1);
    expect(shape.layer).toBe(3);
    expect(shape.toRenderItem()).toBe(shape);
  });
});
