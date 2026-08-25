import { Diagnostics } from "../debug/diagnostics.ts";
import {
  createGpuContext,
  type GpuContext,
  type GpuOptions,
} from "../gpu/device.ts";
import { GpuResourceManager } from "../gpu/resources.ts";
import { InputSource } from "../input/source.ts";
import { World } from "../world/world.ts";
import { type ClockOptions, FixedClock } from "./clock.ts";

export type EngineStatus =
  | "idle"
  | "running"
  | "paused"
  | "device-lost"
  | "destroyed";

export interface EngineSystem {
  update?(delta: number): void;
  render?(alpha: number): void;
  dispose?(): void;
}

export interface EngineViewport {
  width: number;
  height: number;
  pixelWidth: number;
  pixelHeight: number;
  dpr: number;
}

export interface EngineErrorEvent {
  error: Error;
  source: "initialization" | "runtime" | "gpu";
}

export interface EngineOptions extends GpuOptions, ClockOptions {
  canvas: HTMLCanvasElement;
  autoStart?: boolean;
  input?: boolean;
}

export interface EngineEventMap {
  error: EngineErrorEvent;
  deviceLost: GPUDeviceLostInfo;
  resize: EngineViewport;
}

type EventHandler<T> = (payload: T) => void;

export class Engine {
  readonly canvas: HTMLCanvasElement;
  readonly gpu: GpuContext;
  readonly clock: FixedClock;
  readonly world = new World();
  readonly diagnostics = new Diagnostics();
  readonly resources: GpuResourceManager;
  readonly input: InputSource | undefined;

  private _status: EngineStatus = "idle";
  private readonly systems = new Set<EngineSystem>();
  private readonly handlers = new Map<
    keyof EngineEventMap,
    Set<EventHandler<never>>
  >();
  private frameHandle: number | undefined;
  private lastTimestamp: number | undefined;
  private wasRunningBeforeVisibility = false;
  private readonly onResizeBound = (): void => {
    this.resize();
  };
  private readonly onVisibilityBound = (): void => this.handleVisibility();

  private constructor(
    canvas: HTMLCanvasElement,
    gpu: GpuContext,
    clock: FixedClock,
    inputEnabled: boolean,
  ) {
    this.canvas = canvas;
    this.gpu = gpu;
    this.clock = clock;
    this.resources = new GpuResourceManager(gpu);
    this.input = inputEnabled ? new InputSource(canvas) : undefined;

    window.addEventListener("resize", this.onResizeBound);
    document.addEventListener("visibilitychange", this.onVisibilityBound);
    this.resize();

    gpu.device.addEventListener("uncapturederror", (event) => {
      this.emit("error", {
        error: new Error(event.error.message),
        source: "gpu",
      });
    });
    void gpu.device.lost.then((info) => {
      if (this._status !== "destroyed") {
        this.cancelFrame();
        this._status = "device-lost";
        this.emit("deviceLost", info);
      }
    });
  }

  static async create(options: EngineOptions): Promise<Engine> {
    try {
      const gpu = await createGpuContext(options);
      const engine = new Engine(
        options.canvas,
        gpu,
        new FixedClock(options),
        options.input ?? true,
      );
      if (options.autoStart) {
        engine.start();
      }
      return engine;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      throw Object.assign(error, { source: "initialization" as const });
    }
  }

  get status(): EngineStatus {
    return this._status;
  }

  get viewport(): EngineViewport {
    const dpr = window.devicePixelRatio || 1;
    return {
      width: this.canvas.clientWidth || this.canvas.width,
      height: this.canvas.clientHeight || this.canvas.height,
      pixelWidth: this.canvas.width,
      pixelHeight: this.canvas.height,
      dpr,
    };
  }

  on<K extends keyof EngineEventMap>(
    event: K,
    handler: EventHandler<EngineEventMap[K]>,
  ): () => void {
    const handlers = this.handlers.get(event) ?? new Set<EventHandler<never>>();
    handlers.add(handler as EventHandler<never>);
    this.handlers.set(event, handlers);
    return () => handlers.delete(handler as EventHandler<never>);
  }

  addSystem(system: EngineSystem): () => void {
    this.assertUsable();
    this.systems.add(system);
    return () => this.systems.delete(system);
  }

  start(): void {
    this.assertUsable();
    if (this._status === "running") {
      return;
    }

    this._status = "running";
    this.lastTimestamp = undefined;
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (this._status === "destroyed") {
      return;
    }

    this.cancelFrame();
    this.clock.reset();
    this.lastTimestamp = undefined;
    this._status = "idle";
  }

  pause(): void {
    if (this._status !== "running") {
      return;
    }

    this.cancelFrame();
    this.lastTimestamp = undefined;
    this._status = "paused";
  }

  resume(): void {
    if (this._status !== "paused") {
      return;
    }

    this.start();
  }

  recover(): never {
    throw new Error(
      "WebGPU device recovery requires recreating Engine so resources can be restored",
    );
  }

  resize(): EngineViewport {
    this.assertUsable();
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.clientWidth || this.canvas.width;
    const height = this.canvas.clientHeight || this.canvas.height;
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));

    if (
      this.canvas.width !== pixelWidth ||
      this.canvas.height !== pixelHeight
    ) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
      this.gpu.configureCanvas();
    }

    const viewport = this.viewport;
    this.emit("resize", viewport);
    return viewport;
  }

  destroy(): void {
    if (this._status === "destroyed") {
      return;
    }

    this.cancelFrame();
    window.removeEventListener("resize", this.onResizeBound);
    document.removeEventListener("visibilitychange", this.onVisibilityBound);
    for (const system of this.systems) {
      system.dispose?.();
    }
    this.input?.dispose();
    this.resources.disposeAll();
    this.systems.clear();
    this.gpu.destroy();
    this._status = "destroyed";
  }

  private readonly frame = (timestamp: number): void => {
    if (this._status !== "running") {
      return;
    }

    const previous = this.lastTimestamp ?? timestamp;
    this.lastTimestamp = timestamp;
    const step = this.clock.advance((timestamp - previous) / 1000);
    this.diagnostics.beginFrame(timestamp);
    this.diagnostics.recordResources(this.resources.stats().total);

    for (let index = 0; index < step.steps; index += 1) {
      for (const system of this.systems) {
        system.update?.(this.clock.fixedDelta);
      }
    }
    for (const system of this.systems) {
      system.render?.(step.alpha);
    }
    this.diagnostics.endFrame(timestamp, step.delta);

    this.frameHandle = requestAnimationFrame(this.frame);
  };

  private handleVisibility(): void {
    if (document.hidden && this._status === "running") {
      this.wasRunningBeforeVisibility = true;
      this.pause();
    } else if (!document.hidden && this.wasRunningBeforeVisibility) {
      this.wasRunningBeforeVisibility = false;
      this.resume();
    }
  }

  private cancelFrame(): void {
    if (this.frameHandle !== undefined) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = undefined;
    }
  }

  private emit<K extends keyof EngineEventMap>(
    event: K,
    payload: EngineEventMap[K],
  ): void {
    for (const handler of this.handlers.get(event) ?? []) {
      (handler as EventHandler<EngineEventMap[K]>)(payload);
    }
  }

  private assertUsable(): void {
    if (this._status === "destroyed") {
      throw new Error("Engine has been destroyed");
    }
  }
}
