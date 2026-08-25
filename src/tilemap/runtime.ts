import type { Camera2D } from "../render2d/camera.ts";
import type { TexturedQuad, TextureSource } from "../render2d/quad.ts";
import type {
  TileChunk,
  TileLayer,
  TilemapAsset,
  TileRenderOptions,
  TileRenderResult,
  Tileset,
} from "./types.ts";

const FLIP_FLAGS = 0xe000_0000;
const FLIP_HORIZONTAL = 0x8000_0000;
const FLIP_VERTICAL = 0x4000_0000;
const FLIP_DIAGONAL = 0x2000_0000;

interface RuntimeChunk extends TileChunk {
  layer: TileLayer;
  key: string;
}

export class TilemapRuntime {
  private readonly dirty = new Set<string>();
  private readonly loaded = new Set<string>();
  private readonly cache = new Map<string, TexturedQuad[]>();
  private readonly chunks: RuntimeChunk[];
  private lastTexture: TextureSource | undefined;
  private lastTileUv: TileRenderOptions["tileUv"];

  constructor(
    readonly asset: TilemapAsset,
    readonly chunkSize = 32,
  ) {
    this.chunks = asset.layers.flatMap((layer) => this.createChunks(layer));
    for (const chunk of this.chunks) this.loadChunk(chunk.key);
  }

  get loadedChunkCount(): number {
    return this.loaded.size;
  }

  get cachedChunkCount(): number {
    return this.cache.size;
  }

  loadChunk(key: string): boolean {
    if (!this.chunks.some((chunk) => chunk.key === key)) return false;
    const added = !this.loaded.has(key);
    this.loaded.add(key);
    this.dirty.add(key);
    return added;
  }

  unloadChunk(key: string): boolean {
    this.cache.delete(key);
    this.dirty.delete(key);
    return this.loaded.delete(key);
  }

  chunkKeys(): readonly string[] {
    return this.chunks.map((chunk) => chunk.key);
  }

  getTile(layerName: string, x: number, y: number): number {
    const chunk = this.findChunk(layerName, x, y);
    if (!chunk) return 0;
    return chunk.data[(y - chunk.y) * chunk.width + (x - chunk.x)] ?? 0;
  }

  setTile(layerName: string, x: number, y: number, gid: number): boolean {
    const chunk = this.findChunk(layerName, x, y);
    if (!chunk) return false;
    chunk.data[(y - chunk.y) * chunk.width + (x - chunk.x)] = gid;
    this.dirty.add(chunk.key);
    return true;
  }

  markAllDirty(): void {
    for (const key of this.loaded) this.dirty.add(key);
  }

  render(camera: Camera2D, options: TileRenderOptions): TileRenderResult {
    if (
      this.lastTexture !== options.texture ||
      this.lastTileUv !== options.tileUv
    ) {
      this.cache.clear();
      this.markAllDirty();
      this.lastTexture = options.texture;
      this.lastTileUv = options.tileUv;
    }
    const bounds = camera.visibleWorldBounds();
    const rebuilt: string[] = [];
    const items: TexturedQuad[] = [];
    for (const chunk of this.chunks) {
      if (!this.loaded.has(chunk.key) || !chunk.layer.visible) continue;
      if (!this.chunkVisible(chunk, bounds)) continue;
      if (this.dirty.has(chunk.key) || !this.cache.has(chunk.key)) {
        this.cache.set(chunk.key, this.buildChunk(chunk, options));
        this.dirty.delete(chunk.key);
        rebuilt.push(chunk.key);
      }
      items.push(...(this.cache.get(chunk.key) ?? []));
    }
    for (const layer of this.asset.imageLayers) {
      const texture = options.imageTextures?.[layer.id];
      if (!texture || !layer.visible) continue;
      items.push({
        texture,
        position: { x: layer.x, y: layer.y },
        size: { x: layer.width, y: layer.height },
        rotation: 0,
        anchor: { x: 0, y: 0 },
        uv: { x: 0, y: 0, width: 1, height: 1 },
        color: [1, 1, 1, layer.opacity],
        layer: (options.layer ?? 0) + layer.id,
        visible: true,
      });
    }
    items.push(...(options.overlays ?? []));
    return { items, dirtyChunks: rebuilt };
  }

  worldToTile(x: number, y: number): { x: number; y: number } {
    if (this.asset.orientation === "isometric") {
      const halfWidth = this.asset.tileWidth / 2;
      const halfHeight = this.asset.tileHeight / 2;
      return {
        x: Math.floor((x / halfWidth + y / halfHeight) / 2),
        y: Math.floor((y / halfHeight - x / halfWidth) / 2),
      };
    }
    if (
      this.asset.orientation === "staggered" ||
      this.asset.orientation === "hexagonal"
    ) {
      if (this.asset.staggerAxis === "x") {
        const column = Math.floor(x / (this.asset.tileWidth / 2));
        const offset = this.isOdd(column) ? this.asset.tileHeight / 2 : 0;
        return {
          x: column,
          y: Math.floor((y - offset) / this.asset.tileHeight),
        };
      }
      const row = Math.floor(y / (this.asset.tileHeight / 2));
      const offset = this.isOdd(row) ? this.asset.tileWidth / 2 : 0;
      return { x: Math.floor((x - offset) / this.asset.tileWidth), y: row };
    }
    return {
      x: Math.floor(x / this.asset.tileWidth),
      y: Math.floor(y / this.asset.tileHeight),
    };
  }

  tileToWorld(x: number, y: number): { x: number; y: number } {
    if (this.asset.orientation === "isometric") {
      return {
        x: (x - y) * (this.asset.tileWidth / 2),
        y: (x + y) * (this.asset.tileHeight / 2),
      };
    }
    if (
      this.asset.orientation === "staggered" ||
      this.asset.orientation === "hexagonal"
    ) {
      if (this.asset.staggerAxis === "x") {
        return {
          x: x * (this.asset.tileWidth / 2),
          y:
            y * this.asset.tileHeight +
            (this.isOdd(x) ? this.asset.tileHeight / 2 : 0),
        };
      }
      return {
        x:
          x * this.asset.tileWidth +
          (this.isOdd(y) ? this.asset.tileWidth / 2 : 0),
        y: y * (this.asset.tileHeight / 2),
      };
    }
    return { x: x * this.asset.tileWidth, y: y * this.asset.tileHeight };
  }

  private createChunks(layer: TileLayer): RuntimeChunk[] {
    const source =
      layer.chunks.length > 0 ? layer.chunks : this.chunkDenseLayer(layer);
    return source.map((chunk) => ({
      ...chunk,
      layer,
      key: `${layer.id}:${chunk.x}:${chunk.y}`,
    }));
  }

  private chunkDenseLayer(layer: TileLayer): TileChunk[] {
    const chunks: TileChunk[] = [];
    for (let y = 0; y < layer.height; y += this.chunkSize) {
      for (let x = 0; x < layer.width; x += this.chunkSize) {
        const width = Math.min(this.chunkSize, layer.width - x);
        const height = Math.min(this.chunkSize, layer.height - y);
        const data = new Uint32Array(width * height);
        for (let row = 0; row < height; row += 1) {
          data.set(
            layer.data.subarray(
              (y + row) * layer.width + x,
              (y + row) * layer.width + x + width,
            ),
            row * width,
          );
        }
        chunks.push({ x, y, width, height, data });
      }
    }
    return chunks;
  }

  private findChunk(
    layerName: string,
    x: number,
    y: number,
  ): RuntimeChunk | undefined {
    return this.chunks.find(
      (chunk) =>
        chunk.layer.name === layerName &&
        x >= chunk.x &&
        y >= chunk.y &&
        x < chunk.x + chunk.width &&
        y < chunk.y + chunk.height,
    );
  }

  private buildChunk(
    chunk: RuntimeChunk,
    options: TileRenderOptions,
  ): TexturedQuad[] {
    const items: TexturedQuad[] = [];
    for (let localY = 0; localY < chunk.height; localY += 1) {
      for (let localX = 0; localX < chunk.width; localX += 1) {
        const rawGid = chunk.data[localY * chunk.width + localX] ?? 0;
        const gid = rawGid & ~FLIP_FLAGS;
        if (gid === 0) continue;
        const tileset = this.findTileset(gid);
        if (!tileset) continue;
        const position = this.tileToWorld(chunk.x + localX, chunk.y + localY);
        const region =
          options.tileUv?.(gid, tileset) ?? this.defaultUv(gid, tileset);
        const transformed = this.transformUv(rawGid, region);
        items.push({
          texture: options.texture,
          position,
          size: { x: this.asset.tileWidth, y: this.asset.tileHeight },
          rotation: 0,
          anchor:
            this.asset.orientation === "isometric"
              ? { x: 0.5, y: 0 }
              : { x: 0, y: 0 },
          uv: transformed.uv,
          uvTransform: transformed.matrix,
          color: [1, 1, 1, chunk.layer.opacity],
          layer: (options.layer ?? 0) + chunk.layer.id,
          visible: true,
        });
      }
    }
    return items;
  }

  private defaultUv(gid: number, tileset: Tileset) {
    const local = gid - tileset.firstGid;
    const columns = Math.max(1, tileset.columns);
    const rows = Math.max(1, Math.ceil(tileset.tileCount / columns));
    return {
      x: (local % columns) / columns,
      y: Math.floor(local / columns) / rows,
      width: 1 / columns,
      height: 1 / rows,
    };
  }

  private transformUv(
    rawGid: number,
    uv: { x: number; y: number; width: number; height: number },
  ): {
    uv: { x: number; y: number; width: number; height: number };
    matrix: [number, number, number, number];
  } {
    let a = 1;
    let b = 0;
    let c = 0;
    let d = 1;
    let offsetX = 0;
    let offsetY = 0;
    if ((rawGid & FLIP_DIAGONAL) !== 0) {
      [a, b, c, d] = [c, d, a, b];
      [offsetX, offsetY] = [offsetY, offsetX];
    }
    if ((rawGid & FLIP_HORIZONTAL) !== 0) {
      a = -a;
      b = -b;
      offsetX = 1 - offsetX;
    }
    if ((rawGid & FLIP_VERTICAL) !== 0) {
      c = -c;
      d = -d;
      offsetY = 1 - offsetY;
    }
    return {
      uv: {
        x: uv.x + uv.width * offsetX,
        y: uv.y + uv.height * offsetY,
        width: uv.width,
        height: uv.height,
      },
      matrix: [uv.width * a, uv.width * b, uv.height * c, uv.height * d].map(
        (value) => (Object.is(value, -0) ? 0 : value),
      ) as [number, number, number, number],
    };
  }

  private chunkVisible(
    chunk: RuntimeChunk,
    bounds: { left: number; top: number; right: number; bottom: number },
  ): boolean {
    const corners = [
      this.tileToWorld(chunk.x, chunk.y),
      this.tileToWorld(chunk.x + chunk.width, chunk.y),
      this.tileToWorld(chunk.x, chunk.y + chunk.height),
      this.tileToWorld(chunk.x + chunk.width, chunk.y + chunk.height),
    ];
    const left =
      Math.min(...corners.map((point) => point.x)) - this.asset.tileWidth;
    const right =
      Math.max(...corners.map((point) => point.x)) + this.asset.tileWidth;
    const top =
      Math.min(...corners.map((point) => point.y)) - this.asset.tileHeight;
    const bottom =
      Math.max(...corners.map((point) => point.y)) + this.asset.tileHeight;
    return (
      left <= bounds.right &&
      right >= bounds.left &&
      top <= bounds.bottom &&
      bottom >= bounds.top
    );
  }

  private findTileset(gid: number): Tileset | undefined {
    return [...this.asset.tilesets]
      .reverse()
      .find((tileset) => gid >= tileset.firstGid);
  }

  private isOdd(index: number): boolean {
    const odd = Math.abs(index) % 2 === 1;
    return this.asset.staggerIndex === "even" ? !odd : odd;
  }
}
