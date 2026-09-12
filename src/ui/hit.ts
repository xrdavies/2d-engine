export interface HitRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  layer?: number;
  disabled?: boolean;
}

export function rectContains(
  rect: Pick<HitRect, "x" | "y" | "width" | "height">,
  x: number,
  y: number,
): boolean {
  return (
    x >= rect.x &&
    y >= rect.y &&
    x < rect.x + rect.width &&
    y < rect.y + rect.height
  );
}

/** Top-most enabled rect at (x, y). Higher `layer` wins; later entries break ties. */
export function hitTest(
  rects: readonly HitRect[],
  x: number,
  y: number,
): HitRect | null {
  let best: HitRect | null = null;
  let bestLayer = -Infinity;
  for (const rect of rects) {
    if (rect.disabled || rect.width <= 0 || rect.height <= 0) continue;
    if (!rectContains(rect, x, y)) continue;
    const layer = rect.layer ?? 0;
    if (!best || layer >= bestLayer) {
      best = rect;
      bestLayer = layer;
    }
  }
  return best;
}
