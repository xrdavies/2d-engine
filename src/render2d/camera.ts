import type { Vector2 } from "../world/transform2d.ts";

export interface Camera2DOptions {
  position?: Partial<Vector2>;
  zoom?: number;
  viewportWidth?: number;
  viewportHeight?: number;
}

export class Camera2D {
  position: Vector2;
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;

  constructor(options: Camera2DOptions = {}) {
    this.position = {
      x: options.position?.x ?? 0,
      y: options.position?.y ?? 0,
    };
    this.zoom = options.zoom ?? 1;
    this.viewportWidth = options.viewportWidth ?? 1;
    this.viewportHeight = options.viewportHeight ?? 1;
  }

  setViewport(width: number, height: number): this {
    if (width <= 0 || height <= 0) {
      throw new RangeError("Camera viewport must be positive");
    }
    this.viewportWidth = width;
    this.viewportHeight = height;
    return this;
  }

  setZoom(zoom: number): this {
    if (!(zoom > 0) || !Number.isFinite(zoom)) {
      throw new RangeError("Camera zoom must be a finite positive number");
    }
    this.zoom = zoom;
    return this;
  }

  worldToScreen(point: Vector2): Vector2 {
    return {
      x: (point.x - this.position.x) * this.zoom + this.viewportWidth / 2,
      y: (point.y - this.position.y) * this.zoom + this.viewportHeight / 2,
    };
  }

  screenToWorld(point: Vector2): Vector2 {
    return {
      x: (point.x - this.viewportWidth / 2) / this.zoom + this.position.x,
      y: (point.y - this.viewportHeight / 2) / this.zoom + this.position.y,
    };
  }

  visibleWorldBounds(): {
    left: number;
    top: number;
    right: number;
    bottom: number;
  } {
    const halfWidth = this.viewportWidth / (2 * this.zoom);
    const halfHeight = this.viewportHeight / (2 * this.zoom);
    return {
      left: this.position.x - halfWidth,
      top: this.position.y - halfHeight,
      right: this.position.x + halfWidth,
      bottom: this.position.y + halfHeight,
    };
  }
}
