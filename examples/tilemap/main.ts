import { TiledMapImporter, TilemapRuntime } from "../../src/index.ts";

const status = document.querySelector<HTMLElement>("#status");
if (!status) throw new Error("Tilemap example markup is incomplete");
const asset = TiledMapImporter.fromJson({
  type: "map",
  width: 4,
  height: 3,
  tilewidth: 32,
  tileheight: 32,
  layers: [
    {
      id: 1,
      name: "terrain",
      type: "tilelayer",
      width: 4,
      height: 3,
      data: Array(12).fill(1),
    },
  ],
  tilesets: [
    { firstgid: 1, tilewidth: 32, tileheight: 32, columns: 1, tilecount: 1 },
  ],
});
const runtime = new TilemapRuntime(asset);
status.textContent = `${asset.width}x${asset.height} tilemap, ${runtime.getTile("terrain", 0, 0)} at origin`;
