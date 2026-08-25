import { Text2D } from "../../src/index.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#canvas");
const status = document.querySelector<HTMLElement>("#status");
if (!canvas || !status) throw new Error("Text example markup is incomplete");
const text = new Text2D({
  text: "Hello 世界，WebGPU 游戏引擎",
  font: "28px sans-serif",
  maxWidth: 600,
  lineHeight: 36,
  position: { x: 20, y: 20 },
});
const rasterized = text.rasterize();
const context = canvas.getContext("2d");
if (!context) throw new Error("Text example requires Canvas2D");
context.drawImage(rasterized.canvas, 0, 0);
status.textContent = `${text.layout().lines.length} line(s), ${rasterized.width}x${rasterized.height}`;
