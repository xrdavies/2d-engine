import type { CoordinateMapper, InputCoordinates } from "../platform/index.ts";

export type InputEventType =
  | "pointerdown"
  | "pointermove"
  | "pointerup"
  | "pointercancel"
  | "wheel"
  | "keydown"
  | "keyup"
  | "beforeinput"
  | "input"
  | "touchstart"
  | "touchmove"
  | "touchend"
  | "touchcancel"
  | "compositionstart"
  | "compositionupdate"
  | "compositionend"
  | "gamepadconnected"
  | "gamepaddisconnected"
  | "gamepadstate";

export class InputEventControl {
  defaultPrevented: boolean;
  propagationStopped = false;

  constructor(
    readonly originalEvent?: Event,
    readonly timestamp = originalEvent?.timeStamp ?? performance.now(),
  ) {
    this.defaultPrevented = originalEvent?.defaultPrevented ?? false;
  }

  preventDefault(): void {
    this.defaultPrevented = true;
    this.originalEvent?.preventDefault();
  }

  stopPropagation(): void {
    this.propagationStopped = true;
    this.originalEvent?.stopPropagation();
  }
}

export interface InputModifiers {
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

export interface PointerInputEvent extends InputEventControl {
  kind: "pointer";
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel";
  coordinates: InputCoordinates;
  pointerId: number;
  pointerType: string;
  button: number;
  buttons: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
  twist: number;
  isPrimary: boolean;
  modifiers: InputModifiers;
}

export interface KeyboardInputEvent extends InputEventControl {
  kind: "keyboard";
  type: "keydown" | "keyup";
  key: string;
  code: string;
  location: number;
  repeat: boolean;
  composing: boolean;
  modifiers: InputModifiers;
}

export interface WheelInputEvent extends InputEventControl {
  kind: "wheel";
  type: "wheel";
  coordinates: InputCoordinates;
  deltaX: number;
  deltaY: number;
  deltaZ: number;
  deltaMode: number;
  modifiers: InputModifiers;
}

export interface TextInputEvent extends InputEventControl {
  kind: "text";
  type: "beforeinput" | "input";
  data: string | null;
  inputType: string;
  composing: boolean;
}

export interface TouchPoint {
  id: number;
  coordinates: InputCoordinates;
  radiusX: number;
  radiusY: number;
  rotation: number;
  force: number;
}

export interface TouchInputEvent extends InputEventControl {
  kind: "touch";
  type: "touchstart" | "touchmove" | "touchend" | "touchcancel";
  touches: readonly TouchPoint[];
  changedTouches: readonly TouchPoint[];
  modifiers: InputModifiers;
}

export interface CompositionInputEvent extends InputEventControl {
  kind: "composition";
  type: "compositionstart" | "compositionupdate" | "compositionend";
  data: string;
}

export interface GamepadButtonState {
  pressed: boolean;
  touched: boolean;
  value: number;
}

export interface GamepadInputEvent extends InputEventControl {
  kind: "gamepad";
  type: "gamepadconnected" | "gamepaddisconnected" | "gamepadstate";
  index: number;
  id: string;
  connected: boolean;
  mapping: GamepadMappingType;
  axes: readonly number[];
  buttons: readonly GamepadButtonState[];
}

export type NormalizedInputEvent =
  | PointerInputEvent
  | WheelInputEvent
  | KeyboardInputEvent
  | TextInputEvent
  | TouchInputEvent
  | CompositionInputEvent
  | GamepadInputEvent;

const modifiers = (event: {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): InputModifiers => ({
  alt: event.altKey,
  ctrl: event.ctrlKey,
  meta: event.metaKey,
  shift: event.shiftKey,
});

export function normalizePointerEvent(
  event: PointerEvent,
  mapCoordinates: CoordinateMapper,
): PointerInputEvent {
  return Object.assign(new InputEventControl(event), {
    kind: "pointer" as const,
    type: event.type as PointerInputEvent["type"],
    coordinates: mapCoordinates(event.clientX, event.clientY),
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    button: event.button,
    buttons: event.buttons,
    pressure: event.pressure,
    tiltX: event.tiltX,
    tiltY: event.tiltY,
    twist: event.twist,
    isPrimary: event.isPrimary,
    modifiers: modifiers(event),
  });
}

export function normalizeKeyboardEvent(
  event: KeyboardEvent,
): KeyboardInputEvent {
  return Object.assign(new InputEventControl(event), {
    kind: "keyboard" as const,
    type: event.type as KeyboardInputEvent["type"],
    key: event.key,
    code: event.code,
    location: event.location,
    repeat: event.repeat,
    composing: event.isComposing,
    modifiers: modifiers(event),
  });
}

export function normalizeWheelEvent(
  event: WheelEvent,
  mapCoordinates: CoordinateMapper,
): WheelInputEvent {
  return Object.assign(new InputEventControl(event), {
    kind: "wheel" as const,
    type: "wheel" as const,
    coordinates: mapCoordinates(event.clientX, event.clientY),
    deltaX: event.deltaX,
    deltaY: event.deltaY,
    deltaZ: event.deltaZ,
    deltaMode: event.deltaMode,
    modifiers: modifiers(event),
  });
}

export function normalizeTextInputEvent(event: InputEvent): TextInputEvent {
  return Object.assign(new InputEventControl(event), {
    kind: "text" as const,
    type: event.type as TextInputEvent["type"],
    data: event.data,
    inputType: event.inputType,
    composing: event.isComposing,
  });
}

const normalizeTouch = (
  touch: Touch,
  mapCoordinates: CoordinateMapper,
): TouchPoint => ({
  id: touch.identifier,
  coordinates: mapCoordinates(touch.clientX, touch.clientY),
  radiusX: touch.radiusX,
  radiusY: touch.radiusY,
  rotation: touch.rotationAngle,
  force: touch.force,
});

export function normalizeTouchEvent(
  event: TouchEvent,
  mapCoordinates: CoordinateMapper,
): TouchInputEvent {
  return Object.assign(new InputEventControl(event), {
    kind: "touch" as const,
    type: event.type as TouchInputEvent["type"],
    touches: Array.from(event.touches, (touch) =>
      normalizeTouch(touch, mapCoordinates),
    ),
    changedTouches: Array.from(event.changedTouches, (touch) =>
      normalizeTouch(touch, mapCoordinates),
    ),
    modifiers: modifiers(event),
  });
}

export function normalizeCompositionEvent(
  event: CompositionEvent,
): CompositionInputEvent {
  return Object.assign(new InputEventControl(event), {
    kind: "composition" as const,
    type: event.type as CompositionInputEvent["type"],
    data: event.data,
  });
}

export function normalizeGamepad(
  gamepad: Gamepad,
  type: GamepadInputEvent["type"] = "gamepadstate",
  originalEvent?: Event,
): GamepadInputEvent {
  return Object.assign(
    new InputEventControl(originalEvent, gamepad.timestamp),
    {
      kind: "gamepad" as const,
      type,
      index: gamepad.index,
      id: gamepad.id,
      connected: gamepad.connected,
      mapping: gamepad.mapping,
      axes: Array.from(gamepad.axes),
      buttons: Array.from(gamepad.buttons, ({ pressed, touched, value }) => ({
        pressed,
        touched,
        value,
      })),
    },
  );
}
