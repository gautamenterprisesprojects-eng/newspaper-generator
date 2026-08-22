import { buildWhitespaceMap } from "./WhitespaceAnalyzer";
import { balanceColumns } from "./ColumnBalancer";
import {
  getChangedFrameIds,
  getClusterBeforeRects,
  getWhitespaceArea,
} from "./ClusterMetrics";
import { applyVerticalCascade } from "./VerticalCascade";
import { eliminateWhitespace } from "./WhitespaceEliminator";
import type { BalancedCluster, LayoutCluster } from "./LayoutCluster";
import type { LayoutColumn, LayoutRect } from "./LayoutTransactionTypes";

const cloneRects = (rects: Record<string, LayoutRect>) =>
  Object.fromEntries(Object.entries(rects).map(([id, rect]) => [id, { ...rect }]));

/**
 * Solves a connected layout cluster as a regional flow.
 *
 * The solver is pure and deterministic. It balances columns, cascades vertical
 * movement, eliminates internal whitespace, and reports remaining whitespace
 * without committing geometry to editor state.
 */
export const solveRegionFlow = ({
  cluster,
  contentBounds,
  columns,
  proposedRects,
  minimumGap = 0,
}: {
  cluster: LayoutCluster;
  contentBounds: LayoutRect;
  columns: LayoutColumn[];
  proposedRects?: Record<string, LayoutRect>;
  minimumGap?: number;
}): BalancedCluster => {
  const before = getClusterBeforeRects(cluster);
  const initial = {
    ...before,
    ...cloneRects(proposedRects ?? {}),
  };
  const columnBalanced = balanceColumns({
    cluster,
    columns,
    rects: initial,
  });
  const cascaded = applyVerticalCascade({
    cluster,
    rects: columnBalanced,
    minimumGap,
  });
  const eliminated = eliminateWhitespace({
    cluster,
    rects: cascaded,
  });
  const after = applyVerticalCascade({
    cluster,
    rects: eliminated.rects,
    minimumGap,
  });
  const nextFrames = cluster.frames.map((frame) => ({
    ...frame,
    ...(after[frame.id] ?? frame),
  }));
  const unresolvedWhitespace = buildWhitespaceMap({
    contentBounds,
    columns,
    frames: nextFrames,
  }).filter((cell) => cell.boundedBy.some((frameId) => cluster.frameIds.includes(frameId)));
  const beforeWhitespaceArea = getWhitespaceArea(cluster.whitespace);
  const afterWhitespaceArea = getWhitespaceArea(unresolvedWhitespace);
  const changedFrameIds = getChangedFrameIds(before, after);

  return {
    cluster,
    before,
    after,
    changedFrameIds,
    unresolvedWhitespace,
    warnings: [...eliminated.warnings],
    metrics: {
      beforeWhitespaceArea,
      afterWhitespaceArea,
      eliminatedWhitespaceArea: Math.max(0, beforeWhitespaceArea - afterWhitespaceArea + eliminated.eliminatedArea),
      changedFrameCount: changedFrameIds.length,
      iterationCount: eliminated.iterationCount,
    },
  };
};

/** Public facade for deterministic region flow solving. */
export const RegionFlowSolver = {
  solveRegionFlow,
};
