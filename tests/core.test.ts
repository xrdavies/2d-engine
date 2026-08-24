import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "../src/index.ts";

describe("package entry point", () => {
  it("exports the engine version", () => {
    expect(ENGINE_VERSION).toBe("0.1.0");
  });
});
