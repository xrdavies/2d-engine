import { describe, expect, it } from "vitest";
import { AssetManager } from "../../src/assets/index.ts";

describe("AssetManager", () => {
  it("deduplicates concurrent and cached loads", async () => {
    const assets = new AssetManager();
    let loads = 0;
    const loader = () => {
      loads += 1;
      return Promise.resolve({ value: 42 });
    };
    const [first, second] = await Promise.all([
      assets.load("answer", loader),
      assets.load("answer", loader),
    ]);
    expect(first).toBe(second);
    expect(loads).toBe(1);
    expect(assets.get<{ value: number }>("answer")?.value).toBe(42);
  });
});
