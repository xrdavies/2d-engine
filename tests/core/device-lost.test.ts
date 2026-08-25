import { describe, expect, it } from "vitest";

describe("device loss contract", () => {
  it("exposes a recreate-required recovery policy", async () => {
    const { Engine } = await import("../../src/core/engine.ts");
    expect(() => {
      const fake = Object.create(Engine.prototype) as { recover(): never };
      fake.recover();
    }).toThrow("recreating Engine");
  });
});
