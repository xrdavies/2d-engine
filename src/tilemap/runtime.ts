import type { Camera2D } from "../render2d/camera.ts";
import type { TexturedQuad } from "../render2d/quad.ts";
import type {
  TilemapAsset,
  TileRenderOptions,
  TileRenderResult,
  Tileset,
} from "./types.ts";

export class TilemapRuntime {
  private readonly dirty = new Set<string>();

  constructor(
    readonly asset: TilemapAsset,
    readonly chunkSize = 32,
  ) {
    this.markAllDirty();
  }

  getTile(layerName: string, x: number, y: number): number {
    const layer = this.asset.layers.find(
      (candidate) => candidate.name === layerName,
    );
    if (!layer || x < 0 || y < 0 || x >= layer.width || y >= layer.height)
      return 0;
    return layer.data[y * layer.width + x] ?? 0;
  }

  setTile(layerName: string, x: number, y: number, gid: number): boolean {
    const layer = this.asset.layers.find(
      (candidate) => candidate.name === layerName,
    );
    if (!layer || x < 0 || y < 0 || x >= layer.width || y >= layer.height)
      return false;
    layer.data[y * layer.width + x] = gid;
    this.dirty.add(
      this.chunkKey(
        Math.floor(x / this.chunkSize),
        Math.floor(y / this.chunkSize),
      ),
    );
    return true;
  }

  markAllDirty(): void {
    for (let y = 0; y < this.asset.height; y += this.chunkSize) {
      for (let x = 0; x < this.asset.width; x += this.chunkSize) {
        this.dirty.add(
          this.chunkKey(
            Math.floor(x / this.chunkSize),
            Math.floor(y / this.chunkSize),
          ),
        );
      }
    }
  }

  render(camera: Camera2D, options: TileRenderOptions): TileRenderResult {
    const bounds = camera.visibleWorldBounds();
    const items: TexturedQuad[] = [];
    for (const layer of this.asset.layers) {
      if (!layer.visible) continue;
      const minX = Math.max(0, Math.floor(bounds.left / this.asset.tileWidth));
      const maxX = Math.min(
        layer.width - 1,
        Math.ceil(bounds.right / this.asset.tileWidth),
      );
      const minY = Math.max(0, Math.floor(bounds.top / this.asset.tileHeight));
      const maxY = Math.min(
        layer.height - 1,
        Math.ceil(bounds.bottom / this.asset.tileHeight),
      );
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const gid = this.getTile(layer.name, x, y);
          if (gid === 0) continue;
          const tileset = this.findTileset(gid);
          if (!tileset) continue;
          const uv = options.tileUv?.(gid, tileset) ?? {
            x: 0,
            y: 0,
            width: 1,
            height: 1,
          };
          items.push({
            texture: options.texture,
            position: {
              x: (x + 0.5) * this.asset.tileWidth,
              y: (y + 0.5) * this.asset.tileHeight,
            },
            size: { x: this.asset.tileWidth, y: this.asset.tileHeight },
            rotation: 0,
            anchor: { x: 0.5, y: 0.5 },
            uv,
            color: [1, 1, 1, layer.opacity],
            layer: layer.id,
            visible: true,
          });
        }
      }
    }
    const dirtyChunks = [...this.dirty];
    this.dirty.clear();
    return { items, dirtyChunks };
  }

  worldToTile(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.floor(x / this.asset.tileWidth),
      y: Math.floor(y / this.asset.tileHeight),
    };
  }

  tileToWorld(x: number, y: number): { x: number; y: number } {
    return {
      x: (x + 0.5) * this.asset.tileWidth,
      y: (y + 0.5) * this.asset.tileHeight,
    };
  }

  private findTileset(gid: number): Tileset | undefined {
    return [...this.asset.tilesets]
      .reverse()
      .find((tileset) => gid >= tileset.firstGid);
  }

  private chunkKey(x: number, y: number): string {
    return `${x}:${y}`;
  }
}
