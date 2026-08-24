export {};

const canvas = document.querySelector<HTMLCanvasElement>("#canvas");
const statusElement = document.querySelector<HTMLElement>("#status");

if (!canvas || !statusElement) {
  throw new Error("Triangle example markup is incomplete");
}

statusElement.textContent = canvas.getContext("webgpu")
  ? "WebGPU canvas available"
  : "WebGPU canvas pending device initialization";
