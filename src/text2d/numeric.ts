import { TextAtlas } from "./atlas.ts";
import type { TextLayoutBackend } from "./layout.ts";
import { Text2D, type TextQuad } from "./text.ts";

export interface NumericTextAtlasOptions {
  font: string;
  color?: string;
  characters?: string;
  atlas?: TextAtlas;
  scene?: string;
  layoutBackend?: TextLayoutBackend;
}

export interface NumericTextOptions {
  position?: { x: number; y: number };
  spacing?: number;
  scale?: number;
  layer?: number;
  color?: [number, number, number, number];
}

export class NumericTextAtlas {
  readonly atlas: TextAtlas;
  readonly characters: string;
  private readonly glyphs = new Map<string, Text2D>();
  private readonly options: NumericTextAtlasOptions;

  constructor(options: NumericTextAtlasOptions) {
    this.options = options;
    this.atlas = options.atlas ?? new TextAtlas();
    this.characters = options.characters ?? "0123456789+-.,%";
    if (this.characters.length === 0) {
      throw new RangeError("Numeric text character set must not be empty");
    }
  }

  prepare(): void {
    for (const character of new Set(this.characters))
      this.glyph(character).rasterize();
  }

  createQuads(
    value: number | string,
    device: GPUDevice,
    options: NumericTextOptions = {},
  ): TextQuad[] {
    this.prepare();
    const origin = options.position ?? { x: 0, y: 0 };
    const scale = options.scale ?? 1;
    const spacing = options.spacing ?? 0;
    const items: TextQuad[] = [];
    let x = origin.x;
    for (const character of String(value)) {
      if (character === " ") {
        x += spacing + this.fontSize() * scale * 0.5;
        continue;
      }
      const glyph = this.glyphs.get(character);
      if (!glyph)
        throw new Error(`Unsupported numeric text character: ${character}`);
      const rasterized = glyph.rasterize();
      const item = glyph.toQuad(glyph.createTexture(device));
      item.position = { x, y: origin.y };
      item.size = {
        x: rasterized.width * scale,
        y: rasterized.height * scale,
      };
      item.layer = options.layer ?? 0;
      item.color = options.color ?? [1, 1, 1, 1];
      items.push(item);
      x += item.size.x + spacing;
    }
    return items;
  }

  get glyphCount(): number {
    return this.glyphs.size;
  }

  private glyph(character: string): Text2D {
    let glyph = this.glyphs.get(character);
    if (!glyph) {
      if (!this.characters.includes(character)) {
        throw new Error(`Unsupported numeric text character: ${character}`);
      }
      glyph = new Text2D(
        {
          text: character,
          font: this.options.font,
          color: this.options.color,
          lineHeight: this.fontSize(),
          atlas: this.atlas,
          scene: this.options.scene ?? "numeric",
        },
        this.options.layoutBackend,
      );
      this.glyphs.set(character, glyph);
    }
    return glyph;
  }

  private fontSize(): number {
    return Number.parseFloat(this.options.font) || 16;
  }
}
