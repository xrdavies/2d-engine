import type { GpuContext } from "./device.ts";

export class GpuTimestampQuery {
  readonly supported: boolean;
  private readonly device: GPUDevice;
  private readonly querySet?: GPUQuerySet;
  private readonly resolveBuffer?: GPUBuffer;
  private readonly readBuffer?: GPUBuffer;

  constructor(context: GpuContext) {
    this.device = context.device;
    this.supported = context.device.features.has("timestamp-query");
    if (!this.supported) return;
    this.querySet = this.device.createQuerySet({ type: "timestamp", count: 2 });
    this.resolveBuffer = this.device.createBuffer({
      label: "gpu-timestamp-resolve",
      size: 16,
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });
    this.readBuffer = this.device.createBuffer({
      label: "gpu-timestamp-read",
      size: 16,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
  }

  begin(encoder: GPUCommandEncoder): void {
    if (this.querySet) this.writeTimestamp(encoder, 0);
  }

  end(encoder: GPUCommandEncoder): void {
    if (!this.querySet || !this.resolveBuffer || !this.readBuffer) return;
    this.writeTimestamp(encoder, 1);
    encoder.resolveQuerySet(this.querySet, 0, 2, this.resolveBuffer, 0);
    encoder.copyBufferToBuffer(this.resolveBuffer, 0, this.readBuffer, 0, 16);
  }

  async readTicks(): Promise<bigint | null> {
    if (!this.readBuffer) return null;
    await this.readBuffer.mapAsync(GPUMapMode.READ);
    const values = new BigInt64Array(this.readBuffer.getMappedRange());
    const first = values[0] ?? 0n;
    const second = values[1] ?? 0n;
    const delta = second - first;
    this.readBuffer.unmap();
    return delta;
  }

  dispose(): void {
    this.querySet?.destroy();
    this.resolveBuffer?.destroy();
    this.readBuffer?.destroy();
  }

  private writeTimestamp(encoder: GPUCommandEncoder, index: number): void {
    const commandEncoder = encoder as GPUCommandEncoder & {
      writeTimestamp?: (querySet: GPUQuerySet, queryIndex: number) => void;
    };
    if (!commandEncoder.writeTimestamp || !this.querySet) {
      throw new Error(
        "WebGPU timestamp writes are unavailable in this implementation",
      );
    }
    commandEncoder.writeTimestamp(this.querySet, index);
  }
}
