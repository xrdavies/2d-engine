import { describe, expect, it } from "vitest";
import { Camera2D } from "../../src/render2d/index.ts";

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
