import { describe, expect, it } from "vitest";
import { Camera2D } from "../../src/render2d/index.ts";
import { UniformGrid } from "../../src/spatial/index.ts";
import {
  importTiledMapAsync,
  TiledMapImporter,
  TilemapRuntime,
} from "../../src/tilemap/index.ts";

describe("Spatial and Tilemap", () => {
  it("queries a uniform grid", () => {
    const grid = new UniformGrid<string>(10);
    grid.set("unit", { left: 8, top: 8, right: 12, bottom: 12 });
    expect(grid.queryPoint(10, 10)).toEqual(["unit"]);
    expect(grid.queryPoint(30, 30)).toEqual([]);
  });

  it("imports and updates generic tile data", () => {
    const asset = TiledMapImporter.fromJson({
      type: "map",
      width: 2,
      height: 1,
      tilewidth: 32,
      tileheight: 32,
      layers: [
        {
          id: 1,
          name: "ground",
          type: "tilelayer",
          width: 2,
          height: 1,
          data: [1, 0],
        },
      ],
      tilesets: [
        {
          firstgid: 1,
          tilewidth: 32,
          tileheight: 32,
          columns: 1,
          tilecount: 1,
        },
      ],
    });
    const runtime = new TilemapRuntime(asset);
    expect(runtime.getTile("ground", 0, 0)).toBe(1);
    expect(runtime.setTile("ground", 1, 0, 1)).toBe(true);
    expect(runtime.getTile("ground", 1, 0)).toBe(1);
    const texture = {} as never;
    const camera = new Camera2D({ viewportWidth: 64, viewportHeight: 32 });
    const result = runtime.render(camera, { texture });
    expect(result.dirtyChunks).toContain("1:0:0");
    expect(runtime.cachedChunkCount).toBe(1);
    expect(runtime.render(camera, { texture }).dirtyChunks).toEqual([]);
  });

  it("loads, unloads and projects chunks", () => {
    const asset = TiledMapImporter.fromJson({
      type: "map",
      infinite: true,
      width: 0,
      height: 0,
      tilewidth: 64,
      tileheight: 32,
      orientation: "isometric",
      layers: [
        {
          id: 2,
          name: "ground",
          type: "tilelayer",
          chunks: [{ x: 0, y: 0, width: 2, height: 1, data: [1, 1] }],
        },
        {
          id: 3,
          name: "background",
          type: "imagelayer",
          image: "background.png",
          imagewidth: 128,
          imageheight: 64,
        },
      ],
      tilesets: [
        {
          firstgid: 1,
          tilewidth: 64,
          tileheight: 32,
          columns: 1,
          tilecount: 1,
        },
      ],
    });
    const runtime = new TilemapRuntime(asset);
    const key = runtime.chunkKeys()[0] as string;

    expect(asset.imageLayers).toHaveLength(1);
    expect(runtime.tileToWorld(1, 0)).toEqual({ x: 32, y: 16 });
    expect(runtime.worldToTile(32, 16)).toEqual({ x: 1, y: 0 });
    expect(runtime.unloadChunk(key)).toBe(true);
    expect(runtime.loadedChunkCount).toBe(0);
    expect(runtime.loadChunk(key)).toBe(true);
    expect(runtime.loadedChunkCount).toBe(1);
  });

  it("supports staggered projection and async encoded data", async () => {
    const encoded = btoa(
      new Uint8Array(new Uint32Array([1]).buffer).reduce(
        (value, byte) => value + String.fromCharCode(byte),
        "",
      ),
    );
    const asset = await importTiledMapAsync({
      type: "map",
      width: 1,
      height: 1,
      tilewidth: 32,
      tileheight: 32,
      orientation: "staggered",
      staggeraxis: "y",
      staggerindex: "odd",
      layers: [
        {
          id: 1,
          name: "ground",
          type: "tilelayer",
          width: 1,
          height: 1,
          data: encoded,
          encoding: "base64",
        },
      ],
      tilesets: [
        {
          firstgid: 1,
          tilewidth: 32,
          tileheight: 32,
          columns: 1,
          tilecount: 1,
        },
      ],
    });
    const runtime = new TilemapRuntime(asset);
    expect(runtime.getTile("ground", 0, 0)).toBe(1);
    expect(runtime.tileToWorld(0, 1)).toEqual({ x: 16, y: 16 });
  });

  it("maps Tiled zlib to deflate and rejects zstd explicitly", async () => {
    const original = globalThis.DecompressionStream;
    const formats: string[] = [];
    class FakeDecompressionStream extends TransformStream {
      constructor(format: string) {
        formats.push(format);
        super();
      }
    }
    Object.assign(globalThis, { DecompressionStream: FakeDecompressionStream });
    const encoded = btoa(
      new Uint8Array(new Uint32Array([1]).buffer).reduce(
        (value, byte) => value + String.fromCharCode(byte),
        "",
      ),
    );
    const map = (compression: string) => ({
      type: "map",
      width: 1,
      height: 1,
      tilewidth: 32,
      tileheight: 32,
      layers: [
        {
          id: 1,
          name: "ground",
          type: "tilelayer",
          width: 1,
          height: 1,
          data: encoded,
          encoding: "base64",
          compression,
        },
      ],
      tilesets: [],
    });

    await importTiledMapAsync(map("zlib"));
    expect(formats).toEqual(["deflate"]);
    await expect(importTiledMapAsync(map("zstd"))).rejects.toThrow(
      "Zstd-compressed tile data is not supported",
    );
    Object.assign(globalThis, { DecompressionStream: original });
  });

  it("decodes encoded data inside infinite-map chunks", async () => {
    const encoded = btoa(
      new Uint8Array(new Uint32Array([7, 8]).buffer).reduce(
        (value, byte) => value + String.fromCharCode(byte),
        "",
      ),
    );
    const asset = await importTiledMapAsync({
      type: "map",
      infinite: true,
      width: 0,
      height: 0,
      tilewidth: 32,
      tileheight: 32,
      layers: [
        {
          id: 1,
          name: "ground",
          type: "tilelayer",
          encoding: "base64",
          chunks: [{ x: 0, y: 0, width: 2, height: 1, data: encoded }],
        },
      ],
      tilesets: [],
    });
    const runtime = new TilemapRuntime(asset);
    expect(runtime.getTile("ground", 0, 0)).toBe(7);
    expect(runtime.getTile("ground", 1, 0)).toBe(8);
  });

  it("applies Tiled horizontal and diagonal flip flags", () => {
    const asset = TiledMapImporter.fromJson({
      type: "map",
      width: 1,
      height: 1,
      tilewidth: 32,
      tileheight: 32,
      layers: [
        {
          id: 1,
          name: "ground",
          type: "tilelayer",
          width: 1,
          height: 1,
          data: [0xa0000001],
        },
      ],
      tilesets: [
        {
          firstgid: 1,
          tilewidth: 32,
          tileheight: 32,
          columns: 1,
          tilecount: 1,
        },
      ],
    });
    const result = new TilemapRuntime(asset).render(
      new Camera2D({
        position: { x: 16, y: 16 },
        viewportWidth: 64,
        viewportHeight: 64,
      }),
      { texture: {} as never },
    );
    expect(result.items[0]?.uv).toMatchObject({ x: 1, y: 0 });
    expect(result.items[0]?.uvTransform).toEqual([0, -1, 1, 0]);
  });
});
