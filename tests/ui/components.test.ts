import { describe, expect, it, vi } from "vitest";
import {
  UIButton,
  UIContainer,
  type UIImage,
  UIInput,
  UILabel,
  UIRoot,
  UISlider,
} from "../../src/ui/index.ts";

describe("retained UI components", () => {
  it("renders labels and buttons through a renderer adapter", () => {
    const root = new UIRoot("root", { x: 0, y: 0, width: 100, height: 100 });
    const label = root.add(
      new UILabel("title", { x: 4, y: 4, width: 40, height: 20 }, "Ready"),
    );
    const click = vi.fn();
    const button = root.add(
      new UIButton(
        "ok",
        { x: 10, y: 30, width: 40, height: 20 },
        "OK",
        click,
        2,
      ),
    );
    root
      .add(new UIContainer("group", { x: 0, y: 0, width: 100, height: 100 }))
      .add(label);
    const seen: string[] = [];
    root.render({
      label: (node) => seen.push(`label:${node.text}`),
      image: () => {},
      button: (node) => seen.push(`button:${node.text}`),
      input: (node) => seen.push(`input:${node.value}`),
      slider: (node) => seen.push(`slider:${node.value}`),
    });
    expect(seen).toEqual(["button:OK", "label:Ready"]);
    expect(root.pointerDown(12, 32)).toBe(button);
    expect(button.pressed).toBe(true);
    expect(root.pointerUp(12, 32)).toBe(true);
    expect(click).toHaveBeenCalledWith(button);
  });

  it("renders and updates inputs and sliders", () => {
    const input = new UIInput(
      "name",
      { x: 0, y: 0, width: 100, height: 20 },
      "A",
    );
    const slider = new UISlider(
      "bet",
      { x: 10, y: 0, width: 80, height: 20 },
      1,
      9,
      1,
    );
    const seen: string[] = [];
    const renderer = {
      label: () => {},
      image: (_node: UIImage) => {},
      button: () => {},
      input: (node: UIInput) => seen.push(node.placeholder),
      slider: (node: UISlider) => seen.push(String(node.value)),
    };
    input.placeholder = "昵称";
    input.setValue("玩家");
    slider.setValue(slider.valueAt(50));
    input.render(renderer);
    slider.render(renderer);
    expect(seen).toEqual(["昵称", "5"]);
  });

  it("does not activate disabled or cancelled buttons", () => {
    const root = new UIRoot("root", { x: 0, y: 0, width: 100, height: 100 });
    const click = vi.fn();
    const button = root.add(
      new UIButton("ok", { x: 10, y: 10, width: 40, height: 20 }, "OK", click),
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
