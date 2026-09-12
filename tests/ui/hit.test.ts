import { describe, expect, it } from "vitest";
import { hitTest, rectContains } from "../../src/ui/hit.ts";

describe("hit testing", () => {
  it("hits the top-most enabled rect", () => {
    expect(rectContains({ x: 10, y: 10, width: 20, height: 8 }, 15, 12)).toBe(
      true,
    );
    expect(rectContains({ x: 10, y: 10, width: 20, height: 8 }, 9, 12)).toBe(
      false,
    );
    const rects = [
      { id: "back", x: 0, y: 0, width: 100, height: 100, layer: 0 },
      { id: "btn", x: 10, y: 10, width: 40, height: 20, layer: 2 },
      { id: "off", x: 10, y: 10, width: 40, height: 20, layer: 9, disabled: true },
    ];
    expect(hitTest(rects, 12, 12)?.id).toBe("btn");
    expect(hitTest(rects, 80, 80)?.id).toBe("back");
    expect(hitTest(rects, -1, 0)).toBeNull();
  });
});
