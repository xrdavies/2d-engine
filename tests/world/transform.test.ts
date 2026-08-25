import { describe, expect, it } from "vitest";
import {
  ComponentStore,
  EntityManager,
  Transform2D,
  World,
} from "../../src/world/index.ts";

describe("world", () => {
  it("keeps entity ids stable across destruction", () => {
    const entities = new EntityManager();
    const first = entities.create();
    const second = entities.create();

    expect(entities.isAlive(first)).toBe(true);
    expect(entities.destroy(first)).toBe(true);
    expect(entities.isAlive(first)).toBe(false);
    expect(entities.create()).toBeGreaterThan(second);
  });

  it("stores components by entity", () => {
    const store = new ComponentStore<{ value: number }>();
    store.set(4, { value: 2 });

    expect(store.get(4)?.value).toBe(2);
    expect(store.delete(4)).toBe(true);
    expect(store.has(4)).toBe(false);
  });

  it("updates parent and child world transforms and propagates dirtiness", () => {
    const parent = new Transform2D({ position: { x: 10, y: 20 } });
    const child = new Transform2D({ position: { x: 3, y: 4 } });
    parent.addChild(child);

    expect(child.worldPosition).toEqual({ x: 13, y: 24 });
    expect(child.dirty).toBe(false);
    parent.setPosition(20, 30);

    expect(child.dirty).toBe(true);
    expect(child.worldPosition).toEqual({ x: 23, y: 34 });
    expect(child.dirty).toBe(false);
  });

  it("removes all components with a destroyed world entity", () => {
    const world = new World();
    const entity = world.createEntity();
    world.addTransform(entity);

    expect(world.destroyEntity(entity)).toBe(true);
    expect(world.getTransform(entity)).toBeUndefined();
    expect(world.isAlive(entity)).toBe(false);
  });

  it("extracts only live render items", () => {
    const world = new World();
    const first = world.createEntity();
    const second = world.createEntity();
    world.addTransform(first);
    world.addTransform(second);

    expect(world.extractRenderItems((entity) => entity)).toEqual([
      first,
      second,
    ]);
    world.destroyEntity(first);
    expect(world.extractRenderItems((entity) => entity)).toEqual([second]);
  });

  it("interpolates transform state between fixed steps", () => {
    const world = new World();
    const entity = world.createEntity();
    const transform = world.addTransform(
      entity,
      new Transform2D({ position: { x: 0, y: 0 } }),
    );
    world.beginFixedStep();
    transform.setPosition(10, 20);
    const positions = world.extractInterpolatedRenderItems(
      0.5,
      (_id, value, alpha) => value.interpolatedPosition(alpha),
    );
    expect(positions).toEqual([{ x: 5, y: 10 }]);
  });
});
