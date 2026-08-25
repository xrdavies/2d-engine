import type { TexturedQuad, TextureSource } from "../render2d/quad.ts";
import { TextAtlas } from "./atlas.ts";
import {
  CanvasTextLayout,
  type TextLayoutBackend,
  type TextLayoutOptions,
} from "./layout.ts";
import {
  type RasterizedText,
  TextRasterizer,
  type TextRasterStyle,
} from "./rasterizer.ts";

export interface Text2DOptions extends TextRasterStyle {
  text?: string;
  maxWidth?: number;
  lineHeight?: number;
  layoutOptions?: TextLayoutOptions;
  position?: { x: number; y: number };
}

export class Text2D {
  text: string;
  font: string;
  color: string;
  maxWidth: number;
  lineHeight: number;
  position: { x: number; y: number };
  readonly atlas: TextAtlas;
  private readonly rasterizer = new TextRasterizer();
  private readonly layoutBackend: TextLayoutBackend;
  private readonly layoutOptions: TextLayoutOptions;
  private rasterizedValue: RasterizedText | undefined;

  constructor(options: Text2DOptions, layoutBackend?: TextLayoutBackend) {
    this.text = options.text ?? "";
    this.font = options.font;
    this.color = options.color ?? "white";
    this.maxWidth = options.maxWidth ?? 4096;
    this.lineHeight = options.lineHeight ?? 20;
    this.position = options.position ?? { x: 0, y: 0 };
    this.layoutOptions = options.layoutOptions ?? {};
    this.atlas = new TextAtlas();
    this.layoutBackend =
      layoutBackend ?? new CanvasTextLayout(this.createMeasureContext());
  }

  layout() {
    const prepared = this.layoutBackend.prepare(
      this.text,
      this.font,
      this.layoutOptions,
    );
    return this.layoutBackend.layout(prepared, this.maxWidth, this.lineHeight);
  }

  rasterize(): RasterizedText {
    const key = `${this.text}|${this.font}|${this.color}|${this.maxWidth}|${this.lineHeight}`;
    const layout = this.layout();
    this.rasterizedValue = this.atlas.getOrCreate(
      key,
      layout,
      { font: this.font, color: this.color },
      this.rasterizer,
    );
    return this.rasterizedValue;
  }

  createTexture(device: GPUDevice): GPUTexture {
    const rasterized = this.rasterize();
    const texture = device.createTexture({
      label: "text2d",
      size: {
        width: rasterized.width,
        height: rasterized.height,
        depthOrArrayLayers: 1,
      },
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    device.queue.copyExternalImageToTexture(
      { source: rasterized.canvas },
      { texture },
      {
        width: rasterized.width,
        height: rasterized.height,
        depthOrArrayLayers: 1,
      },
    );
    return texture;
  }

  toQuad(texture: TextureSource): TexturedQuad {
    const rasterized = this.rasterizedValue ?? this.rasterize();
    return {
      texture,
      position: this.position,
      size: { x: rasterized.width, y: rasterized.height },
      rotation: 0,
      anchor: { x: 0, y: 0 },
      uv: { x: 0, y: 0, width: 1, height: 1 },
      color: [1, 1, 1, 1],
      layer: 0,
      visible: true,
    };
  }

  private createMeasureContext(): CanvasRenderingContext2D {
    if (typeof document === "undefined")
      throw new Error("Text2D requires a browser canvas");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Unable to create a text measurement context");
    return context;
  }
}
