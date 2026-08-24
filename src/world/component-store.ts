import type { EntityId } from "./entity.ts";

export class ComponentStore<T> {
  private readonly components = new Map<EntityId, T>();

  set(entity: EntityId, component: T): this {
    this.components.set(entity, component);
    return this;
  }

  add(entity: EntityId, component: T): this {
    return this.set(entity, component);
  }

  get(entity: EntityId): T | undefined {
    return this.components.get(entity);
  }

  require(entity: EntityId): T {
    const component = this.get(entity);
    if (component === undefined) {
      throw new Error(`Component not found for entity ${entity}`);
    }
    return component;
  }

  has(entity: EntityId): boolean {
    return this.components.has(entity);
  }

  delete(entity: EntityId): boolean {
    return this.components.delete(entity);
  }

  remove(entity: EntityId): boolean {
    return this.delete(entity);
  }

  clear(): void {
    this.components.clear();
  }

  get size(): number {
    return this.components.size;
  }

  entries(): IterableIterator<[EntityId, T]> {
    return this.components.entries();
  }

  keys(): IterableIterator<EntityId> {
    return this.components.keys();
  }

  values(): IterableIterator<T> {
    return this.components.values();
  }

  [Symbol.iterator](): IterableIterator<[EntityId, T]> {
    return this.entries();
  }
}
