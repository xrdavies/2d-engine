export interface Aabb {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SpatialEntry<T> {
  value: T;
  bounds: Aabb;
}

export class UniformGrid<T> {
  private readonly cells = new Map<string, Set<T>>();
  private readonly entries = new Map<T, Aabb>();

  constructor(readonly cellSize = 128) {
    if (!(cellSize > 0))
      throw new RangeError("Spatial grid cell size must be positive");
  }

  set(value: T, bounds: Aabb): this {
    this.remove(value);
    this.entries.set(value, { ...bounds });
    for (const key of this.keysFor(bounds)) {
      const cell = this.cells.get(key) ?? new Set<T>();
      cell.add(value);
      this.cells.set(key, cell);
    }
    return this;
  }

  remove(value: T): boolean {
    const bounds = this.entries.get(value);
    if (!bounds) return false;
    this.entries.delete(value);
    for (const key of this.keysFor(bounds)) {
      const cell = this.cells.get(key);
      cell?.delete(value);
      if (cell?.size === 0) this.cells.delete(key);
    }
    return true;
  }

  update(value: T, bounds: Aabb): this {
    return this.set(value, bounds);
  }

  query(bounds: Aabb): T[] {
    const result = new Set<T>();
    for (const key of this.keysFor(bounds)) {
      for (const value of this.cells.get(key) ?? []) {
        const entry = this.entries.get(value);
        if (entry && intersects(entry, bounds)) result.add(value);
      }
    }
    return [...result];
  }

  queryPoint(x: number, y: number): T[] {
    return this.query({ left: x, top: y, right: x, bottom: y });
  }

  clear(): void {
    this.cells.clear();
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }

  private keysFor(bounds: Aabb): string[] {
    const minX = Math.floor(bounds.left / this.cellSize);
    const maxX = Math.floor(bounds.right / this.cellSize);
    const minY = Math.floor(bounds.top / this.cellSize);
    const maxY = Math.floor(bounds.bottom / this.cellSize);
    const keys: string[] = [];
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) keys.push(`${x}:${y}`);
    }
    return keys;
  }
}

function intersects(a: Aabb, b: Aabb): boolean {
  return (
    a.left <= b.right &&
    a.right >= b.left &&
    a.top <= b.bottom &&
    a.bottom >= b.top
  );
}
