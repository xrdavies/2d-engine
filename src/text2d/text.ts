import type { TexturedQuad, TextureSource } from "../render2d/quad.ts";
import { TextAtlas } from "./atlas.ts";
import {
  CanvasTextLayout,
  type PreparedText,
  type TextLayoutBackend,
  type TextLayoutOptions,
  type TextLayoutResult,
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
  atlas?: TextAtlas;
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
  private preparedValue: PreparedText | undefined;
  private preparedKey = "";
  private layoutValue: TextLayoutResult | undefined;
  private layoutKey = "";
  private atlasKey = "";

  constructor(options: Text2DOptions, layoutBackend?: TextLayoutBackend) {
    this.text = options.text ?? "";
    this.font = options.font;
    this.color = options.color ?? "white";
    this.maxWidth = options.maxWidth ?? 4096;
    this.lineHeight = options.lineHeight ?? 20;
    this.position = options.position ?? { x: 0, y: 0 };
    this.layoutOptions = options.layoutOptions ?? {};
    this.atlas = options.atlas ?? new TextAtlas();
    this.layoutBackend =
      layoutBackend ?? new CanvasTextLayout(this.createMeasureContext());
  }

  layout(): TextLayoutResult {
    const preparedKey = `${this.text}|${this.font}|${JSON.stringify(this.layoutOptions)}`;
    if (!this.preparedValue || this.preparedKey !== preparedKey) {
      this.preparedValue = this.layoutBackend.prepare(
        this.text,
        this.font,
        this.layoutOptions,
      );
      this.preparedKey = preparedKey;
      this.layoutValue = undefined;
    }
    const layoutKey = `${preparedKey}|${this.maxWidth}|${this.lineHeight}`;
    if (!this.layoutValue || this.layoutKey !== layoutKey) {
      this.layoutValue = this.layoutBackend.layout(
        this.preparedValue,
        this.maxWidth,
        this.lineHeight,
      );
      this.layoutKey = layoutKey;
    }
    return this.layoutValue;
  }

  rasterize(): RasterizedText {
    const key = `${this.text}|${this.font}|${this.color}|${this.maxWidth}|${this.lineHeight}|${JSON.stringify(this.layoutOptions)}`;
    const layout = this.layout();
    const entry = this.atlas.getOrCreateEntry(
      key,
      layout,
      { font: this.font, color: this.color },
      this.rasterizer,
    );
    this.atlasKey = key;
    this.rasterizedValue = entry.rasterized;
    return entry.rasterized;
  }

  createTexture(device: GPUDevice): GPUTexture {
    this.rasterize();
    return this.atlas.createTexture(device);
  }

  toQuad(texture: TextureSource): TexturedQuad {
    const rasterized = this.rasterizedValue ?? this.rasterize();
    const entry = this.atlas.getEntry(this.atlasKey);
    if (!entry) throw new Error("Text run is missing from the atlas");
    return {
      texture,
      position: this.position,
      size: { x: rasterized.width, y: rasterized.height },
      rotation: 0,
      anchor: { x: 0, y: 0 },
      uv: entry.uv,
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
