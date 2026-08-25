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

  constructor(
    readonly canvas: HTMLCanvasElement,
    root?: HTMLElement,
    readonly camera?: Camera2D,
  ) {
    this.root = root ?? document.createElement("div");
    if (!this.root.parentElement) {
      this.root.dataset.engineUi = "true";
      this.root.style.position = "absolute";
      this.root.style.inset = "0";
      this.root.style.pointerEvents = "none";
      canvas.parentElement?.appendChild(this.root);
    }
    this.mapCoordinates = createCoordinateMapper(
      canvas,
      camera
        ? (point) => camera.screenToWorld(this.toCameraViewport(point, camera))
        : undefined,
    );
    this.sync();
  }

  sync(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.root.style.left = `${rect.left}px`;
    this.root.style.top = `${rect.top}px`;
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
