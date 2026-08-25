import { AnimationPlayer, SpriteFrameClip } from "../../src/index.ts";

const status = document.querySelector<HTMLElement>("#status");
const frame = document.querySelector<HTMLElement>("#frame");
if (!status || !frame)
  throw new Error("Animation example markup is incomplete");
const clip = new SpriteFrameClip([
  { x: 0, y: 0, width: 0.25, height: 1, duration: 0.1 },
  { x: 0.25, y: 0, width: 0.25, height: 1, duration: 0.1 },
]);
const player = new AnimationPlayer().play(clip, true);
let last = performance.now();
const tick = (now: number): void => {
  const sampled = player.update((now - last) / 1000);
  last = now;
  status.textContent = "AnimationPlayer running";
  frame.textContent = JSON.stringify(sampled);
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
