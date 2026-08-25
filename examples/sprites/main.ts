import {
  Camera2D,
  Engine,
  Image2D,
  Renderer2D,
  Sprite,
  Transform2D,
  World,
} from "../../src/index.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#canvas");
const statusElement = document.querySelector<HTMLElement>("#status");
const statsElement = document.querySelector<HTMLElement>("#stats");

if (!canvas || !statusElement || !statsElement) {
  throw new Error("Sprite example markup is incomplete");
}

try {
  const engine = await Engine.create({ canvas });
  const texture = engine.gpu.device.createTexture({
    label: "example-pixel",
    size: { width: 1, height: 1, depthOrArrayLayers: 1 },
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  engine.gpu.device.queue.writeTexture(
    { texture },
    new Uint8Array([70, 180, 255, 255]),
    { bytesPerRow: 4 },
    { width: 1, height: 1, depthOrArrayLayers: 1 },
  );

  const renderer = new Renderer2D(engine.gpu);
  const camera = new Camera2D({
    position: { x: 320, y: 180 },
    viewportWidth: canvas.width,
    viewportHeight: canvas.height,
  });
  const world = new World();
  const imageEntity = world.createEntity();
  const spriteEntity = world.createEntity();
  const image = new Image2D({
    texture,
    position: { x: 0, y: 0 },
    size: { x: 120, y: 120 },
    color: [0.2, 0.8, 1, 1],
    layer: 0,
  });
  const sprite = new Sprite({
    texture,
    position: { x: 0, y: 0 },
    size: { x: 120, y: 120 },
    frame: { x: 0, y: 0, width: 1, height: 1 },
    color: [1, 0.55, 0.2, 1],
    layer: 0,
  });
  world.addTransform(
    imageEntity,
    new Transform2D({ position: { x: 220, y: 180 } }),
  );
  world.addTransform(
    spriteEntity,
    new Transform2D({ position: { x: 420, y: 180 } }),
  );
  const renderItems = world.extractRenderItems((entity, transform) => {
    const item =
      entity === imageEntity
        ? image
        : entity === spriteEntity
          ? sprite
          : undefined;
    if (!item) return undefined;
    item.position = transform.worldPosition;
    return item;
  });
  const stats = renderer.render(renderItems, camera);
  statusElement.textContent = "Rendered Image2D and Sprite";
  statsElement.textContent = JSON.stringify(stats);
  (window as unknown as { __engineRendered?: boolean }).__engineRendered = true;
  engine.on("resize", ({ pixelWidth, pixelHeight }) => {
    camera.setViewport(pixelWidth, pixelHeight);
    renderer.render(
      world.extractRenderItems((entity, transform) => {
        const item =
          entity === imageEntity
            ? image
            : entity === spriteEntity
              ? sprite
              : undefined;
        if (!item) return undefined;
        item.position = transform.worldPosition;
        return item;
      }),
      camera,
    );
  });
} catch (error) {
  statusElement.textContent = "WebGPU unavailable";
  statsElement.textContent =
    error instanceof Error ? error.message : String(error);
}
