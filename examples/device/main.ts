import { Engine } from "../../src/index.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#canvas");
const statusElement = document.querySelector<HTMLElement>("#status");
const details = document.querySelector<HTMLElement>("#details");

if (!canvas || !statusElement || !details) {
  throw new Error("Device example markup is incomplete");
}

try {
  const engine = await Engine.create({ canvas });
  statusElement.textContent = "WebGPU device ready";
  details.textContent = JSON.stringify(
    {
      format: engine.gpu.capabilities.format,
      adapterFeatures: engine.gpu.capabilities.adapterFeatures,
      deviceFeatures: engine.gpu.capabilities.deviceFeatures,
    },
    null,
    2,
  );
  engine.start();
} catch (error) {
  statusElement.textContent = "WebGPU unavailable";
  details.textContent = error instanceof Error ? error.message : String(error);
}
