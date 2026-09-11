import { describe, expect, it } from "vitest";
import { canvasCssSize } from "../src/core/engine.ts";
import { Diagnostics, ENGINE_VERSION, FixedClock } from "../src/index.ts";

describe("package entry point", () => {
  it("exports the engine version", () => {
    expect(ENGINE_VERSION).toBe("0.1.2");
  });

  it("clamps long frames and limits fixed steps", () => {
    const clock = new FixedClock({
      fixedDelta: 1 / 60,
      maxDelta: 0.25,
      maxSteps: 5,
    });
    const step = clock.advance(10);

    expect(step.delta).toBe(0.25);
    expect(step.steps).toBe(5);
    expect(step.alpha).toBe(0);
  });

  it("does not treat a display-none canvas as its drawing-buffer size", () => {
    expect(canvasCssSize({ clientWidth: 0, clientHeight: 0 })).toEqual({
      width: 1,
      height: 1,
    });
    expect(canvasCssSize({ clientWidth: 0, clientHeight: 720 })).toEqual({
      width: 1,
      height: 1,
    });
    expect(canvasCssSize({ clientWidth: 390, clientHeight: 844 })).toEqual({
      width: 390,
      height: 844,
    });
  });

  it("records Engine diagnostics on system frames", async () => {
    const engine = await import("../src/core/engine.ts");
    expect(engine.Engine).toBeDefined();
    const diagnostics = new Diagnostics();
    diagnostics.beginFrame(10);
    diagnostics.endFrame(12, 1 / 60);
    expect(diagnostics.snapshot()).toMatchObject({ frame: 1, cpuMs: 2 });
  });
});
