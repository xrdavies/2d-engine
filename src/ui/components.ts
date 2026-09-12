import type { TextureRegion, TextureSource } from "../render2d/index.ts";

export interface UIRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UIRenderer {
  label(node: UILabel): void;
  image(node: UIImage): void;
  button(node: UIButton): void;
}

export type UIClickHandler = (button: UIButton) => void;

/** Renderer-agnostic retained UI node. Children use absolute viewport rects. */
export class UINode {
  parent: UINode | null = null;
  readonly children: UINode[] = [];
  visible = true;

  constructor(
    readonly id: string,
    public rect: UIRect,
    public layer = 0,
  ) {}

  add<T extends UINode>(child: T): T {
    child.parent?.remove(child);
    child.parent = this;
    this.children.push(child);
    return child;
  }

  remove(child: UINode): boolean {
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

  render(renderer: UIRenderer): void {
    if (!this.visible) return;
    this.draw(renderer);
    for (const child of this.children) child.render(renderer);
  }

  protected draw(_renderer: UIRenderer): void {}
}

export class UIContainer extends UINode {}

export class UILabel extends UINode {
  constructor(
    id: string,
    rect: UIRect,
    public text: string,
    public font = "14px sans-serif",
    public color = "#f4efe4",
    layer = 0,
  ) {
    super(id, rect, layer);
  }

  protected override draw(renderer: UIRenderer): void {
    renderer.label(this);
  }
}

export class UIImage extends UINode {
  constructor(
    id: string,
    rect: UIRect,
    public texture: TextureSource,
    public uv: TextureRegion = { x: 0, y: 0, width: 1, height: 1 },
    layer = 0,
  ) {
    super(id, rect, layer);
  }

  protected override draw(renderer: UIRenderer): void {
    renderer.image(this);
  }
}

export class UIButton extends UINode {
  disabled = false;
  pressed = false;

  constructor(
    id: string,
    rect: UIRect,
    public text: string,
    public readonly onClick?: UIClickHandler,
    layer = 0,
  ) {
    super(id, rect, layer);
  }

  protected override draw(renderer: UIRenderer): void {
    renderer.button(this);
  }
}

export class UIRoot extends UIContainer {
  private active: UIButton | null = null;

  hitTest(x: number, y: number): UIButton | null {
    let best: UIButton | null = null;
    const visit = (node: UINode) => {
      if (!node.visible) return;
      for (const child of node.children) visit(child);
      if (
        node instanceof UIButton &&
        !node.disabled &&
        node.contains(x, y) &&
        (!best || node.layer >= best.layer)
      )
        best = node;
    };
    visit(this);
    return best;
  }

  pointerDown(x: number, y: number): UIButton | null {
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
