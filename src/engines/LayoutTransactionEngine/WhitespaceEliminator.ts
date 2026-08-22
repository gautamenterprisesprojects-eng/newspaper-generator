import { overlapLength, rectBottom, rectRight, roundLayoutValue } from "./LayoutGeometry";
import type { LayoutCluster } from "./LayoutCluster";
import type { LayoutRect } from "./LayoutTransactionTypes";

export type WhitespaceEliminationResult = {
  rects: Record<string, LayoutRect>;
  iterationCount: number;
  eliminatedArea: number;
  warnings: string[];
};

const MIN_GAP = 0.001;

const cloneRects = (rects: Record<string, LayoutRect>) =>
  Object.fromEntries(Object.entries(rects).map(([id, rect]) => [id, { ...rect }]));

const horizontalOverlapRatio = (first: LayoutRect, second: LayoutRect) => {
  const shared = overlapLength(first.x, rectRight(first), second.x, rectRight(second));

  return shared / Math.max(1, Math.min(first.width, second.width));
};

const getNearestBelow = (
  frameId: string,
  rects: Record<string, LayoutRect>,
  candidates: string[],
) => {
  const source = rects[frameId];

  return candidates
    .filter((candidateId) => candidateId !== frameId)
    .map((candidateId) => ({
      frameId: candidateId,
      rect: rects[candidateId],
    }))
    .filter((candidate) =>
      candidate.rect &&
      candidate.rect.y >= rectBottom(source) &&
      horizontalOverlapRatio(source, candidate.rect) > 0,
    )
    .sort((first, second) =>
      first.rect.y - second.rect.y ||
      first.rect.x - second.rect.x ||
      first.frameId.localeCompare(second.frameId),
    )[0];
};

/**
 * Eliminates vertical whitespace by expanding the nearest story above each gap.
 *
 * This pass is deterministic and immutable. It models recomposition pressure by
 * expanding geometry only; actual typography recomposition remains downstream.
 */
export const eliminateWhitespace = ({
  cluster,
  rects,
  maxIterations = 8,
}: {
  cluster: LayoutCluster;
  rects: Record<string, LayoutRect>;
  maxIterations?: number;
}): WhitespaceEliminationResult => {
  let next = cloneRects(rects);
  let eliminatedArea = 0;
  let iterationCount = 0;
  const warnings: string[] = [];

  for (; iterationCount < maxIterations; iterationCount += 1) {
    let changed = false;
    const orderedIds = [...cluster.frameIds].sort((first, second) =>
      next[first].y - next[second].y ||
      next[first].x - next[second].x ||
      first.localeCompare(second),
    );

    for (const frameId of orderedIds) {
      const frame = next[frameId];
      const below = getNearestBelow(frameId, next, orderedIds);

      if (!below) {
        continue;
      }

      const gap = below.rect.y - rectBottom(frame);

      if (gap <= MIN_GAP) {
        continue;
      }

      const shared = overlapLength(frame.x, rectRight(frame), below.rect.x, rectRight(below.rect));
      next = {
        ...next,
        [frameId]: {
          ...frame,
          height: roundLayoutValue(frame.height + gap),
        },
      };
      eliminatedArea += gap * shared;
      changed = true;
    }

    if (!changed) {
      return {
        rects: next,
        iterationCount,
        eliminatedArea: roundLayoutValue(eliminatedArea),
        warnings,
      };
    }
  }

  warnings.push(`Whitespace elimination reached iteration cap ${maxIterations}.`);

  return {
    rects: next,
    iterationCount: maxIterations,
    eliminatedArea: roundLayoutValue(eliminatedArea),
    warnings,
  };
};

/** Public facade for deterministic whitespace elimination. */
export const WhitespaceEliminator = {
  eliminateWhitespace,
};
