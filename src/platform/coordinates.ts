export interface Point2D {
  x: number;
  y: number;
}

export interface InputCoordinates {
  screen: Point2D;
  viewport: Point2D;
  pixel: Point2D;
  world?: Point2D;
}

export type CoordinateMapper = (
  clientX: number,
  clientY: number,
) => InputCoordinates;

export interface CoordinateElement {
  width?: number;
  height?: number;
  getBoundingClientRect(): Pick<DOMRect, "left" | "top" | "width" | "height">;
}

export function createCoordinateMapper(
  element: CoordinateElement,
  toWorld?: (viewport: Point2D) => Point2D,
): CoordinateMapper {
  return (clientX, clientY) => {
    const rect = element.getBoundingClientRect();
    const viewport = { x: clientX - rect.left, y: clientY - rect.top };
    const scaleX =
      rect.width > 0 ? (element.width ?? rect.width) / rect.width : 0;
    const scaleY =
      rect.height > 0 ? (element.height ?? rect.height) / rect.height : 0;

    return {
      screen: { x: clientX, y: clientY },
      viewport,
      pixel: { x: viewport.x * scaleX, y: viewport.y * scaleY },
      world: toWorld?.(viewport),
    };
  };
}
