import {
  createCoordinateMapper,
  type InputCoordinates,
  type Point2D,
} from "../platform/index.ts";
import type { Camera2D } from "../render2d/camera.ts";

export interface UIBridgeButton {
  kind: "button";
  id: string;
  label: string;
  rect: { x: number; y: number; width: number; height: number };
  disabled?: boolean;
  pressed?: boolean;
}

export interface UIBridgeSlider {
  kind: "slider";
  id: string;
  label: string;
  rect: { x: number; y: number; width: number; height: number };
  min: number;
  max: number;
  value: number;
  step?: number;
  disabled?: boolean;
}

export type UIBridgeControl = UIBridgeButton | UIBridgeSlider;
export type UIBridgeControlHandler = (
  control: UIBridgeControl,
  value?: number,
) => void;

export class UIBridge {
  readonly root: HTMLElement;
  private readonly mapCoordinates;
  private captured = false;
  private readonly controls = new Map<
    string,
    HTMLButtonElement | HTMLInputElement
  >();
  private controlOrder = "";
  private announcer?: HTMLElement;
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

  describe(label: string): void {
    this.canvas.setAttribute("role", "img");
    this.canvas.setAttribute("aria-label", label);
  }

  announce(message: string): void {
    if (!message) {
      if (this.announcer) this.announcer.textContent = "";
      return;
    }
    if (!this.announcer) {
      this.announcer = (this.root.ownerDocument ?? document).createElement(
        "div",
      );
      this.announcer.setAttribute("role", "status");
      this.announcer.setAttribute("aria-live", "polite");
      this.announcer.style.position = "absolute";
      this.announcer.style.width = "1px";
      this.announcer.style.height = "1px";
      this.announcer.style.overflow = "hidden";
      this.announcer.style.clipPath = "inset(50%)";
      this.root.appendChild(this.announcer);
    }
    this.announcer.textContent = message;
  }

  syncControls(
    controls: readonly UIBridgeControl[],
    onActivate: UIBridgeControlHandler,
  ): void {
    const live = new Set<string>();
    const ordered = [...controls].sort((a, b) => {
      const ay = a.rect.y + a.rect.height / 2;
      const by = b.rect.y + b.rect.height / 2;
      return Math.round(ay / 16) - Math.round(by / 16) || a.rect.x - b.rect.x;
    });
    for (const control of ordered) {
      live.add(control.id);
      let element = this.controls.get(control.id);
      const tag = control.kind === "slider" ? "INPUT" : "BUTTON";
      if (element?.tagName !== tag) {
        element?.remove();
        element = (this.root.ownerDocument ?? document).createElement(
          control.kind === "slider" ? "input" : "button",
        );
        element.dataset.engineUiControl = control.id;
        element.style.position = "absolute";
        element.style.pointerEvents = "none";
        element.style.appearance = "none";
        element.style.background = "transparent";
        element.style.border = "0";
        element.style.color = "transparent";
        element.style.fontSize = "0";
        element.style.margin = "0";
        element.style.padding = "0";
        element.style.zIndex = "2147483647";
        this.root.appendChild(element);
        this.controls.set(control.id, element);
      }
      element.setAttribute("aria-label", control.label);
      element.style.left = `${control.rect.x}px`;
      element.style.top = `${control.rect.y}px`;
      element.style.width = `${control.rect.width}px`;
      element.style.height = `${control.rect.height}px`;
      element.disabled = Boolean(control.disabled);
      if (control.kind === "button") {
        const button = element as HTMLButtonElement;
        button.type = "button";
        button.textContent = control.label;
        button.onclick = () => onActivate(control);
        if (control.pressed == null) button.removeAttribute("aria-pressed");
        else button.setAttribute("aria-pressed", String(control.pressed));
      } else {
        const slider = element as HTMLInputElement;
        slider.type = "range";
        slider.min = String(control.min);
        slider.max = String(control.max);
        slider.step = String(control.step ?? 1);
        slider.value = String(control.value);
        slider.oninput = () => onActivate(control, slider.valueAsNumber);
      }
    }
    for (const [id, element] of this.controls) {
      if (live.has(id)) continue;
      element.remove();
      this.controls.delete(id);
    }
    const order = ordered.map((control) => control.id).join("\0");
    if (this.controlOrder && order !== this.controlOrder) {
      for (const control of ordered) {
        const element = this.controls.get(control.id);
        if (element) this.root.appendChild(element);
      }
    }
    this.controlOrder = order;
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
    for (const element of this.controls.values()) element.remove();
    this.controls.clear();
    this.announcer?.remove();
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
