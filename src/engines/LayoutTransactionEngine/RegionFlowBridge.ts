import { rectKey } from "./LayoutGeometry";
import type { BalancedCluster } from "./LayoutCluster";
import type { LayoutRect, LayoutSolution, LayoutSolutionGeometryChange } from "./LayoutTransactionTypes";

const cloneRect = (rect: LayoutRect): LayoutRect => ({
  x: rect.x,
  y: rect.y,
  width: rect.width,
  height: rect.height,
});

const mergeUniqueSorted = (first: string[], second: string[]) =>
  [...new Set([...first, ...second])].sort();

const getMergedChange = (
  change: LayoutSolutionGeometryChange,
  frameId: string,
  after: LayoutRect,
): LayoutSolutionGeometryChange => {
  const changed = rectKey(change.before) !== rectKey(after);

  return {
    ...change,
    after: cloneRect(after),
    changed,
    reasons: changed
      ? mergeUniqueSorted(change.reasons, ["Geometry changed by RegionFlowSolver."])
      : [...change.reasons],
  };
};

/**
 * Merges RegionFlow balanced geometry into an existing LayoutSolution.
 *
 * Only frames listed in `BalancedCluster.changedFrameIds` are replaced. All
 * unchanged frames, solution identity, page id, validity, metrics, warnings,
 * and errors are preserved. The function is pure and never mutates either
 * input object.
 */
export const mergeRegionFlowIntoLayoutSolution = ({
  solution,
  balancedCluster,
}: {
  solution: LayoutSolution;
  balancedCluster: BalancedCluster;
}): LayoutSolution => {
  const changedIds = new Set(balancedCluster.changedFrameIds);
  const after = Object.fromEntries(
    Object.entries(solution.after).map(([frameId, rect]) => [
      frameId,
      cloneRect(changedIds.has(frameId) && balancedCluster.after[frameId]
        ? balancedCluster.after[frameId]
        : rect),
    ]),
  );

  for (const frameId of balancedCluster.changedFrameIds) {
    if (!after[frameId] && balancedCluster.after[frameId]) {
      after[frameId] = cloneRect(balancedCluster.after[frameId]);
    }
  }

  const existingChanges = new Map(solution.geometryChanges.map((change) => [change.frameId, change]));
  const geometryChanges = mergeUniqueSorted(
    solution.geometryChanges.map((change) => change.frameId),
    balancedCluster.changedFrameIds,
  ).map((frameId) => {
    const existing = existingChanges.get(frameId);
    const before = existing?.before ?? solution.before[frameId] ?? balancedCluster.before[frameId] ?? after[frameId];
    const nextAfter = after[frameId] ?? existing?.after ?? before;

    if (existing) {
      return getMergedChange(existing, frameId, nextAfter);
    }

    const changed = rectKey(before) !== rectKey(nextAfter);

    return {
      frameId,
      before: cloneRect(before),
      after: cloneRect(nextAfter),
      changed,
      reasons: changed ? ["Geometry changed by RegionFlowSolver."] : [],
    };
  });
  const changedFrameIds = geometryChanges
    .filter((change) => change.changed)
    .map((change) => change.frameId);

  return {
    ...solution,
    before: Object.fromEntries(Object.entries(solution.before).map(([frameId, rect]) => [frameId, cloneRect(rect)])),
    after,
    geometryChanges,
    affectedFrames: mergeUniqueSorted(solution.affectedFrames, changedFrameIds),
    dirtyFrames: mergeUniqueSorted(solution.dirtyFrames, changedFrameIds),
    metrics: { ...solution.metrics },
    warnings: [...solution.warnings],
    errors: [...solution.errors],
  };
};

/** Public facade for merging RegionFlow output into LayoutSolution output. */
export const RegionFlowBridge = {
  mergeRegionFlowIntoLayoutSolution,
};
