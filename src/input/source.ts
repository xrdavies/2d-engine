import type { CoordinateMapper } from "../platform/index.ts";
import { createCoordinateMapper } from "../platform/index.ts";
import {
  type GamepadInputEvent,
  type NormalizedInputEvent,
  normalizeCompositionEvent,
  normalizeGamepad,
  normalizeKeyboardEvent,
  normalizePointerEvent,
  normalizeTextInputEvent,
  normalizeTouchEvent,
  normalizeWheelEvent,
} from "./events.ts";

export interface InputSourceOptions {
  mapCoordinates?: CoordinateMapper;
  keyboardTarget?: EventTarget;
  gamepads?: () => readonly (Gamepad | null)[];
}

export type InputHandler = (event: NormalizedInputEvent) => void;

export class InputSource {
  private readonly handlers = new Set<InputHandler>();
  private readonly listeners: Array<
    readonly [EventTarget, string, EventListener]
  > = [];
  private readonly mapCoordinates: CoordinateMapper;
  private readonly gamepads: () => readonly (Gamepad | null)[];

  constructor(
    private readonly target: HTMLElement,
    options: InputSourceOptions = {},
  ) {
    this.mapCoordinates =
      options.mapCoordinates ?? createCoordinateMapper(target);
    this.gamepads =
      options.gamepads ?? (() => Array.from(navigator.getGamepads?.() ?? []));

    for (const type of [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
    ] as const) {
      this.listen(target, type, (event) =>
        this.emit(
          normalizePointerEvent(event as PointerEvent, this.mapCoordinates),
        ),
      );
    }
    this.listen(target, "wheel", (event) =>
      this.emit(normalizeWheelEvent(event as WheelEvent, this.mapCoordinates)),
    );
    for (const type of [
      "touchstart",
      "touchmove",
      "touchend",
      "touchcancel",
    ] as const) {
      this.listen(target, type, (event) =>
        this.emit(
          normalizeTouchEvent(event as TouchEvent, this.mapCoordinates),
        ),
      );
    }

    const keyboardTarget = options.keyboardTarget ?? target;
    for (const type of ["keydown", "keyup"] as const) {
      this.listen(keyboardTarget, type, (event) =>
        this.emit(normalizeKeyboardEvent(event as KeyboardEvent)),
      );
    }
    for (const type of ["beforeinput", "input"] as const) {
      this.listen(keyboardTarget, type, (event) =>
        this.emit(normalizeTextInputEvent(event as InputEvent)),
      );
    }
    for (const type of [
      "compositionstart",
      "compositionupdate",
      "compositionend",
    ] as const) {
      this.listen(keyboardTarget, type, (event) =>
        this.emit(normalizeCompositionEvent(event as CompositionEvent)),
      );
    }

    if (typeof window !== "undefined") {
      for (const type of ["gamepadconnected", "gamepaddisconnected"] as const) {
        this.listen(window, type, (event) => {
          const gamepadEvent = event as GamepadEvent;
          this.emit(normalizeGamepad(gamepadEvent.gamepad, type, gamepadEvent));
        });
      }
    }
  }

  onInput(handler: InputHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  pollGamepads(): readonly GamepadInputEvent[] {
    const events = this.gamepads()
      .filter((gamepad): gamepad is Gamepad => gamepad !== null)
      .map((gamepad) => normalizeGamepad(gamepad));
    for (const event of events) {
      this.emit(event);
    }
    return events;
  }

  capturePointer(pointerId: number): void {
    this.target.setPointerCapture(pointerId);
  }

  releasePointer(pointerId: number): void {
    if (this.target.hasPointerCapture(pointerId)) {
      this.target.releasePointerCapture(pointerId);
    }
  }

  focus(options?: FocusOptions): void {
    this.target.focus(options);
  }

  dispose(): void {
    for (const [target, type, listener] of this.listeners) {
      target.removeEventListener(type, listener);
    }
    this.listeners.length = 0;
    this.handlers.clear();
  }

  private listen(
    target: EventTarget,
    type: string,
    listener: EventListener,
  ): void {
    target.addEventListener(type, listener, { passive: false });
    this.listeners.push([target, type, listener]);
  }

  private emit(event: NormalizedInputEvent): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }
}
