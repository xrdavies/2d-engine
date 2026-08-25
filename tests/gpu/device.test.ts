import { describe, expect, it, vi } from "vitest";
import { withGpuErrorScope } from "../../src/gpu/device.ts";

describe("WebGPU error scopes", () => {
  it("turns captured GPU errors into exceptions", async () => {
    const device = {
      pushErrorScope: vi.fn(),
      popErrorScope: vi.fn().mockResolvedValue({ message: "invalid resource" }),
    } as unknown as GPUDevice;

    await expect(
      withGpuErrorScope(device, "validation", () => undefined),
    ).rejects.toThrow("WebGPU validation error: invalid resource");
    expect(device.pushErrorScope).toHaveBeenCalledWith("validation");
  });

  it("returns callback values when the scope is clean", async () => {
    const device = {
      pushErrorScope: vi.fn(),
      popErrorScope: vi.fn().mockResolvedValue(null),
    } as unknown as GPUDevice;
    await expect(
      withGpuErrorScope(device, "validation", () => 42),
    ).resolves.toBe(42);
  });
});
