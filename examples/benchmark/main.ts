import { Camera2D, Engine, Image2D, Renderer2D } from "../../src/index.ts";

const status = document.querySelector<HTMLElement>("#status");
const result = document.querySelector<HTMLElement>("#result");
if (!status || !result)
  throw new Error("Benchmark example markup is incomplete");

try {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  document.body.appendChild(canvas);
  const engine = await Engine.create({ canvas });
  const texture = engine.gpu.device.createTexture({
    size: { width: 1, height: 1, depthOrArrayLayers: 1 },
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  engine.gpu.device.queue.writeTexture(
    { texture },
    new Uint8Array([255, 255, 255, 255]),
    { bytesPerRow: 4 },
    { width: 1, height: 1, depthOrArrayLayers: 1 },
  );
  const camera = new Camera2D({
    position: { x: 320, y: 180 },
    viewportWidth: 640,
    viewportHeight: 360,
  });
  const items = Array.from(
    { length: 10_000 },
    (_, index) =>
      new Image2D({
        texture,
        position: { x: (index % 100) * 16, y: Math.floor(index / 100) * 16 },
        size: { x: 12, y: 12 },
      }),
  );
  const renderer = new Renderer2D(engine.gpu);
  const start = performance.now();
  const stats = renderer.render(items, camera);
  const cpuMs = performance.now() - start;
  status.textContent = "Benchmark completed";
  result.textContent = JSON.stringify(
    { objects: items.length, ...stats, cpuMs },
    null,
    2,
  );
} catch (error) {
  status.textContent = "Benchmark harness ready";
  result.textContent = error instanceof Error ? error.message : String(error);
}
