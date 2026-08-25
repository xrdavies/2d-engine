import { ComponentStore } from "./component-store.ts";
import { type EntityId, EntityManager } from "./entity.ts";
import { Transform2D } from "./transform2d.ts";

export class World {
  readonly entities = new EntityManager();
  private readonly stores = new Set<ComponentStore<unknown>>();
  readonly transforms = this.createComponentStore<Transform2D>();

  createEntity(): EntityId {
    return this.entities.create();
  }

  destroyEntity(entity: EntityId): boolean {
    if (!this.entities.isAlive(entity)) {
      return false;
    }
    const transform = this.transforms.get(entity);
    if (transform) {
      transform.setParent(undefined);
      for (const child of transform.children) {
        child.setParent(undefined);
      }
    }
    for (const store of this.stores) {
      store.delete(entity);
    }
    return this.entities.destroy(entity);
  }

  isAlive(entity: EntityId): boolean {
    return this.entities.isAlive(entity);
  }

  createComponentStore<T>(): ComponentStore<T> {
    const store = new ComponentStore<T>();
    this.stores.add(store as ComponentStore<unknown>);
    return store;
  }

  addComponent<T>(entity: EntityId, store: ComponentStore<T>, component: T): T {
    this.assertAlive(entity);
    this.stores.add(store as ComponentStore<unknown>);
    store.set(entity, component);
    return component;
  }

  removeComponent<T>(entity: EntityId, store: ComponentStore<T>): boolean {
    return store.delete(entity);
  }

  addTransform(entity: EntityId, transform = new Transform2D()): Transform2D {
    return this.addComponent(entity, this.transforms, transform);
  }

  getTransform(entity: EntityId): Transform2D | undefined {
    return this.transforms.get(entity);
  }

  setParent(child: EntityId, parent: EntityId | null | undefined): void {
    const childTransform = this.transforms.require(child);
    const parentTransform =
      parent == null ? undefined : this.transforms.require(parent);
    childTransform.setParent(parentTransform);
  }

  updateTransforms(): void {
    for (const transform of this.transforms.values()) {
      transform.updateWorldMatrix();
    }
  }

  extractRenderItems<T>(
    extractor: (entity: EntityId, transform: Transform2D) => T | undefined,
  ): T[] {
    this.updateTransforms();
    const items: T[] = [];
    for (const [entity, transform] of this.transforms) {
      if (!this.entities.isAlive(entity)) continue;
      const item = extractor(entity, transform);
      if (item !== undefined) items.push(item);
    }
    return items;
  }

  clear(): void {
    for (const entity of [...this.entities.values()]) {
      this.destroyEntity(entity);
    }
  }

  private assertAlive(entity: EntityId): void {
    if (!this.entities.isAlive(entity)) {
      throw new Error(`Unknown entity ${entity}`);
    }
  }
}
