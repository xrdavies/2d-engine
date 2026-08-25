import { Camera2D, Engine, Image2D, Renderer2D } from "../../src/index.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#canvas");
const status = document.querySelector<HTMLElement>("#status");
if (!canvas || !status) throw new Error("Image example markup is incomplete");

try {
  const engine = await Engine.create({ canvas });
  const texture = engine.gpu.device.createTexture({
    size: { width: 1, height: 1, depthOrArrayLayers: 1 },
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  engine.gpu.device.queue.writeTexture(
    { texture },
    new Uint8Array([56, 189, 128, 255]),
    { bytesPerRow: 4 },
    { width: 1, height: 1, depthOrArrayLayers: 1 },
  );
  const renderer = new Renderer2D(engine.gpu);
  const items = [
    new Image2D({
      texture,
      position: { x: 320, y: 180 },
      size: { x: 200, y: 120 },
    }),
  ];
  const camera = new Camera2D({
    position: { x: 320, y: 180 },
    viewportWidth: 640,
    viewportHeight: 360,
  });
  const target = renderer.createRenderTarget(640, 360);
  await engine.gpu.withErrorScope("validation", () => {
    renderer.render(items, camera, { targetView: target.createView() });
  });
  target.destroy();
  renderer.render(items, camera);
  (window as unknown as { __renderTargetReady?: boolean }).__renderTargetReady =
    true;
  status.textContent = "Image2D rendered";
} catch (error) {
  status.textContent = error instanceof Error ? error.message : String(error);
}
