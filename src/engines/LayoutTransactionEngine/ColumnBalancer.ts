import { overlapLength, rectRight, roundLayoutValue } from "./LayoutGeometry";
import type { LayoutCluster } from "./LayoutCluster";
import type { LayoutColumn, LayoutRect } from "./LayoutTransactionTypes";

const getDominantColumn = (rect: LayoutRect, columns: LayoutColumn[]) =>
  [...columns]
    .map((column) => ({
      column,
      overlap: overlapLength(rect.x, rectRight(rect), column.x, rectRight(column)),
    }))
    .sort((first, second) => second.overlap - first.overlap || first.column.index - second.column.index)[0]?.column;

/**
 * Snaps cluster frames back onto their dominant columns.
 *
 * The pass preserves vertical decisions from RegionFlowSolver while
 * deterministically restoring column x/width alignment where a dominant column
 * exists.
 */
export const balanceColumns = ({
  cluster,
  columns,
  rects,
}: {
  cluster: LayoutCluster;
  columns: LayoutColumn[];
  rects: Record<string, LayoutRect>;
}): Record<string, LayoutRect> => {
  if (columns.length === 0) {
    return Object.fromEntries(Object.entries(rects).map(([id, rect]) => [id, { ...rect }]));
  }

  const next = Object.fromEntries(Object.entries(rects).map(([id, rect]) => [id, { ...rect }]));

  for (const frameId of cluster.frameIds) {
    const frame = cluster.frames.find((item) => item.id === frameId);
    const rect = next[frameId];

    if (!frame || !rect) {
      continue;
    }

    const span = frame.columnSpan ?? 1;
    const start = frame.columnStart;

    if (start && span > 0) {
      const spanColumns = columns.filter((column) => column.index >= start && column.index < start + span);

      if (spanColumns.length > 0) {
        const left = Math.min(...spanColumns.map((column) => column.x));
        const right = Math.max(...spanColumns.map(rectRight));

        next[frameId] = {
          ...rect,
          x: roundLayoutValue(left),
          width: roundLayoutValue(right - left),
        };
        continue;
      }
    }

    const dominant = getDominantColumn(rect, columns);

    if (dominant) {
      next[frameId] = {
        ...rect,
        x: roundLayoutValue(dominant.x),
        width: roundLayoutValue(dominant.width),
      };
    }
  }

  return next;
};

/** Public facade for deterministic column balancing. */
export const ColumnBalancer = {
  balanceColumns,
};
