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
  input(node: UIInput): void;
  slider(node: UISlider): void;
}

export type UIClickHandler = (button: UIButton) => void;
export type UIInputHandler = (input: UIInput, value: string) => void;
export type UISliderHandler = (slider: UISlider, value: number) => void;

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

export class UIInput extends UINode {
  disabled = false;

  constructor(
    id: string,
    rect: UIRect,
    public value = "",
    public placeholder = "",
    public inputType = "text",
    public readonly onInput?: UIInputHandler,
    layer = 0,
  ) {
    super(id, rect, layer);
  }

  setValue(value: string): void {
    if (this.value === value) return;
    this.value = value;
    this.onInput?.(this, value);
  }

  protected override draw(renderer: UIRenderer): void {
    renderer.input(this);
  }
}

export class UISlider extends UINode {
  disabled = false;
  dragging = false;

  constructor(
    id: string,
    rect: UIRect,
    public readonly min: number,
    public readonly max: number,
    public value: number,
    public readonly onChange?: UISliderHandler,
    public readonly step = 1,
    layer = 0,
  ) {
    super(id, rect, layer);
    this.value = this.clamp(value);
  }

  valueAt(x: number): number {
    const t = Math.min(
      1,
      Math.max(0, (x - this.rect.x) / Math.max(1, this.rect.width)),
    );
    return this.clamp(this.min + t * (this.max - this.min));
  }

  setValue(value: number): void {
    const next = this.clamp(value);
    if (next === this.value) return;
    this.value = next;
    this.onChange?.(this, next);
  }

  private clamp(value: number): number {
    const bounded = Math.min(this.max, Math.max(this.min, value));
    if (!(this.step > 0)) return bounded;
    return Math.min(
      this.max,
      Math.max(
        this.min,
        this.min + Math.round((bounded - this.min) / this.step) * this.step,
      ),
    );
  }

  protected override draw(renderer: UIRenderer): void {
    renderer.slider(this);
  }
}

export class UIRoot extends UIContainer {
  private active: UIButton | UIInput | UISlider | null = null;

  hitTest(x: number, y: number): UIButton | UIInput | UISlider | null {
    let best: UIButton | UIInput | UISlider | null = null;
    const visit = (node: UINode) => {
      if (!node.visible) return;
      for (const child of node.children) visit(child);
      if (
        (node instanceof UIButton ||
          node instanceof UIInput ||
          node instanceof UISlider) &&
        !node.disabled &&
        node.contains(x, y) &&
        (!best || node.layer >= best.layer)
      )
        best = node;
    };
    visit(this);
    return best;
  }

  pointerDown(x: number, y: number): UIButton | UIInput | UISlider | null {
    const control = this.hitTest(x, y);
    this.active = control;
    if (control instanceof UIButton) control.pressed = true;
    if (control instanceof UISlider) {
      control.dragging = true;
      control.setValue(control.valueAt(x));
    }
    return control;
  }

  pointerMove(x: number, _y: number): boolean {
    if (!(this.active instanceof UISlider) || !this.active.dragging)
      return false;
    this.active.setValue(this.active.valueAt(x));
    return true;
  }

  pointerUp(x: number, y: number): boolean {
    const active = this.active;
    this.active = null;
    if (!active) return false;
    if (active instanceof UIButton) {
      active.pressed = false;
      if (active.disabled || !active.contains(x, y)) return false;
      active.onClick?.(active);
      return true;
    }
    if (active instanceof UISlider) {
      active.dragging = false;
      active.setValue(active.valueAt(x));
      return true;
    }
    return (
      active instanceof UIInput && !active.disabled && active.contains(x, y)
    );
  }

  pointerCancel(): void {
    if (this.active instanceof UIButton) this.active.pressed = false;
    if (this.active instanceof UISlider) this.active.dragging = false;
    this.active = null;
  }
}
