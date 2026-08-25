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
    data: number[] | string;
  }>;
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  encoding?: "base64" | "csv";
  compression?: "gzip" | "zlib" | "zstd" | "";
  source?: string;
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
      for (const chunk of layer.chunks ?? []) {
        if (!Array.isArray(chunk.data)) {
          throw new Error(
            `Tile layer ${layer.name} contains encoded chunk data`,
          );
        }
      }
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
          data: Uint32Array.from(chunk.data as number[]),
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
    staggerAxis: map.staggeraxis as TilemapAsset["staggerAxis"],
    staggerIndex: map.staggerindex as TilemapAsset["staggerIndex"],
    hexSideLength: Number(map.hexsidelength ?? 0) || undefined,
    layers: tileLayers,
    objectLayers,
    imageLayers,
    tilesets,
  };
}

export const TiledMapImporter = { fromJson: importTiledMap };

export async function importTiledMapAsync(
  value: unknown,
  loadExternal: (source: string) => Promise<unknown> = async (source) =>
    (await fetch(source)).json(),
): Promise<TilemapAsset> {
  const map = structuredClone(value) as Record<string, unknown>;
  const tilesets =
    (map.tilesets as Array<Record<string, unknown>> | undefined) ?? [];
  map.tilesets = await Promise.all(
    tilesets.map(async (entry) => {
      if (typeof entry.source !== "string") return entry;
      const external = (await loadExternal(entry.source)) as Record<
        string,
        unknown
      >;
      return { ...external, firstgid: entry.firstgid };
    }),
  );
  const layers =
    (map.layers as Array<Record<string, unknown>> | undefined) ?? [];
  for (const layer of layers) {
    if (layer.type !== "tilelayer") continue;
    if (typeof layer.data === "string") {
      layer.data = await decodeTileData(
        layer.data,
        layer.encoding as string | undefined,
        layer.compression as string | undefined,
      );
    }
    for (const chunk of (layer.chunks as
      | Array<Record<string, unknown>>
      | undefined) ?? []) {
      if (typeof chunk.data !== "string") continue;
      chunk.data = await decodeTileData(
        chunk.data,
        layer.encoding as string | undefined,
        layer.compression as string | undefined,
      );
    }
    delete layer.encoding;
    delete layer.compression;
  }
  return importTiledMap(map);
}

async function decodeTileData(
  encoded: string,
  encoding: string | undefined,
  compression: string | undefined,
): Promise<number[]> {
  if (encoding === "csv")
    return encoded.split(",").map((value) => Number(value.trim()));
  if (encoding !== "base64")
    throw new Error(`Unsupported tile data encoding: ${encoding ?? "unknown"}`);
  const bytes = Uint8Array.from(atob(encoded), (character) =>
    character.charCodeAt(0),
  );
  if (compression === "zstd") {
    throw new Error(
      "Zstd-compressed tile data is not supported at runtime; convert it to zlib or gzip during the build",
    );
  }
  const format = compression === "zlib" ? "deflate" : compression;
  if (format && format !== "gzip" && format !== "deflate") {
    throw new Error(`Unsupported tile data compression: ${compression}`);
  }
  const source = compression
    ? await new Response(
        new Blob([bytes])
          .stream()
          .pipeThrough(new DecompressionStream(format as "gzip" | "deflate")),
      ).arrayBuffer()
    : bytes.buffer;
  const values = new Uint32Array(source);
  return [...values];
}

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
