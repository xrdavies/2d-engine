import type { Sprite, TextureRegion } from "../render2d/quad.ts";

export interface SpriteFrame extends TextureRegion {
  duration?: number;
}

export interface AnimationEvent {
  name: string;
  time: number;
}

export class SpriteFrameClip {
  readonly frames: readonly SpriteFrame[];
  readonly events: readonly AnimationEvent[];
  readonly duration: number;

  constructor(
    frames: readonly SpriteFrame[],
    events: readonly AnimationEvent[] = [],
  ) {
    if (frames.length === 0)
      throw new RangeError("Sprite animation needs at least one frame");
    this.frames = frames;
    this.events = events;
    this.duration = frames.reduce(
      (total, frame) => total + (frame.duration ?? 1 / 12),
      0,
    );
  }

  sample(time: number): SpriteFrame {
    let remaining = ((time % this.duration) + this.duration) % this.duration;
    for (const frame of this.frames) {
      const duration = frame.duration ?? 1 / 12;
      if (remaining < duration) return frame;
      remaining -= duration;
    }
    return this.frames[this.frames.length - 1] as SpriteFrame;
  }

  sampleClamped(time: number): SpriteFrame {
    if (time <= 0) return this.frames[0] as SpriteFrame;
    if (time >= this.duration) {
      return this.frames[this.frames.length - 1] as SpriteFrame;
    }
    return this.sample(time);
  }

  eventsDuring(start: number, elapsed: number): readonly AnimationEvent[] {
    if (this.events.length === 0 || elapsed <= 0) return [];
    const end = start + elapsed;
    const epsilon = this.duration * 1e-9;
    const result: AnimationEvent[] = [];
    for (const event of this.events) {
      const firstCycle = Math.floor((start - event.time) / this.duration) + 1;
      const lastCycle = Math.floor(
        (end - event.time + epsilon) / this.duration,
      );
      for (let cycle = firstCycle; cycle <= lastCycle; cycle += 1) {
        result.push(event);
      }
    }
    return result.sort((left, right) => left.time - right.time);
  }

  eventsBetween(
    previous: number,
    current: number,
    loop: boolean,
  ): readonly AnimationEvent[] {
    if (this.events.length === 0) return [];
    const ranges: Array<[number, number]> =
      loop && current < previous
        ? [
            [previous, this.duration],
            [0, current],
          ]
        : [[previous, current]];
    return this.events.filter((event) =>
      ranges.some(([start, end]) => event.time > start && event.time <= end),
    );
  }
}

export class AnimationPlayer {
  clip: SpriteFrameClip | undefined;
  time = 0;
  speed = 1;
  loop = true;
  playing = false;
  onEvent?: (event: AnimationEvent) => void;

  play(clip = this.clip, restart = false): this {
    if (clip) this.clip = clip;
    if (restart) this.time = 0;
    this.playing = this.clip !== undefined;
    return this;
  }

  pause(): this {
    this.playing = false;
    return this;
  }

  stop(): this {
    this.playing = false;
    this.time = 0;
    return this;
  }

  update(delta: number): SpriteFrame | undefined {
    const clip = this.clip;
    if (!clip) return undefined;
    if (this.playing) {
      const elapsed = Math.max(0, delta) * Math.max(0, this.speed);
      const previous = this.time;
      const next = previous + elapsed;
      if (this.loop) {
        for (const event of clip.eventsDuring(previous, elapsed)) {
          this.onEvent?.(event);
        }
        this.time = next % clip.duration;
      } else {
        this.time = Math.min(next, clip.duration);
        for (const event of clip.eventsBetween(previous, this.time, false)) {
          this.onEvent?.(event);
        }
      }
      if (!this.loop && next >= clip.duration) {
        this.playing = false;
      }
    }
    return this.loop ? clip.sample(this.time) : clip.sampleClamped(this.time);
  }
}

export class SpriteAnimationBinding {
  constructor(
    readonly sprite: Sprite,
    readonly player: AnimationPlayer,
  ) {}

  update(delta: number): SpriteFrame | undefined {
    const frame = this.player.update(delta);
    if (frame) this.sprite.frame = frame;
    return frame;
  }
}
