import type { LayoutRect } from "./LayoutTransactionTypes";

/** Rounds geometry to deterministic sub-point precision. */
export const roundLayoutValue = (value: number) => Math.round(value * 1000) / 1000;

/** Returns the right edge of a rectangle. */
export const rectRight = (rect: LayoutRect) => rect.x + rect.width;

/** Returns the bottom edge of a rectangle. */
export const rectBottom = (rect: LayoutRect) => rect.y + rect.height;

/** Returns non-negative rectangle area. */
export const rectArea = (rect: LayoutRect) => Math.max(0, rect.width) * Math.max(0, rect.height);

/** Returns true when two one-dimensional ranges overlap by a positive amount. */
export const rangesOverlap = (startA: number, endA: number, startB: number, endB: number) =>
  Math.max(startA, startB) < Math.min(endA, endB);

/** Returns the positive overlap length between two one-dimensional ranges. */
export const overlapLength = (startA: number, endA: number, startB: number, endB: number) =>
  Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));

/** Returns true when two rectangles overlap by a positive area. */
export const rectsOverlap = (first: LayoutRect, second: LayoutRect) =>
  rangesOverlap(first.x, rectRight(first), second.x, rectRight(second)) &&
  rangesOverlap(first.y, rectBottom(first), second.y, rectBottom(second));

/** Returns true when the inner rectangle is fully contained by the outer rectangle. */
export const rectContains = (outer: LayoutRect, inner: LayoutRect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  rectRight(inner) <= rectRight(outer) &&
  rectBottom(inner) <= rectBottom(outer);

/** Creates a stable geometry key for cache and snapshot version calculations. */
export const rectKey = (rect: LayoutRect) =>
  [rect.x, rect.y, rect.width, rect.height].map(roundLayoutValue).join(":");

/** Sorts rectangles in deterministic newspaper reading order. */
export const sortRectsReadingOrder = <Rect extends LayoutRect & { id: string }>(rects: Rect[]) =>
  [...rects].sort((first, second) => {
    if (first.y !== second.y) {
      return first.y - second.y;
    }

    if (first.x !== second.x) {
      return first.x - second.x;
    }

    return first.id.localeCompare(second.id);
  });
