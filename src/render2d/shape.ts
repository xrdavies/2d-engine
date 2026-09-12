import { Image2D, type Image2DOptions, type TextureSource } from "./quad.ts";

export type Shape2DOptions = Omit<Image2DOptions, "texture"> & {
  texture: TextureSource;
};

/** Colored axis-aligned quad. Tint `color` against a solid (usually white) texture. */
export class Shape2D extends Image2D {
  constructor(options: Shape2DOptions) {
    super(options);
  }
}
