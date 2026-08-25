import type { TexturedQuad, TextureSource } from "../render2d/quad.ts";

export type TilemapOrientation =
  | "orthogonal"
  | "isometric"
  | "hexagonal"
  | "staggered";

export interface TileLayer {
  id: number;
  name: string;
  width: number;
  height: number;
  data: Uint32Array;
  opacity: number;
  visible: boolean;
  x: number;
  y: number;
  chunks: readonly TileChunk[];
}

export interface TileChunk {
  x: number;
  y: number;
  width: number;
  height: number;
  data: Uint32Array;
}

export interface ImageLayer {
  id: number;
  name: string;
  image: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  visible: boolean;
}

export interface MapObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, unknown>;
}

export interface ObjectLayer {
  id: number;
  name: string;
  objects: readonly MapObject[];
  visible: boolean;
}

export interface Tileset {
  firstGid: number;
  tileWidth: number;
  tileHeight: number;
  columns: number;
  tileCount: number;
  imageWidth?: number;
  imageHeight?: number;
  image?: string;
}

export interface TilemapAsset {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  orientation: TilemapOrientation;
  layers: readonly TileLayer[];
  objectLayers: readonly ObjectLayer[];
  imageLayers: readonly ImageLayer[];
  tilesets: readonly Tileset[];
}

export interface TileRenderOptions {
  texture: TextureSource;
  layer?: number;
  tileUv?: (
    gid: number,
    tileset: Tileset,
  ) => { x: number; y: number; width: number; height: number };
  imageTextures?: Readonly<Record<number, TextureSource>>;
  overlays?: readonly TexturedQuad[];
}

export interface TileRenderResult {
  items: TexturedQuad[];
  dirtyChunks: readonly string[];
}
