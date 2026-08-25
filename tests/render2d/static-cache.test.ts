import { describe, expect, it } from "vitest";
import { Camera2D, Renderer2D } from "../../src/render2d/index.ts";

describe("Renderer2D static cache", () => {
  it("exposes invalidation for static item arrays", () => {
    expect(typeof Renderer2D.prototype.invalidateStatic).toBe("function");
    expect(new Camera2D().zoom).toBe(1);
  });
});
