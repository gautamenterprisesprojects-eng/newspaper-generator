import type { Point, Size } from "@/types/editor";

export const GRID_SIZE = 9;
export const GUIDE_GUTTER = 9;

export const snapValue = (value: number, gridSize = GRID_SIZE) =>
  Math.round(value / gridSize) * gridSize;

export const snapPoint = (point: Point, gridSize = GRID_SIZE): Point => ({
  x: snapValue(point.x, gridSize),
  y: snapValue(point.y, gridSize),
});

export const snapSize = (size: Size, gridSize = GRID_SIZE): Size => ({
  width: snapValue(size.width, gridSize),
  height: snapValue(size.height, gridSize),
});

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
