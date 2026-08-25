import {
  createCoordinateMapper,
  type InputCoordinates,
  type Point2D,
} from "../platform/index.ts";
import type { Camera2D } from "../render2d/camera.ts";

export class UIBridge {
  readonly root: HTMLElement;
  private readonly mapCoordinates;
  private captured = false;
  private readonly resizeObserver?: ResizeObserver;
  private readonly onWindowChange = (): void => this.sync();

  constructor(
    readonly canvas: HTMLCanvasElement,
    root?: HTMLElement,
    readonly camera?: Camera2D,
  ) {
    this.root = root ?? document.createElement("div");
    if (!this.root.parentElement) {
      this.root.dataset.engineUi = "true";
      this.root.style.position = "absolute";
      this.root.style.pointerEvents = "none";
      this.root.tabIndex = -1;
      canvas.parentElement?.appendChild(this.root);
    }
    this.mapCoordinates = createCoordinateMapper(
      canvas,
      camera
        ? (point) => camera.screenToWorld(this.toCameraViewport(point, camera))
        : undefined,
    );
    this.sync();
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.sync());
      this.resizeObserver.observe(canvas);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("resize", this.onWindowChange);
      window.addEventListener("scroll", this.onWindowChange, true);
    }
  }

  sync(): void {
    const rect = this.canvas.getBoundingClientRect();
    const offsetRect = this.root.offsetParent?.getBoundingClientRect();
    this.root.style.left = `${rect.left - (offsetRect?.left ?? 0)}px`;
    this.root.style.top = `${rect.top - (offsetRect?.top ?? 0)}px`;
    this.root.style.width = `${rect.width}px`;
    this.root.style.height = `${rect.height}px`;
  }

  coordinates(clientX: number, clientY: number): InputCoordinates {
    return this.mapCoordinates(clientX, clientY);
  }

  setInputCaptured(captured: boolean): void {
    this.captured = captured;
    this.root.style.pointerEvents = captured ? "auto" : "none";
  }

  get inputCaptured(): boolean {
    return this.captured;
  }

  focus(target: HTMLElement = this.root, options?: FocusOptions): void {
    target.focus(options);
  }

  capturePointer(pointerId: number, target: HTMLElement = this.canvas): void {
    target.setPointerCapture(pointerId);
  }

  releasePointer(pointerId: number, target: HTMLElement = this.canvas): void {
    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
  }

  worldToScreen(point: Point2D): Point2D {
    const rect = this.canvas.getBoundingClientRect();
    const screen = this.camera?.worldToScreen(point) ?? point;
    return {
      x:
        rect.left +
        (this.camera
          ? (screen.x * rect.width) / this.camera.viewportWidth
          : screen.x),
      y:
        rect.top +
        (this.camera
          ? (screen.y * rect.height) / this.camera.viewportHeight
          : screen.y),
    };
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this.onWindowChange);
      window.removeEventListener("scroll", this.onWindowChange, true);
    }
    if (this.root.dataset.engineUi === "true") this.root.remove();
  }

  private toCameraViewport(point: Point2D, camera: Camera2D): Point2D {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: rect.width > 0 ? (point.x * camera.viewportWidth) / rect.width : 0,
      y: rect.height > 0 ? (point.y * camera.viewportHeight) / rect.height : 0,
    };
  }
}
