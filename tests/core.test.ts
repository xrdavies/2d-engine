import { describe, expect, it } from "vitest";
import { ENGINE_VERSION, FixedClock } from "../src/index.ts";

describe("package entry point", () => {
  it("exports the engine version", () => {
    expect(ENGINE_VERSION).toBe("0.1.0");
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
});
