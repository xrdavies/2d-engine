import type { NormalizedInputEvent } from "../input/index.ts";
import type { InputCoordinates } from "../platform/index.ts";

export interface InteractionTarget {
  parent?: InteractionTarget | null;
}

export type InteractionPhase = "capture" | "target" | "bubble";

export class RoutedInputEvent {
  currentTarget: InteractionTarget;
  phase: InteractionPhase = "target";

  constructor(
    readonly input: NormalizedInputEvent,
    readonly target: InteractionTarget,
  ) {
    this.currentTarget = target;
  }

  get type(): NormalizedInputEvent["type"] {
    return this.input.type;
  }

  get defaultPrevented(): boolean {
    return this.input.defaultPrevented;
  }

  get propagationStopped(): boolean {
    return this.input.propagationStopped;
  }

  preventDefault(): void {
    this.input.preventDefault();
  }

  stopPropagation(): void {
    this.input.stopPropagation();
  }
}

export type InteractionHandler = (event: RoutedInputEvent) => void;
export type HitTest = (
  coordinates: InputCoordinates,
  event: NormalizedInputEvent,
) => InteractionTarget | null | undefined;

interface TargetListeners {
  capture: Set<InteractionHandler>;
  bubble: Set<InteractionHandler>;
}

export class InteractionRouter {
  private readonly listeners = new WeakMap<
    InteractionTarget,
    Map<string, TargetListeners>
  >();
  private readonly pointerCaptures = new Map<number, InteractionTarget>();
  private focusedTarget: InteractionTarget | null = null;
  private focusScope: InteractionTarget | null = null;

  constructor(private readonly hitTest?: HitTest) {}

  on(
    target: InteractionTarget,
    type: NormalizedInputEvent["type"] | "*",
    handler: InteractionHandler,
    options: { capture?: boolean } = {},
  ): () => void {
    let events = this.listeners.get(target);
    if (!events) {
      events = new Map();
      this.listeners.set(target, events);
    }
    let handlers = events.get(type);
    if (!handlers) {
      handlers = { capture: new Set(), bubble: new Set() };
      events.set(type, handlers);
    }
    const selected = options.capture ? handlers.capture : handlers.bubble;
    selected.add(handler);
    return () => selected.delete(handler);
  }

  route(
    input: NormalizedInputEvent,
    target?: InteractionTarget | null,
  ): RoutedInputEvent | undefined {
    const resolved = this.resolveTarget(input, target);
    if (!resolved) return undefined;

    const event = new RoutedInputEvent(input, resolved);
    const path = this.pathToRoot(
      resolved,
      this.isFocusEvent(input) ? this.focusScope : null,
    );

    for (let index = path.length - 1; index > 0; index -= 1) {
      this.invoke(path[index] as InteractionTarget, event, "capture", true);
      if (event.propagationStopped) break;
    }
    if (!event.propagationStopped) {
      this.invoke(resolved, event, "target", true);
      this.invoke(resolved, event, "target", false);
    }
    if (!event.propagationStopped) {
      for (let index = 1; index < path.length; index += 1) {
        this.invoke(path[index] as InteractionTarget, event, "bubble", false);
        if (event.propagationStopped) break;
      }
    }

    if (
      input.kind === "pointer" &&
      (input.type === "pointerup" || input.type === "pointercancel")
    ) {
      this.pointerCaptures.delete(input.pointerId);
    }
    return event;
  }

  focus(target: InteractionTarget | null): boolean {
    if (target && this.focusScope && !this.contains(this.focusScope, target)) {
      return false;
    }
    this.focusedTarget = target;
    return true;
  }

  get focused(): InteractionTarget | null {
    return this.focusedTarget;
  }

  setFocusScope(scope: InteractionTarget | null): void {
    this.focusScope = scope;
    if (
      this.focusedTarget &&
      scope &&
      !this.contains(scope, this.focusedTarget)
    ) {
      this.focusedTarget = null;
    }
  }

  capturePointer(pointerId: number, target: InteractionTarget): void {
    this.pointerCaptures.set(pointerId, target);
  }

  releasePointer(pointerId: number, target?: InteractionTarget): boolean {
    if (target && this.pointerCaptures.get(pointerId) !== target) return false;
    return this.pointerCaptures.delete(pointerId);
  }

  pointerCapture(pointerId: number): InteractionTarget | null {
    return this.pointerCaptures.get(pointerId) ?? null;
  }

  private resolveTarget(
    input: NormalizedInputEvent,
    target?: InteractionTarget | null,
  ): InteractionTarget | null {
    if (input.kind === "pointer") {
      const captured = this.pointerCaptures.get(input.pointerId);
      if (captured) return captured;
    }
    if (this.isFocusEvent(input)) {
      return this.focusedTarget ?? this.focusScope;
    }
    if (target) return target;
    const coordinates =
      input.kind === "pointer"
        ? input.coordinates
        : input.kind === "touch"
          ? input.changedTouches[0]?.coordinates
          : undefined;
    return coordinates ? (this.hitTest?.(coordinates, input) ?? null) : null;
  }

  private pathToRoot(
    target: InteractionTarget,
    boundary: InteractionTarget | null,
  ): InteractionTarget[] {
    const path: InteractionTarget[] = [];
    const visited = new Set<InteractionTarget>();
    for (
      let node: InteractionTarget | null | undefined = target;
      node;
      node = node.parent
    ) {
      if (visited.has(node))
        throw new Error("Interaction target hierarchy contains a cycle");
      visited.add(node);
      path.push(node);
      if (node === boundary) break;
    }
    return path;
  }

  private contains(
    parent: InteractionTarget,
    target: InteractionTarget,
  ): boolean {
    return this.pathToRoot(target, null).includes(parent);
  }

  private invoke(
    target: InteractionTarget,
    event: RoutedInputEvent,
    phase: InteractionPhase,
    capture: boolean,
  ): void {
    event.currentTarget = target;
    event.phase = phase;
    const events = this.listeners.get(target);
    for (const type of [event.type, "*"]) {
      for (const handler of events?.get(type)?.[
        capture ? "capture" : "bubble"
      ] ?? []) {
        handler(event);
      }
    }
  }

  private isFocusEvent(input: NormalizedInputEvent): boolean {
    return input.kind === "keyboard" || input.kind === "composition";
  }
}
