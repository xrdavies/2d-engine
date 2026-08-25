import { describe, expect, it } from "vitest";
import { Camera2D } from "../../src/render2d/index.ts";
import { writeTexturedQuadInstance } from "../../src/render2d/renderer.ts";

describe("Camera2D", () => {
  it("round trips screen and world coordinates", () => {
    const camera = new Camera2D({
      position: { x: 10, y: 20 },
      zoom: 2,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    const world = { x: 22, y: 35 };
    const screen = camera.worldToScreen(world);
    expect(screen).toEqual({ x: 424, y: 330 });
    expect(camera.screenToWorld(screen)).toEqual(world);
  });

  it("rejects invalid zoom and viewport values", () => {
    const camera = new Camera2D();
    expect(() => camera.setZoom(0)).toThrow();
    expect(() => camera.setViewport(0, 10)).toThrow();
  });
});

describe("Renderer2D instance transform", () => {
  it("expands a centered quad downward in screen coordinates", () => {
    const camera = new Camera2D({
      position: { x: 320, y: 180 },
      viewportWidth: 640,
      viewportHeight: 360,
    });
    const data = new Float32Array(16);
    writeTexturedQuadInstance(
      data,
      0,
      {
        texture: {} as GPUTexture,
        position: { x: 320, y: 180 },
        size: { x: 120, y: 120 },
        rotation: 0,
        anchor: { x: 0.5, y: 0.5 },
        uv: { x: 0, y: 0, width: 1, height: 1 },
        color: [1, 1, 1, 1],
        layer: 0,
        visible: true,
      },
      camera,
    );

    expect(data[3]).toBeCloseTo(-2 / 3);
    expect(data[5]).toBeCloseTo(1 / 3);
  });
});
