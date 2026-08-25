import { describe, expect, it } from "vitest";
import { Diagnostics } from "../../src/debug/index.ts";

describe("Diagnostics", () => {
  it("records frame and render counters", () => {
    const diagnostics = new Diagnostics();
    diagnostics.beginFrame(10);
    diagnostics.recordRender({ batches: 2, draws: 2, visibleItems: 5 });
    diagnostics.recordResources(3);
    const stats = diagnostics.endFrame(14, 1 / 60);
    expect(stats.frame).toBe(1);
    expect(stats.cpuMs).toBe(4);
    expect(stats.visibleItems).toBe(5);
    expect(stats.gpuResources).toBe(3);
  });
});
