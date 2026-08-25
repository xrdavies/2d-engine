import { describe, expect, it } from "vitest";
import { UniformGrid } from "../../src/spatial/index.ts";
import { TiledMapImporter, TilemapRuntime } from "../../src/tilemap/index.ts";

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
  });
});
