export type EaseFn = (t: number) => number;

export const easeLinear: EaseFn = (t) => t;
export const easeOutQuad: EaseFn = (t) => 1 - (1 - t) * (1 - t);
export const easeOutCubic: EaseFn = (t) => 1 - (1 - t) ** 3;
export const easeOutBack: EaseFn = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

export function clamp01(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t;
}

export function tweenValue(
  from: number,
  to: number,
  t: number,
  ease: EaseFn = easeLinear,
): number {
  const u = ease(clamp01(t));
  return from + (to - from) * u;
}

export class Tween {
  elapsed = 0;
  done = false;

  constructor(
    readonly from: number,
    readonly to: number,
    readonly duration: number,
    readonly ease: EaseFn = easeOutQuad,
  ) {
    if (!(duration > 0) || !Number.isFinite(duration)) {
      throw new RangeError("Tween duration must be a finite positive number");
    }
  }

  get value(): number {
    return tweenValue(
      this.from,
      this.to,
      this.duration > 0 ? this.elapsed / this.duration : 1,
      this.ease,
    );
  }

  update(delta: number): number {
    if (this.done) return this.to;
    this.elapsed = Math.min(this.duration, this.elapsed + Math.max(0, delta));
    if (this.elapsed >= this.duration) this.done = true;
    return this.value;
  }
}

export interface TweenHandle {
  tween: Tween;
  onUpdate?: (value: number) => void;
  onDone?: () => void;
}

export class TweenPlayer {
  private readonly active: TweenHandle[] = [];

  spawn(
    from: number,
    to: number,
    duration: number,
    options: {
      ease?: EaseFn;
      onUpdate?: (value: number) => void;
      onDone?: () => void;
    } = {},
  ): Tween {
    const tween = new Tween(from, to, duration, options.ease ?? easeOutQuad);
    this.active.push({
      tween,
      onUpdate: options.onUpdate,
      onDone: options.onDone,
    });
    options.onUpdate?.(tween.value);
    return tween;
  }

  get size(): number {
    return this.active.length;
  }

  update(delta: number): void {
    for (let index = this.active.length - 1; index >= 0; index -= 1) {
      const handle = this.active[index];
      if (!handle) continue;
      const value = handle.tween.update(delta);
      handle.onUpdate?.(value);
      if (handle.tween.done) {
        handle.onDone?.();
        this.active.splice(index, 1);
      }
    }
  }

  clear(): void {
    this.active.length = 0;
  }
}
