import { Engine } from "../../src/index.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#canvas");
const statusElement = document.querySelector<HTMLElement>("#status");

if (!canvas || !statusElement) {
  throw new Error("Triangle example markup is incomplete");
}

try {
  const engine = await Engine.create({ canvas });
  const shader = engine.resources.createShader({
    label: "triangle",
    code: `
      struct Output {
        @builtin(position) position: vec4<f32>,
        @location(0) color: vec3<f32>,
      };

      @vertex
      fn vertexMain(
        @location(0) position: vec2<f32>,
        @location(1) color: vec3<f32>,
      ) -> Output {
        var output: Output;
        output.position = vec4<f32>(position, 0.0, 1.0);
        output.color = color;
        return output;
      }

      @fragment
      fn fragmentMain(input: Output) -> @location(0) vec4<f32> {
        return vec4<f32>(input.color, 1.0);
      }
    `,
  });
  await engine.resources.validateShader(shader);
  const pipeline = engine.resources.createRenderPipeline({
    label: "triangle",
    layout: "auto",
    vertex: {
      module: shader.resource,
      entryPoint: "vertexMain",
      buffers: [
        {
          arrayStride: 20,
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x2" },
            { shaderLocation: 1, offset: 8, format: "float32x3" },
          ],
        },
      ],
    },
    fragment: {
      module: shader.resource,
      entryPoint: "fragmentMain",
      targets: [{ format: engine.gpu.capabilities.format }],
    },
  });
  const vertices = engine.resources.createBuffer({
    label: "triangle",
    size: 60,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    data: new Float32Array([
      0, 0.7, 1, 0.2, 0.2, -0.7, -0.7, 0.2, 1, 0.4, 0.7, -0.7, 0.2, 0.5, 1,
    ]),
  });
  await engine.gpu.withErrorScope("validation", () => {
    const encoder = engine.gpu.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: engine.gpu.context.getCurrentTexture().createView(),
          clearValue: { r: 0.04, g: 0.05, b: 0.08, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(pipeline.resource);
    pass.setVertexBuffer(0, vertices.resource);
    pass.draw(3);
    pass.end();
    engine.gpu.device.queue.submit([encoder.finish()]);
  });
  statusElement.textContent = "Triangle rendered";
  (window as unknown as { __triangleRendered?: boolean }).__triangleRendered =
    true;
} catch (error) {
  statusElement.textContent = "WebGPU unavailable";
  console.error(error);
}
