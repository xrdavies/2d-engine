export type EntityId = number;

/** Allocates stable numeric ids. Destroyed ids are not reused. */
export class EntityManager {
  private nextId = 1;
  private readonly alive = new Set<EntityId>();

  create(): EntityId {
    const entity = this.nextId;
    this.nextId += 1;
    this.alive.add(entity);
    return entity;
  }

  createEntity(): EntityId {
    return this.create();
  }

  destroy(entity: EntityId): boolean {
    return this.alive.delete(entity);
  }

  destroyEntity(entity: EntityId): boolean {
    return this.destroy(entity);
  }

  isAlive(entity: EntityId): boolean {
    return this.alive.has(entity);
  }

  get size(): number {
    return this.alive.size;
  }

  values(): IterableIterator<EntityId> {
    return this.alive.values();
  }

  clear(): void {
    this.alive.clear();
  }
}
