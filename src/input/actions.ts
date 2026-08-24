import type { NormalizedInputEvent } from "./events.ts";

export type ActionBinding =
  | { type: "key"; code: string }
  | { type: "pointer"; button: number }
  | { type: "touch" }
  | { type: "gamepad-button"; button: number; gamepad?: number }
  | {
      type: "gamepad-axis";
      axis: number;
      direction: -1 | 1;
      threshold?: number;
      gamepad?: number;
    };

export class ActionMap<Action extends string = string> {
  private readonly bindings = new Map<Action, ActionBinding[]>();
  private readonly keys = new Set<string>();
  private readonly pointerButtons = new Map<number, Set<number>>();
  private readonly touches = new Set<number>();
  private readonly gamepads = new Map<
    number,
    Extract<NormalizedInputEvent, { kind: "gamepad" }>
  >();

  bind(action: Action, ...bindings: ActionBinding[]): this {
    this.bindings.set(action, bindings);
    return this;
  }

  unbind(action: Action): boolean {
    return this.bindings.delete(action);
  }

  handle(event: NormalizedInputEvent): void {
    if (event.kind === "keyboard") {
      if (event.type === "keydown") this.keys.add(event.code);
      else this.keys.delete(event.code);
    } else if (event.kind === "pointer") {
      if (event.type === "pointerdown") {
        const buttons = this.pointerButtons.get(event.pointerId) ?? new Set();
        buttons.add(event.button);
        this.pointerButtons.set(event.pointerId, buttons);
      } else if (event.type === "pointerup") {
        const buttons = this.pointerButtons.get(event.pointerId);
        buttons?.delete(event.button);
        if (buttons?.size === 0) this.pointerButtons.delete(event.pointerId);
      } else if (event.type === "pointercancel") {
        this.pointerButtons.delete(event.pointerId);
      }
    } else if (event.kind === "touch") {
      this.touches.clear();
      for (const touch of event.touches) this.touches.add(touch.id);
    } else if (event.kind === "gamepad") {
      if (event.type === "gamepaddisconnected")
        this.gamepads.delete(event.index);
      else this.gamepads.set(event.index, event);
    }
  }

  value(action: Action): number {
    let value = 0;
    for (const binding of this.bindings.get(action) ?? []) {
      value = Math.max(value, this.bindingValue(binding));
    }
    return value;
  }

  active(action: Action): boolean {
    return this.value(action) > 0;
  }

  reset(): void {
    this.keys.clear();
    this.pointerButtons.clear();
    this.touches.clear();
    this.gamepads.clear();
  }

  private bindingValue(binding: ActionBinding): number {
    if (binding.type === "key") return Number(this.keys.has(binding.code));
    if (binding.type === "pointer") {
      return Number(
        [...this.pointerButtons.values()].some((buttons) =>
          buttons.has(binding.button),
        ),
      );
    }
    if (binding.type === "touch") return Number(this.touches.size > 0);

    const gamepads =
      binding.gamepad === undefined
        ? this.gamepads.values()
        : [this.gamepads.get(binding.gamepad)].filter(
            (gamepad): gamepad is NonNullable<typeof gamepad> =>
              gamepad !== undefined,
          );
    let value = 0;
    for (const gamepad of gamepads) {
      if (binding.type === "gamepad-button") {
        const button = gamepad.buttons[binding.button];
        value = Math.max(value, button?.value ?? 0, Number(button?.pressed));
      } else {
        const axis = (gamepad.axes[binding.axis] ?? 0) * binding.direction;
        if (axis >= (binding.threshold ?? 0.5)) value = Math.max(value, axis);
      }
    }
    return value;
  }
}
