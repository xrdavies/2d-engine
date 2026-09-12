export type CanvasTextureSource =
  | HTMLCanvasElement
  | OffscreenCanvas
  | ImageBitmap;

function textureUsage(): number {
  return (
    GPUTextureUsage.TEXTURE_BINDING |
    GPUTextureUsage.COPY_DST |
    GPUTextureUsage.RENDER_ATTACHMENT
  );
}

export function solidTextureBytes(
  rgba: readonly [number, number, number, number] = [255, 255, 255, 255],
): Uint8Array {
  return new Uint8Array([
    rgba[0] & 255,
    rgba[1] & 255,
    rgba[2] & 255,
    rgba[3] & 255,
  ]);
}

export function createSolidTexture(
  device: GPUDevice,
  rgba: readonly [number, number, number, number] = [255, 255, 255, 255],
  label = "solid-texture",
): GPUTexture {
  const texture = device.createTexture({
    label,
    size: { width: 1, height: 1 },
    format: "rgba8unorm",
    usage: textureUsage(),
  });
  device.queue.writeTexture(
    { texture },
    solidTextureBytes(rgba),
    { bytesPerRow: 4 },
    { width: 1, height: 1 },
  );
  return texture;
}

export function uploadCanvasTexture(
  device: GPUDevice,
  source: CanvasTextureSource,
  label = "canvas-texture",
): GPUTexture {
  const width = "width" in source ? Math.max(1, Math.floor(source.width)) : 1;
  const height = "height" in source ? Math.max(1, Math.floor(source.height)) : 1;
  const texture = device.createTexture({
    label,
    size: { width, height },
    format: "rgba8unorm",
    usage: textureUsage(),
  });
  device.queue.copyExternalImageToTexture(
    { source },
    { texture },
    { width, height },
  );
  return texture;
}
