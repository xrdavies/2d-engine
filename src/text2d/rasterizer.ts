import type { TextLayoutResult } from "./layout.ts";

export interface TextRasterStyle {
  font: string;
  color?: string;
  padding?: number;
  textAlign?: CanvasTextAlign;
}

export type TextCanvas = HTMLCanvasElement | OffscreenCanvas;

export interface RasterizedText {
  canvas: TextCanvas;
  width: number;
  height: number;
  layout: TextLayoutResult;
}

function createCanvas(width: number, height: number): TextCanvas {
  if (typeof OffscreenCanvas !== "undefined")
    return new OffscreenCanvas(width, height);
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new Error(
    "Text rasterization requires a browser canvas or OffscreenCanvas",
  );
}

export class TextRasterizer {
  rasterize(layout: TextLayoutResult, style: TextRasterStyle): RasterizedText {
    const padding = style.padding ?? 0;
    const width = Math.max(1, Math.ceil(layout.width + padding * 2));
    const height = Math.max(1, Math.ceil(layout.height + padding * 2));
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to create a 2D text context");
    context.font = style.font;
    context.fillStyle = style.color ?? "white";
    context.textAlign = style.textAlign ?? "left";
    context.textBaseline = "top";
    for (const [index, line] of layout.lines.entries()) {
      const x =
        style.textAlign === "center"
          ? width / 2
          : style.textAlign === "right"
            ? width - padding
            : padding;
      context.fillText(line.text, x, padding + index * layout.lineHeight);
    }
    return { canvas, width, height, layout };
  }
}
