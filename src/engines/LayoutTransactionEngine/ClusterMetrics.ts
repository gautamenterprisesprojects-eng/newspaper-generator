import { rectArea, rectBottom, rectRight } from "./LayoutGeometry";
import type { LayoutCluster } from "./LayoutCluster";
import type { LayoutFrameSnapshot, LayoutRect, LayoutWhitespaceCell } from "./LayoutTransactionTypes";

/** Returns the bounding rectangle for a deterministic frame set. */
export const getClusterBounds = (frames: LayoutFrameSnapshot[]): LayoutRect => {
  if (frames.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const left = Math.min(...frames.map((frame) => frame.x));
  const top = Math.min(...frames.map((frame) => frame.y));
  const right = Math.max(...frames.map(rectRight));
  const bottom = Math.max(...frames.map(rectBottom));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
};

/** Returns total whitespace area for metrics and stable tests. */
export const getWhitespaceArea = (cells: LayoutWhitespaceCell[]) =>
  cells.reduce((sum, cell) => sum + rectArea(cell), 0);

/** Returns cluster whitespace bounded by at least one frame in the cluster. */
export const getClusterWhitespace = (
  clusterFrameIds: string[],
  whitespace: LayoutWhitespaceCell[],
) => {
  const ids = new Set(clusterFrameIds);

  return whitespace
    .filter((cell) => cell.boundedBy.some((frameId) => ids.has(frameId)))
    .map((cell) => ({ ...cell, boundedBy: [...cell.boundedBy] }))
    .sort((first, second) => first.y - second.y || first.x - second.x || first.id.localeCompare(second.id));
};

/** Builds immutable before-geometry lookup for a cluster. */
export const getClusterBeforeRects = (cluster: LayoutCluster): Record<string, LayoutRect> =>
  Object.fromEntries(
    cluster.frames.map((frame) => [
      frame.id,
      { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
    ]),
  );

/** Returns sorted ids whose before/after geometry differs. */
export const getChangedFrameIds = (
  before: Record<string, LayoutRect>,
  after: Record<string, LayoutRect>,
) =>
  Object.keys(before)
    .filter((frameId) => {
      const first = before[frameId];
      const second = after[frameId];

      return Boolean(second) &&
        (first.x !== second.x ||
          first.y !== second.y ||
          first.width !== second.width ||
          first.height !== second.height);
    })
    .sort();
