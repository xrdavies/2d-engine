import { describe, expect, it } from "vitest";
import { GpuTimestampQuery } from "../../src/gpu/timing.ts";

describe("GpuTimestampQuery", () => {
  it("is safely disabled without the optional feature", () => {
    const timing = new GpuTimestampQuery({
      device: { features: new Set() },
    } as never);
    expect(timing.supported).toBe(false);
    expect(timing.readTicks()).resolves.toBeNull();
  });
});
