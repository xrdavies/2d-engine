export interface GpuOptions {
  requiredFeatures?: GPUFeatureName[];
  requiredLimits?: Record<string, number>;
  canvasFormat?: GPUTextureFormat;
}

export interface GpuCapabilities {
  adapterFeatures: readonly GPUFeatureName[];
  deviceFeatures: readonly GPUFeatureName[];
  limits: GPUSupportedLimits;
  format: GPUTextureFormat;
}

export interface GpuContext {
  readonly adapter: GPUAdapter;
  readonly device: GPUDevice;
  readonly context: GPUCanvasContext;
  readonly capabilities: GpuCapabilities;
  configureCanvas(): void;
  withErrorScope<T>(
    filter: GPUErrorFilter,
    callback: () => T | Promise<T>,
  ): Promise<T>;
  destroy(): void;
}

export async function withGpuErrorScope<T>(
  device: GPUDevice,
  filter: GPUErrorFilter,
  callback: () => T | Promise<T>,
): Promise<T> {
  device.pushErrorScope(filter);
  let value: T | undefined;
  let callbackError: unknown;
  try {
    value = await callback();
  } catch (error) {
    callbackError = error;
  }
  const gpuError = await device.popErrorScope();
  if (callbackError !== undefined) throw callbackError;
  if (gpuError) throw new Error(`WebGPU ${filter} error: ${gpuError.message}`);
  return value as T;
}

export async function createGpuContext(
  options: GpuOptions & { canvas: HTMLCanvasElement },
): Promise<GpuContext> {
  if (!navigator.gpu) {
    throw new Error("WebGPU is not available in this browser");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("No compatible WebGPU adapter was found");
  }

  const requiredFeatures = options.requiredFeatures ?? [];
  for (const feature of requiredFeatures) {
    if (!adapter.features.has(feature)) {
      throw new Error(`Required WebGPU feature is unavailable: ${feature}`);
    }
  }

  const device = await adapter.requestDevice({
    requiredFeatures,
    requiredLimits: options.requiredLimits,
  });
  const context = options.canvas.getContext("webgpu");
  if (!context) {
    device.destroy();
    throw new Error("The canvas does not provide a WebGPU context");
  }

  const format =
    options.canvasFormat ?? navigator.gpu.getPreferredCanvasFormat();
  const configureCanvas = (): void => {
    context.configure({
      device,
      format,
      alphaMode: "premultiplied",
    });
  };
  configureCanvas();

  return {
    adapter,
    device,
    context,
    capabilities: {
      adapterFeatures: [...adapter.features].map(
        (feature) => feature as GPUFeatureName,
      ),
      deviceFeatures: [...device.features].map(
        (feature) => feature as GPUFeatureName,
      ),
      limits: device.limits,
      format,
    },
    configureCanvas,
    withErrorScope: (filter, callback) =>
      withGpuErrorScope(device, filter, callback),
    destroy: () => device.destroy(),
  };
}
