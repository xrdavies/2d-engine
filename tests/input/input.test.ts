import { describe, expect, it } from "vitest";
import {
  ActionMap,
  InputSource,
  normalizeCompositionEvent,
  normalizeGamepad,
  normalizeKeyboardEvent,
  normalizePointerEvent,
  normalizeTextInputEvent,
  normalizeTouchEvent,
  normalizeWheelEvent,
} from "../../src/input/index.ts";
import { createCoordinateMapper } from "../../src/platform/index.ts";

const pointer = (type: "pointerdown" | "pointerup", button = 0) =>
  normalizePointerEvent(
    {
      type,
      timeStamp: 1,
      defaultPrevented: false,
      preventDefault() {},
      stopPropagation() {},
      clientX: 60,
      clientY: 45,
      pointerId: 7,
      pointerType: "mouse",
      button,
      buttons: type === "pointerdown" ? 1 : 0,
      pressure: 0.5,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
      isPrimary: true,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    } as PointerEvent,
    createCoordinateMapper({
      width: 200,
      height: 100,
      getBoundingClientRect: () => ({
        left: 10,
        top: 20,
        width: 100,
        height: 50,
      }),
    }),
  );

describe("input", () => {
  it("normalizes canvas coordinates and pointer data", () => {
    const event = pointer("pointerdown");

    expect(event.coordinates).toEqual({
      screen: { x: 60, y: 45 },
      viewport: { x: 50, y: 25 },
      pixel: { x: 100, y: 50 },
      world: undefined,
    });
    expect(event.pointerId).toBe(7);
  });

  it("maps normalized device state to named actions", () => {
    const actions = new ActionMap<"fire">().bind("fire", {
      type: "pointer",
      button: 0,
    });

    actions.handle(pointer("pointerdown"));
    expect(actions.active("fire")).toBe(true);
    actions.handle(pointer("pointerup"));
    expect(actions.active("fire")).toBe(false);
  });

  it("normalizes keyboard, touch, gamepad and IME data", () => {
    const modifiers = {
      altKey: false,
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
    };
    const keyboard = normalizeKeyboardEvent({
      type: "keydown",
      key: "a",
      code: "KeyA",
      location: 0,
      repeat: false,
      isComposing: true,
      ...modifiers,
    } as KeyboardEvent);
    const touch = {
      identifier: 2,
      clientX: 20,
      clientY: 30,
      radiusX: 1,
      radiusY: 2,
      rotationAngle: 3,
      force: 0.5,
    } as Touch;
    const touchEvent = normalizeTouchEvent(
      {
        type: "touchstart",
        touches: [touch],
        changedTouches: [touch],
        ...modifiers,
      } as unknown as TouchEvent,
      (x, y) => ({
        screen: { x, y },
        viewport: { x, y },
        pixel: { x, y },
      }),
    );
    const composition = normalizeCompositionEvent({
      type: "compositionupdate",
      data: "kana",
    } as CompositionEvent);
    const gamepad = normalizeGamepad({
      index: 1,
      id: "pad",
      connected: true,
      mapping: "standard",
      timestamp: 12,
      axes: [0.75],
      buttons: [{ pressed: true, touched: true, value: 1 }],
    } as unknown as Gamepad);

    expect(keyboard).toMatchObject({ code: "KeyA", composing: true });
    expect(touchEvent.changedTouches[0]).toMatchObject({ id: 2, force: 0.5 });
    expect(composition.data).toBe("kana");
    expect(gamepad).toMatchObject({ index: 1, axes: [0.75] });
  });

  it("normalizes wheel and text input data", () => {
    const wheel = normalizeWheelEvent(
      {
        type: "wheel",
        clientX: 10,
        clientY: 20,
        deltaX: 1,
        deltaY: -2,
        deltaZ: 3,
        deltaMode: 1,
        altKey: false,
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
      } as WheelEvent,
      (x, y) => ({
        screen: { x, y },
        viewport: { x, y },
        pixel: { x, y },
      }),
    );
    const beforeInput = normalizeTextInputEvent({
      type: "beforeinput",
      data: "字",
      inputType: "insertCompositionText",
      isComposing: true,
    } as InputEvent);

    expect(wheel).toMatchObject({
      kind: "wheel",
      deltaX: 1,
      deltaY: -2,
      deltaZ: 3,
      deltaMode: 1,
      modifiers: { ctrl: true, shift: true },
      coordinates: { viewport: { x: 10, y: 20 } },
    });
    expect(beforeInput).toMatchObject({
      kind: "text",
      type: "beforeinput",
      data: "字",
      inputType: "insertCompositionText",
      composing: true,
    });
  });

  it("emits wheel, beforeinput and input events from the browser source", () => {
    const target = new EventTarget();
    const source = new InputSource(target as HTMLElement, {
      mapCoordinates: (x, y) => ({
        screen: { x, y },
        viewport: { x, y },
        pixel: { x, y },
      }),
      gamepads: () => [],
    });
    const events: Array<{ type: string; kind: string }> = [];
    source.onInput(({ kind, type }) => events.push({ kind, type }));

    target.dispatchEvent(
      Object.assign(new Event("wheel"), {
        clientX: 4,
        clientY: 5,
        deltaX: 0,
        deltaY: 1,
        deltaZ: 0,
        deltaMode: 0,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      }),
    );
    for (const type of ["beforeinput", "input"] as const) {
      target.dispatchEvent(
        Object.assign(new Event(type), {
          data: "a",
          inputType: "insertText",
          isComposing: false,
        }),
      );
    }

    expect(events).toEqual([
      { kind: "wheel", type: "wheel" },
      { kind: "text", type: "beforeinput" },
      { kind: "text", type: "input" },
    ]);
    source.dispose();
  });
});
