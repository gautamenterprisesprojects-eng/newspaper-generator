import { rectKey } from "./LayoutGeometry";
import { calculateLayoutSolutionMetrics } from "./LayoutMetrics";
import type { LayoutRect, LayoutSolution, LayoutSolutionGeometryChange, LayoutSnapshot } from "./LayoutTransactionTypes";

const toRecord = (rects: Map<string, LayoutRect>) =>
  Object.fromEntries([...rects.entries()].map(([id, rect]) => [id, { ...rect }]));

/** Builds the immutable LayoutSolution returned by SmartLayoutSolver. */
export const buildLayoutSolution = ({
  snapshot,
  proposed,
  unresolvedCollisionCount,
  warnings,
  errors,
}: {
  snapshot: LayoutSnapshot;
  proposed: Map<string, LayoutRect>;
  unresolvedCollisionCount: number;
  warnings: string[];
  errors: string[];
}): LayoutSolution => {
  const before = new Map<string, LayoutRect>(snapshot.visibleFrames.map((frame) => [frame.id, { ...frame }]));
  const changes: LayoutSolutionGeometryChange[] = [...proposed.entries()]
    .map(([frameId, after]) => {
      const previous = before.get(frameId) ?? after;
      const changed = rectKey(previous) !== rectKey(after);

      return {
        frameId,
        before: { ...previous },
        after: { ...after },
        changed,
        reasons: changed ? ["Geometry changed by solved patch pipeline."] : [],
      };
    })
    .sort((a, b) => a.frameId.localeCompare(b.frameId));
  const affectedFrames = changes.filter((change) => change.changed).map((change) => change.frameId).sort();
  const metrics = calculateLayoutSolutionMetrics({
    changes,
    collisionCount: unresolvedCollisionCount,
    unresolvedCollisionCount,
    warningCount: warnings.length,
  });

  return {
    id: ["layout-solution", snapshot.pageId, snapshot.version, affectedFrames.join(".")].join(":"),
    pageId: snapshot.pageId,
    valid: errors.length === 0,
    before: toRecord(before),
    after: toRecord(proposed),
    geometryChanges: changes,
    affectedFrames,
    dirtyFrames: [...affectedFrames],
    metrics,
    warnings: [...warnings],
    errors: [...errors],
  };
};
