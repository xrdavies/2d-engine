import { describe, expect, it, vi } from "vitest";
import { UiButton, UiContainer, UiLabel, UiRoot } from "../../src/ui/index.ts";

describe("retained UI components", () => {
  it("renders labels and buttons through a renderer adapter", () => {
    const root = new UiRoot("root", { x: 0, y: 0, width: 100, height: 100 });
    const label = root.add(
      new UiLabel("title", { x: 4, y: 4, width: 40, height: 20 }, "Ready"),
    );
    const click = vi.fn();
    const button = root.add(
      new UiButton(
        "ok",
        { x: 10, y: 30, width: 40, height: 20 },
        "OK",
        click,
        2,
      ),
    );
    root
      .add(new UiContainer("group", { x: 0, y: 0, width: 100, height: 100 }))
      .add(label);
    const seen: string[] = [];
    root.render({
      label: (node) => seen.push(`label:${node.text}`),
      image: () => {},
      button: (node) => seen.push(`button:${node.text}`),
    });
    expect(seen).toEqual(["button:OK", "label:Ready"]);
    expect(root.pointerDown(12, 32)).toBe(button);
    expect(button.pressed).toBe(true);
    expect(root.pointerUp(12, 32)).toBe(true);
    expect(click).toHaveBeenCalledWith(button);
  });

  it("does not activate disabled or cancelled buttons", () => {
    const root = new UiRoot("root", { x: 0, y: 0, width: 100, height: 100 });
    const click = vi.fn();
    const button = root.add(
      new UiButton("ok", { x: 10, y: 10, width: 40, height: 20 }, "OK", click),
    );
    button.disabled = true;
    expect(root.pointerDown(12, 12)).toBeNull();
    button.disabled = false;
    root.pointerDown(12, 12);
    root.pointerCancel();
    expect(root.pointerUp(12, 12)).toBe(false);
    expect(click).not.toHaveBeenCalled();
  });
});
