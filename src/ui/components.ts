import type { TextureRegion, TextureSource } from "../render2d/index.ts";

export interface UiRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UiRenderer {
  label(node: UiLabel): void;
  image(node: UiImage): void;
  button(node: UiButton): void;
}

export type UiClickHandler = (button: UiButton) => void;

/** Renderer-agnostic retained UI node. Children use absolute viewport rects. */
export class UiNode {
  parent: UiNode | null = null;
  readonly children: UiNode[] = [];
  visible = true;

  constructor(
    readonly id: string,
    public rect: UiRect,
    public layer = 0,
  ) {}

  add<T extends UiNode>(child: T): T {
    child.parent?.remove(child);
    child.parent = this;
    this.children.push(child);
    return child;
  }

  remove(child: UiNode): boolean {
    const index = this.children.indexOf(child);
    if (index < 0) return false;
    this.children.splice(index, 1);
    child.parent = null;
    return true;
  }

  contains(x: number, y: number): boolean {
    const { rect } = this;
    return (
      x >= rect.x &&
      y >= rect.y &&
      x < rect.x + rect.width &&
      y < rect.y + rect.height
    );
  }

  render(renderer: UiRenderer): void {
    if (!this.visible) return;
    this.draw(renderer);
    for (const child of this.children) child.render(renderer);
  }

  protected draw(_renderer: UiRenderer): void {}
}

export class UiContainer extends UiNode {}

export class UiLabel extends UiNode {
  constructor(
    id: string,
    rect: UiRect,
    public text: string,
    public font = "14px sans-serif",
    public color = "#f4efe4",
    layer = 0,
  ) {
    super(id, rect, layer);
  }

  protected override draw(renderer: UiRenderer): void {
    renderer.label(this);
  }
}

export class UiImage extends UiNode {
  constructor(
    id: string,
    rect: UiRect,
    public texture: TextureSource,
    public uv: TextureRegion = { x: 0, y: 0, width: 1, height: 1 },
    layer = 0,
  ) {
    super(id, rect, layer);
  }

  protected override draw(renderer: UiRenderer): void {
    renderer.image(this);
  }
}

export class UiButton extends UiNode {
  disabled = false;
  pressed = false;

  constructor(
    id: string,
    rect: UiRect,
    public text: string,
    public readonly onClick?: UiClickHandler,
    layer = 0,
  ) {
    super(id, rect, layer);
  }

  protected override draw(renderer: UiRenderer): void {
    renderer.button(this);
  }
}

export class UiRoot extends UiContainer {
  private active: UiButton | null = null;

  hitTest(x: number, y: number): UiButton | null {
    let best: UiButton | null = null;
    const visit = (node: UiNode) => {
      if (!node.visible) return;
      for (const child of node.children) visit(child);
      if (
        node instanceof UiButton &&
        !node.disabled &&
        node.contains(x, y) &&
        (!best || node.layer >= best.layer)
      )
        best = node;
    };
    visit(this);
    return best;
  }

  pointerDown(x: number, y: number): UiButton | null {
    this.active = this.hitTest(x, y);
    if (this.active) this.active.pressed = true;
    return this.active;
  }

  pointerUp(x: number, y: number): boolean {
    const active = this.active;
    this.active = null;
    if (!active) return false;
    active.pressed = false;
    if (active.disabled || !active.contains(x, y)) return false;
    active.onClick?.(active);
    return true;
  }

  pointerCancel(): void {
    if (this.active) this.active.pressed = false;
    this.active = null;
  }
}
