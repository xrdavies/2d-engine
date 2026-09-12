import { describe, expect, it } from "vitest";
import {
  clamp01,
  easeLinear,
  Tween,
  TweenPlayer,
  tweenValue,
} from "../../src/animation/tween.ts";

describe("Tween", () => {
  it("interpolates with an easing function", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(tweenValue(10, 20, 0.5, easeLinear)).toBe(15);
    const tween = new Tween(0, 100, 1, easeLinear);
    expect(tween.update(0.25)).toBe(25);
    expect(tween.done).toBe(false);
    expect(tween.update(1)).toBe(100);
    expect(tween.done).toBe(true);
    expect(tween.update(1)).toBe(100);
  });

  it("rejects non-positive durations", () => {
    expect(() => new Tween(0, 1, 0)).toThrow(/duration/);
  });

  it("runs a player until tweens complete", () => {
    const player = new TweenPlayer();
    const values: number[] = [];
    let done = 0;
    player.spawn(0, 10, 0.5, {
      ease: easeLinear,
      onUpdate: (value) => values.push(value),
      onDone: () => {
        done += 1;
      },
    });
    player.update(0.25);
    player.update(0.25);
    expect(done).toBe(1);
    expect(player.size).toBe(0);
    expect(values[0]).toBe(0);
    expect(values.at(-1)).toBe(10);
  });
});
