import { describe, expect, it, vi } from "vitest";
import {
  type GpuResourceHandle,
  GpuResourceManager,
  ResourceCache,
} from "../../src/gpu/resources.ts";

type FakeGpuObject = {
  label?: string;
  destroy?: ReturnType<typeof vi.fn>;
  getMappedRange?: () => ArrayBuffer;
  unmap?: ReturnType<typeof vi.fn>;
};

function fakeDevice() {
  const buffers: Array<{
    descriptor: GPUBufferDescriptor;
    object: FakeGpuObject;
  }> = [];
  const textures: Array<{
    descriptor: GPUTextureDescriptor;
    object: FakeGpuObject;
  }> = [];
  const writes: Array<unknown[]> = [];
  const device = {
    queue: {
      writeBuffer: (...args: unknown[]) => writes.push(args),
      writeTexture: (...args: unknown[]) => writes.push(args),
    },
    createBuffer: (descriptor: GPUBufferDescriptor) => {
      const object: FakeGpuObject = {
        destroy: vi.fn(),
        getMappedRange: () => new ArrayBuffer(descriptor.size),
        unmap: vi.fn(),
      };
      buffers.push({ descriptor, object });
      return object;
    },
    createTexture: (descriptor: GPUTextureDescriptor) => {
      const object: FakeGpuObject = { destroy: vi.fn() };
      textures.push({ descriptor, object });
      return object;
    },
    createSampler: (descriptor: GPUSamplerDescriptor) => ({
      label: descriptor.label,
    }),
    createShaderModule: (descriptor: GPUShaderModuleDescriptor) => ({
      label: descriptor.label,
      getCompilationInfo: async () => ({ messages: [] }),
    }),
    createRenderPipeline: (descriptor: GPURenderPipelineDescriptor) => ({
      label: descriptor.label,
    }),
    createComputePipeline: (descriptor: GPUComputePipelineDescriptor) => ({
      label: descriptor.label,
    }),
    createBindGroup: (descriptor: GPUBindGroupDescriptor) => ({
      label: descriptor.label,
    }),
  } as unknown as GPUDevice;
  return { device, buffers, textures, writes };
}

describe("GPU resource core", () => {
  it("keeps cache semantics independent of WebGPU", () => {
    const cache = new ResourceCache<number>();
    cache.set("answer", 42);
    expect(cache.get("answer")).toBe(42);
    expect(cache.size).toBe(1);
    expect(cache.delete("answer")).toBe(true);
    expect(cache.get("answer")).toBeUndefined();
  });

  it("caches buffers and disposes the underlying object exactly once", () => {
    const fake = fakeDevice();
    const manager = new GpuResourceManager(fake.device);
    const first = manager.createBuffer({
      size: 16,
      usage: 1,
      label: "vertices",
    });
    const second = manager.createBuffer({
      size: 16,
      usage: 1,
      label: "vertices",
    });

    expect(second).toBe(first);
    expect(manager.size).toBe(1);
    manager.dispose(first);
    manager.dispose(first);
    expect(first.disposed).toBe(true);
    expect(fake.buffers[0]?.object.destroy).toHaveBeenCalledTimes(1);
    expect(() => first.resource).toThrow(/disposed/);
    expect(manager.size).toBe(0);
    expect(() => manager.assertEmpty()).not.toThrow();
  });

  it("uploads buffers and textures through the device queue", () => {
    const fake = fakeDevice();
    const manager = new GpuResourceManager(fake.device);
    const buffer = manager.createBuffer({ size: 8, usage: 1, cache: false });
    manager.uploadBuffer(buffer, new Uint32Array([1, 2]));
    const texture = manager.createTexture({
      size: { width: 2, height: 1 },
      format: "rgba8unorm",
      usage: 1,
      cache: false,
    });
    manager.uploadTexture(texture, new Uint8Array(8));

    expect(fake.writes).toHaveLength(2);
    expect(fake.writes[0]?.[2]).toBeInstanceOf(ArrayBuffer);
    const layout = fake.writes[1]?.[2] as GPUImageDataLayout;
    expect(layout.bytesPerRow).toBe(8);
  });

  it("supports all creation helpers and debug labels", async () => {
    const fake = fakeDevice();
    const manager = new GpuResourceManager(fake.device);
    const shader = manager.createShader({
      code: "@vertex fn main() -> @builtin(position) vec4f { return vec4f(); }",
      label: "main",
    });
    const pipeline = manager.createPipeline({
      type: "compute",
      layout: "auto",
      compute: { module: shader.resource, entryPoint: "main" },
    });
    const sampler = manager.createSampler({ label: "linear" });
    const bindGroup = manager.createBindGroup({
      layout: {} as GPUBindGroupLayout,
      entries: [],
    });

    manager.setDebugLabel(sampler, "updated");
    await manager.validateShader(shader);
    expect(pipeline.kind).toBe("pipeline");
    expect(sampler.label).toBe("updated");
    expect(bindGroup.kind).toBe("bindGroup");
  });

  it("can dispose a structural handle and rejects later use", () => {
    const state = { disposed: false };
    const handle = {
      get disposed() {
        return state.disposed;
      },
      dispose: () => {
        state.disposed = true;
      },
      assertAlive: () => undefined,
    } as unknown as GpuResourceHandle & { disposed: boolean };
    expect(() =>
      new GpuResourceManager(fakeDevice().device).dispose(handle),
    ).not.toThrow();
    expect(state.disposed).toBe(true);
  });
});
