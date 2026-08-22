import { overlapLength, rectBottom, rectRight, roundLayoutValue } from "./LayoutGeometry";
import type { LayoutCluster } from "./LayoutCluster";
import type { LayoutRect } from "./LayoutTransactionTypes";

const verticalOverlapRatio = (first: LayoutRect, second: LayoutRect) => {
  const shared = overlapLength(first.x, rectRight(first), second.x, rectRight(second));

  return shared / Math.max(1, Math.min(first.width, second.width));
};

/**
 * Cascades frames vertically to remove floating gaps and overlaps.
 *
 * Frames are grouped by horizontal overlap and packed top-to-bottom. Immutable
 * cluster boundaries are respected by only operating on frames already inside
 * the cluster.
 */
export const applyVerticalCascade = ({
  cluster,
  rects,
  minimumGap = 0,
}: {
  cluster: LayoutCluster;
  rects: Record<string, LayoutRect>;
  minimumGap?: number;
}): Record<string, LayoutRect> => {
  const next = Object.fromEntries(Object.entries(rects).map(([id, rect]) => [id, { ...rect }]));
  const sorted = cluster.frameIds
    .map((frameId) => ({ frameId, rect: next[frameId] }))
    .filter((item): item is { frameId: string; rect: LayoutRect } => Boolean(item.rect))
    .sort((first, second) => first.rect.y - second.rect.y || first.rect.x - second.rect.x || first.frameId.localeCompare(second.frameId));

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const blockers = sorted.slice(0, index).filter((candidate) =>
      verticalOverlapRatio(candidate.rect, current.rect) > 0,
    );

    if (blockers.length === 0) {
      continue;
    }

    const requiredY = Math.max(...blockers.map((candidate) => rectBottom(candidate.rect) + minimumGap));

    if (current.rect.y !== requiredY) {
      current.rect = {
        ...current.rect,
        y: roundLayoutValue(requiredY),
      };
      next[current.frameId] = current.rect;
    }
  }

  return next;
};

/** Public facade for deterministic vertical cascade. */
export const VerticalCascade = {
  applyVerticalCascade,
};
