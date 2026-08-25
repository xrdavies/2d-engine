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
  tilesets: readonly Tileset[];
}

export interface TileRenderOptions {
  texture: TextureSource;
  layer?: number;
  tileUv?: (
    gid: number,
    tileset: Tileset,
  ) => { x: number; y: number; width: number; height: number };
}

export interface TileRenderResult {
  items: TexturedQuad[];
  dirtyChunks: readonly string[];
}
