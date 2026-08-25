import { describe, expect, it } from "vitest";
import {
  AnimationPlayer,
  SpriteAnimationBinding,
  SpriteFrameClip,
} from "../../src/animation/index.ts";

describe("Sprite animation", () => {
  it("advances frames and loops", () => {
    const clip = new SpriteFrameClip([
      { x: 0, y: 0, width: 1, height: 1, duration: 0.1 },
      { x: 1, y: 0, width: 1, height: 1, duration: 0.1 },
    ]);
    const player = new AnimationPlayer().play(clip, true);
    expect(player.update(0.11)?.x).toBe(1);
    expect(player.update(0.11)?.x).toBe(0);
  });

  it("writes sampled frames through a binding", () => {
    const sprite = { frame: { x: 0, y: 0, width: 1, height: 1 } } as never;
    const player = new AnimationPlayer().play(
      new SpriteFrameClip([{ x: 2, y: 0, width: 1, height: 1 }]),
      true,
    );
    new SpriteAnimationBinding(sprite, player).update(0.01);
    expect((sprite as { frame: { x: number } }).frame.x).toBe(2);
  });
});
