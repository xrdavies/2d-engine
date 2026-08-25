import { describe, expect, it, vi } from "vitest";
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

  it("uploads decoded image data into a GPU texture", async () => {
    const queue = { copyExternalImageToTexture: vi.fn() };
    const device = {
      createTexture: vi.fn(() => ({ width: 2, height: 3, destroy: vi.fn() })),
      queue,
    } as unknown as GPUDevice;
    const image = { width: 2, height: 3 } as ImageBitmap;
    const texture = await new AssetManager().uploadImage("hero", image, device);
    expect(texture).toBeTruthy();
    expect(queue.copyExternalImageToTexture).toHaveBeenCalledOnce();
  });
});
