import { afterEach, describe, expect, it, vi } from "vitest";
import { Camera2D } from "../../src/render2d/index.ts";
import { UIBridge } from "../../src/ui-bridge/index.ts";

function elements(rect: {
  left: number;
  top: number;
  width: number;
  height: number;
}) {
  const captures = new Set<number>();
  const root = {
    dataset: {},
    parentElement: {},
    style: { pointerEvents: "" },
    focus: vi.fn(),
    appendChild: vi.fn(),
  } as unknown as HTMLElement;
  const canvas = {
    width: 1600,
    height: 1200,
    getBoundingClientRect: () => rect,
    setPointerCapture: (pointerId: number) => captures.add(pointerId),
    hasPointerCapture: (pointerId: number) => captures.has(pointerId),
    releasePointerCapture: (pointerId: number) => captures.delete(pointerId),
    setAttribute: vi.fn(),
  } as unknown as HTMLCanvasElement;
  return { canvas, root };
}

describe("UIBridge", () => {
  it("maps DOM coordinates through the camera viewport and zoom", () => {
    const { canvas, root } = elements({
      left: 10,
      top: 20,
      width: 400,
      height: 300,
    });
    const camera = new Camera2D({
      position: { x: 100, y: 200 },
      zoom: 2,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    const bridge = new UIBridge(canvas, root, camera);

    expect(bridge.coordinates(260, 195)).toEqual({
      screen: { x: 260, y: 195 },
      viewport: { x: 250, y: 175 },
      pixel: { x: 1000, y: 700 },
      world: { x: 150, y: 225 },
    });
    expect(bridge.worldToScreen({ x: 150, y: 225 })).toEqual({
      x: 260,
      y: 195,
    });
  });

  it("resyncs DOM size and preserves input capture", () => {
    let resize: (() => void) | undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const rect = { left: 10, top: 20, width: 400, height: 300 };
    const { canvas, root } = elements(rect);
    const bridge = new UIBridge(canvas, root);

    expect(root.style).toMatchObject({
      left: "10px",
      top: "20px",
      width: "400px",
      height: "300px",
    });

    Object.assign(rect, { left: 30, top: 40, width: 640, height: 360 });
    resize?.();
    bridge.setInputCaptured(true);

    expect(root.style).toMatchObject({
      left: "30px",
      top: "40px",
      width: "640px",
      height: "360px",
      pointerEvents: "auto",
    });
    expect(bridge.inputCaptured).toBe(true);

    bridge.setInputCaptured(false);
    expect(root.style.pointerEvents).toBe("none");
    expect(bridge.inputCaptured).toBe(false);

    bridge.focus(root);
    expect(root.focus).toHaveBeenCalledOnce();
    bridge.capturePointer(7);
    expect(canvas.hasPointerCapture(7)).toBe(true);
    bridge.releasePointer(7);
    expect(canvas.hasPointerCapture(7)).toBe(false);
  });

  it("mirrors canvas controls as keyboard-accessible DOM controls", () => {
    type FakeControl = {
      tagName: string;
      dataset: Record<string, string>;
      style: Record<string, string>;
      setAttribute(name: string, value: string): void;
      removeAttribute(name: string): void;
      getAttribute(name: string): string | null;
      remove: ReturnType<typeof vi.fn>;
      onclick?: () => void;
      oninput?: () => void;
      valueAsNumber?: number;
    };
    const made: FakeControl[] = [];
    vi.stubGlobal("document", {
      createElement: (tagName: string) => {
        const attributes = new Map<string, string>();
        const element: FakeControl = {
          tagName: tagName.toUpperCase(),
          dataset: {},
          style: {},
          setAttribute: (name: string, value: string) =>
            attributes.set(name, value),
          removeAttribute: (name: string) => attributes.delete(name),
          getAttribute: (name: string) => attributes.get(name) ?? null,
          remove: vi.fn(),
        };
        made.push(element);
        return element as unknown as HTMLElement;
      },
    });
    const { canvas, root } = elements({
      left: 0,
      top: 0,
      width: 400,
      height: 300,
    });
    const activate = vi.fn();
    const bridge = new UIBridge(canvas, root);

    bridge.syncControls(
      [
        {
          kind: "slider",
          id: "bet",
          label: "下注额",
          rect: { x: 100, y: 24, width: 120, height: 32 },
          min: 2,
          max: 200,
          value: 20,
        },
        {
          kind: "button",
          id: "deal",
          label: "发牌",
          rect: { x: 10, y: 20, width: 80, height: 40 },
        },
      ],
      activate,
    );

    expect(root.appendChild).toHaveBeenCalledTimes(2);
    const [button, slider] = made;
    if (!button || !slider) throw new Error("controls were not created");
    expect(button.getAttribute("aria-label")).toBe("发牌");
    expect(button.style).toMatchObject({
      left: "10px",
      top: "20px",
      width: "80px",
      height: "40px",
    });
    button.onclick?.();
    expect(activate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "deal" }),
    );
    slider.valueAsNumber = 42;
    slider.oninput?.();
    expect(activate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "bet" }),
      42,
    );

    bridge.syncControls([], activate);
    expect(
      made.every((element) => element.remove.mock.calls.length === 1),
    ).toBe(true);
  });
});

afterEach(() => vi.unstubAllGlobals());
