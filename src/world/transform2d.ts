export interface Vector2 {
  x: number;
  y: number;
}

export type Matrix3 = Float32Array;

export interface Transform2DOptions {
  position?: Partial<Vector2>;
  rotation?: number;
  scale?: Partial<Vector2>;
  anchor?: Partial<Vector2>;
  pivot?: Partial<Vector2>;
}

const identity = (): Matrix3 => new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

const multiply = (left: Matrix3, right: Matrix3): Matrix3 => {
  const l0 = left[0] ?? 0;
  const l1 = left[1] ?? 0;
  const l3 = left[3] ?? 0;
  const l4 = left[4] ?? 0;
  const l6 = left[6] ?? 0;
  const l7 = left[7] ?? 0;
  const r0 = right[0] ?? 0;
  const r1 = right[1] ?? 0;
  const r3 = right[3] ?? 0;
  const r4 = right[4] ?? 0;
  const r6 = right[6] ?? 0;
  const r7 = right[7] ?? 0;
  return new Float32Array([
    l0 * r0 + l3 * r1,
    l1 * r0 + l4 * r1,
    0,
    l0 * r3 + l3 * r4,
    l1 * r3 + l4 * r4,
    0,
    l0 * r6 + l3 * r7 + l6,
    l1 * r6 + l4 * r7 + l7,
    1,
  ]);
};

const copyVector = (value: Vector2): Vector2 => ({ x: value.x, y: value.y });

/** A 2D affine transform with lazy world-matrix evaluation. */
export class Transform2D {
  private readonly _position: Vector2;
  private readonly _scale: Vector2;
  private readonly _anchor: Vector2;
  private _rotation: number;
  private _previousPosition: Vector2;
  private _previousScale: Vector2;
  private _previousRotation: number;
  private _parent: Transform2D | undefined;
  private readonly _children = new Set<Transform2D>();
  private _localMatrix = identity();
  private _worldMatrix = identity();
  private _worldPosition: Vector2 = { x: 0, y: 0 };
  private _worldScale: Vector2 = { x: 1, y: 1 };
  private _worldRotation = 0;
  private _dirty = true;
  private _worldVersion = 0;
  private _parentWorldVersion = -1;
  private snapshot: [number, number, number, number, number, number, number] = [
    0, 0, 0, 1, 1, 0, 0,
  ];

  constructor(options: Transform2DOptions = {}) {
    this._position = {
      x: options.position?.x ?? 0,
      y: options.position?.y ?? 0,
    };
    this._scale = {
      x: options.scale?.x ?? 1,
      y: options.scale?.y ?? 1,
    };
    const anchor = options.anchor ?? options.pivot;
    this._anchor = {
      x: anchor?.x ?? 0,
      y: anchor?.y ?? 0,
    };
    this._rotation = options.rotation ?? 0;
    this._previousPosition = copyVector(this._position);
    this._previousScale = copyVector(this._scale);
    this._previousRotation = this._rotation;
    this.captureSnapshot();
  }

  get position(): Vector2 {
    return this._position;
  }

  set position(value: Vector2) {
    this.setPosition(value.x, value.y);
  }

  get localPosition(): Vector2 {
    return this._position;
  }

  set localPosition(value: Vector2) {
    this.setPosition(value.x, value.y);
  }

  get rotation(): number {
    return this._rotation;
  }

  set rotation(value: number) {
    this.setRotation(value);
  }

  get localRotation(): number {
    return this._rotation;
  }

  set localRotation(value: number) {
    this.setRotation(value);
  }

  get scale(): Vector2 {
    return this._scale;
  }

  set scale(value: Vector2) {
    this.setScale(value.x, value.y);
  }

  get localScale(): Vector2 {
    return this._scale;
  }

  set localScale(value: Vector2) {
    this.setScale(value.x, value.y);
  }

  get anchor(): Vector2 {
    return this._anchor;
  }

  set anchor(value: Vector2) {
    this.setAnchor(value.x, value.y);
  }

  get pivot(): Vector2 {
    return this._anchor;
  }

  set pivot(value: Vector2) {
    this.setAnchor(value.x, value.y);
  }

  get parent(): Transform2D | undefined {
    return this._parent;
  }

  set parent(value: Transform2D | null | undefined) {
    this.setParent(value);
  }

  get children(): ReadonlySet<Transform2D> {
    return this._children;
  }

  get dirty(): boolean {
    this.synchronizeLocalChanges();
    if (this._parent?.dirty) {
      this._dirty = true;
    }
    return this._dirty;
  }

  get isDirty(): boolean {
    return this.dirty;
  }

  setPosition(x: number, y: number): this {
    this._position.x = x;
    this._position.y = y;
    this.markDirty();
    return this;
  }

  capturePrevious(): this {
    this._previousPosition = copyVector(this._position);
    this._previousScale = copyVector(this._scale);
    this._previousRotation = this._rotation;
    return this;
  }

  interpolatedPosition(alpha: number): Vector2 {
    const amount = Math.max(0, Math.min(1, alpha));
    return {
      x:
        this._previousPosition.x +
        (this._position.x - this._previousPosition.x) * amount,
      y:
        this._previousPosition.y +
        (this._position.y - this._previousPosition.y) * amount,
    };
  }

  interpolatedScale(alpha: number): Vector2 {
    const amount = Math.max(0, Math.min(1, alpha));
    return {
      x:
        this._previousScale.x +
        (this._scale.x - this._previousScale.x) * amount,
      y:
        this._previousScale.y +
        (this._scale.y - this._previousScale.y) * amount,
    };
  }

  interpolatedRotation(alpha: number): number {
    const amount = Math.max(0, Math.min(1, alpha));
    return (
      this._previousRotation +
      (this._rotation - this._previousRotation) * amount
    );
  }

  setLocalPosition(x: number, y: number): this {
    return this.setPosition(x, y);
  }

  setRotation(rotation: number): this {
    this._rotation = rotation;
    this.markDirty();
    return this;
  }

  setLocalRotation(rotation: number): this {
    return this.setRotation(rotation);
  }

  setScale(x: number, y: number): this {
    this._scale.x = x;
    this._scale.y = y;
    this.markDirty();
    return this;
  }

  setLocalScale(x: number, y: number): this {
    return this.setScale(x, y);
  }

  setAnchor(x: number, y: number): this {
    this._anchor.x = x;
    this._anchor.y = y;
    this.markDirty();
    return this;
  }

  setPivot(x: number, y: number): this {
    return this.setAnchor(x, y);
  }

  setParent(parent: Transform2D | null | undefined): this {
    const nextParent = parent ?? undefined;
    if (nextParent === this._parent) {
      return this;
    }
    for (let ancestor = nextParent; ancestor; ancestor = ancestor._parent) {
      if (ancestor === this) {
        throw new Error("Transform parent cycle");
      }
    }
    this._parent?._children.delete(this);
    this._parent = nextParent;
    nextParent?._children.add(this);
    this.markDirty();
    return this;
  }

  addChild(child: Transform2D): this {
    child.setParent(this);
    return this;
  }

  removeChild(child: Transform2D): boolean {
    if (child._parent !== this) {
      return false;
    }
    child.setParent(undefined);
    return true;
  }

  get localMatrix(): Matrix3 {
    this.updateWorldMatrix();
    return this._localMatrix;
  }

  get worldMatrix(): Matrix3 {
    this.updateWorldMatrix();
    return this._worldMatrix;
  }

  getLocalMatrix(): Matrix3 {
    return this.localMatrix;
  }

  getWorldMatrix(): Matrix3 {
    return this.worldMatrix;
  }

  get worldPosition(): Vector2 {
    this.updateWorldMatrix();
    return copyVector(this._worldPosition);
  }

  get worldRotation(): number {
    this.updateWorldMatrix();
    return this._worldRotation;
  }

  get worldScale(): Vector2 {
    this.updateWorldMatrix();
    return copyVector(this._worldScale);
  }

  updateWorldMatrix(): this {
    this.synchronizeLocalChanges();
    if (this._parent) {
      this._parent.updateWorldMatrix();
      if (this._parentWorldVersion !== this._parent._worldVersion) {
        this._dirty = true;
      }
    }
    if (!this._dirty) {
      return this;
    }

    const { x: sx, y: sy } = this._scale;
    const cos = Math.cos(this._rotation);
    const sin = Math.sin(this._rotation);
    const a = cos * sx;
    const b = sin * sx;
    const c = -sin * sy;
    const d = cos * sy;
    const tx = this._position.x - a * this._anchor.x - c * this._anchor.y;
    const ty = this._position.y - b * this._anchor.x - d * this._anchor.y;

    this._localMatrix = new Float32Array([a, b, 0, c, d, 0, tx, ty, 1]);
    this._worldMatrix = this._parent
      ? multiply(this._parent._worldMatrix, this._localMatrix)
      : this._localMatrix;
    this._worldPosition = {
      x: this._worldMatrix[6] ?? 0,
      y: this._worldMatrix[7] ?? 0,
    };
    this._worldRotation = this._parent
      ? this._parent._worldRotation + this._rotation
      : this._rotation;
    this._worldScale = this._parent
      ? {
          x: this._parent._worldScale.x * sx,
          y: this._parent._worldScale.y * sy,
        }
      : { x: sx, y: sy };
    this._dirty = false;
    this.captureSnapshot();
    this._parentWorldVersion = this._parent?._worldVersion ?? -1;
    this._worldVersion += 1;
    return this;
  }

  updateWorldTransform(): this {
    return this.updateWorldMatrix();
  }

  markDirty(): this {
    this._dirty = true;
    for (const child of this._children) {
      child.markDirty();
    }
    return this;
  }

  private synchronizeLocalChanges(): void {
    const current: [number, number, number, number, number, number, number] = [
      this._position.x,
      this._position.y,
      this._rotation,
      this._scale.x,
      this._scale.y,
      this._anchor.x,
      this._anchor.y,
    ];
    for (let index = 0; index < current.length; index += 1) {
      if (current[index] !== this.snapshot[index]) {
        this.markDirty();
        break;
      }
    }
  }

  private captureSnapshot(): void {
    this.snapshot = [
      this._position.x,
      this._position.y,
      this._rotation,
      this._scale.x,
      this._scale.y,
      this._anchor.x,
      this._anchor.y,
    ];
  }
}
