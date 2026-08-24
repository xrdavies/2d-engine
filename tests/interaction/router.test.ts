import { describe, expect, it, vi } from "vitest";
import {
  InputEventControl,
  type KeyboardInputEvent,
  type PointerInputEvent,
} from "../../src/input/index.ts";
import {
  InteractionRouter,
  type InteractionTarget,
} from "../../src/interaction/index.ts";

const pointer = (
  type: PointerInputEvent["type"] = "pointerdown",
  pointerId = 1,
  originalEvent?: Event,
): PointerInputEvent =>
  Object.assign(new InputEventControl(originalEvent, 0), {
    kind: "pointer" as const,
    type,
    coordinates: {
      screen: { x: 1, y: 2 },
      viewport: { x: 1, y: 2 },
      pixel: { x: 1, y: 2 },
    },
    pointerId,
    pointerType: "mouse",
    button: 0,
    buttons: 1,
    pressure: 0.5,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    isPrimary: true,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  });

const keyboard = (): KeyboardInputEvent =>
  Object.assign(new InputEventControl(undefined, 0), {
    kind: "keyboard" as const,
    type: "keydown" as const,
    key: "Enter",
    code: "Enter",
    location: 0,
    repeat: false,
    composing: false,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  });

describe("InteractionRouter", () => {
  it("routes capture, target and bubble and controls the native event", () => {
    const root: InteractionTarget = {};
    const parent: InteractionTarget = { parent: root };
    const child: InteractionTarget = { parent };
    const native = {
      defaultPrevented: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as Event;
    const router = new InteractionRouter();
    const calls: string[] = [];

    router.on(root, "pointerdown", () => calls.push("root capture"), {
      capture: true,
    });
    router.on(child, "pointerdown", (event) => {
      calls.push("child target");
      event.preventDefault();
    });
    router.on(parent, "pointerdown", (event) => {
      calls.push("parent bubble");
      event.stopPropagation();
    });
    router.on(root, "pointerdown", () => calls.push("root bubble"));

    const event = router.route(pointer("pointerdown", 1, native), child);

    expect(calls).toEqual(["root capture", "child target", "parent bubble"]);
    expect(event?.defaultPrevented).toBe(true);
    expect(native.preventDefault).toHaveBeenCalledOnce();
    expect(native.stopPropagation).toHaveBeenCalledOnce();
  });

  it("keeps focus inside its scope and routes captured pointers", () => {
    const scope: InteractionTarget = {};
    const focused: InteractionTarget = { parent: scope };
    const outside: InteractionTarget = {};
    const router = new InteractionRouter(() => outside);
    const calls: string[] = [];

    router.setFocusScope(scope);
    expect(router.focus(outside)).toBe(false);
    expect(router.focus(focused)).toBe(true);
    router.on(focused, "keydown", () => calls.push("focused"));
    router.capturePointer(3, focused);
    router.on(focused, "pointermove", () => calls.push("captured"));

    router.route(keyboard(), outside);
    router.route(pointer("pointermove", 3));
    expect(calls).toEqual(["focused", "captured"]);
    router.route(pointer("pointerup", 3));
    expect(router.pointerCapture(3)).toBeNull();
  });
});
