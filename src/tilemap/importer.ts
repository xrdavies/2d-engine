import type {
  ImageLayer,
  MapObject,
  ObjectLayer,
  TileLayer,
  TilemapAsset,
  Tileset,
} from "./types.ts";

interface TiledLayerJson {
  id: number;
  name: string;
  type: string;
  width?: number;
  height?: number;
  data?: number[];
  opacity?: number;
  visible?: boolean;
  x?: number;
  y?: number;
  objects?: Array<Record<string, unknown>>;
  chunks?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    data: number[];
  }>;
  image?: string;
  imagewidth?: number;
  imageheight?: number;
}

export function importTiledMap(value: unknown): TilemapAsset {
  const map = value as Record<string, unknown>;
  if (map.type !== "map") throw new Error("Unsupported map asset");
  const layers = (map.layers as TiledLayerJson[] | undefined) ?? [];
  const tileLayers: TileLayer[] = [];
  const objectLayers: ObjectLayer[] = [];
  const imageLayers: ImageLayer[] = [];
  for (const layer of layers) {
    if (layer.type === "tilelayer") {
      if (!Array.isArray(layer.data) && !Array.isArray(layer.chunks))
        throw new Error(`Tile layer ${layer.name} must use decoded tile data`);
      tileLayers.push({
        id: layer.id,
        name: layer.name,
        width: layer.width ?? 0,
        height: layer.height ?? 0,
        data: Uint32Array.from(layer.data ?? []),
        opacity: layer.opacity ?? 1,
        visible: layer.visible ?? true,
        x: layer.x ?? 0,
        y: layer.y ?? 0,
        chunks: (layer.chunks ?? []).map((chunk) => ({
          ...chunk,
          data: Uint32Array.from(chunk.data),
        })),
      });
    } else if (layer.type === "objectgroup") {
      objectLayers.push({
        id: layer.id,
        name: layer.name,
        visible: layer.visible ?? true,
        objects: (layer.objects ?? []).map((object) => toObject(object)),
      });
    } else if (layer.type === "imagelayer" && layer.image) {
      imageLayers.push({
        id: layer.id,
        name: layer.name,
        image: layer.image,
        x: layer.x ?? 0,
        y: layer.y ?? 0,
        width: layer.imagewidth ?? 0,
        height: layer.imageheight ?? 0,
        opacity: layer.opacity ?? 1,
        visible: layer.visible ?? true,
      });
    }
  }
  const tilesets = (
    (map.tilesets as Array<Record<string, unknown>> | undefined) ?? []
  ).map(
    (tileset) =>
      ({
        firstGid: Number(tileset.firstgid ?? 1),
        tileWidth: Number(tileset.tilewidth ?? map.tilewidth ?? 1),
        tileHeight: Number(tileset.tileheight ?? map.tileheight ?? 1),
        columns: Number(tileset.columns ?? 1),
        tileCount: Number(tileset.tilecount ?? 0),
        imageWidth: Number(tileset.imagewidth ?? 0) || undefined,
        imageHeight: Number(tileset.imageheight ?? 0) || undefined,
        image: typeof tileset.image === "string" ? tileset.image : undefined,
      }) satisfies Tileset,
  );
  return {
    width: Number(map.width ?? 0),
    height: Number(map.height ?? 0),
    tileWidth: Number(map.tilewidth ?? 1),
    tileHeight: Number(map.tileheight ?? 1),
    orientation:
      (map.orientation as TilemapAsset["orientation"]) ?? "orthogonal",
    layers: tileLayers,
    objectLayers,
    imageLayers,
    tilesets,
  };
}

export const TiledMapImporter = { fromJson: importTiledMap };

function toObject(value: Record<string, unknown>): MapObject {
  const properties = Array.isArray(value.properties)
    ? Object.fromEntries(
        (value.properties as Array<{ name: string; value: unknown }>).map(
          (property) => [property.name, property.value],
        ),
      )
    : {};
  return {
    id: Number(value.id ?? 0),
    name: String(value.name ?? ""),
    type: String(value.type ?? ""),
    x: Number(value.x ?? 0),
    y: Number(value.y ?? 0),
    width: Number(value.width ?? 0),
    height: Number(value.height ?? 0),
    properties,
  };
}
