import { describe, expect, it } from "vitest";
import { checkBenchmarkBaseline } from "../../src/debug/index.ts";

describe("benchmark baseline", () => {
  it("reports regressions using a tolerance", () => {
    const result = checkBenchmarkBaseline(
      [{ name: "10k", objects: 10_000, batches: 1, draws: 1, cpuMs: 13 }],
      { "10k": { maxCpuMs: 10 } },
      1.2,
    );
    expect(result.passed).toBe(false);
    expect(result.failures[0]).toMatch(/CPU/);
  });
});
