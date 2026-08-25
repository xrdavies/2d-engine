import {
  createCoordinateMapper,
  type InputCoordinates,
  type Point2D,
} from "../platform/index.ts";

export class UIBridge {
  readonly root: HTMLElement;
  private readonly mapCoordinates;
  private captured = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    root?: HTMLElement,
  ) {
    this.root = root ?? document.createElement("div");
    if (!this.root.parentElement) {
      this.root.dataset.engineUi = "true";
      this.root.style.position = "absolute";
      this.root.style.inset = "0";
      this.root.style.pointerEvents = "none";
      canvas.parentElement?.appendChild(this.root);
    }
    this.mapCoordinates = createCoordinateMapper(canvas);
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
    return { x: rect.left + point.x, y: rect.top + point.y };
  }

  dispose(): void {
    if (this.root.dataset.engineUi === "true") this.root.remove();
  }
}
