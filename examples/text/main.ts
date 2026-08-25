import { Camera2D, Engine, Renderer2D, Text2D } from "../../src/index.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#canvas");
const status = document.querySelector<HTMLElement>("#status");
if (!canvas || !status) throw new Error("Text example markup is incomplete");
const text = new Text2D({
  text: "Hello 世界，WebGPU 游戏引擎支持多语言世界文字与自动换行。",
  font: "28px sans-serif",
  maxWidth: 360,
  lineHeight: 36,
  position: { x: 20, y: 20 },
});
const rasterized = text.rasterize();
try {
  const engine = await Engine.create({ canvas });
  const texture = text.createTexture(engine.gpu.device);
  const renderer = new Renderer2D(engine.gpu);
  renderer.render(
    [text.toQuad(texture)],
    new Camera2D({
      position: { x: canvas.width / 2, y: canvas.height / 2 },
      viewportWidth: canvas.width,
      viewportHeight: canvas.height,
    }),
  );
  (
    window as unknown as { __textRenderedWithWebGpu?: boolean }
  ).__textRenderedWithWebGpu = true;
} catch {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Text example requires Canvas2D");
  context.drawImage(rasterized.canvas, 0, 0);
}
status.textContent = `${text.layout().lines.length} line(s), ${rasterized.width}x${rasterized.height}`;
