import { rectArea } from "./LayoutGeometry";
import type { LayoutRect, LayoutSolutionGeometryChange, LayoutSolutionMetrics } from "./LayoutTransactionTypes";

/** Computes deterministic metrics for a solved layout proposal. */
export const calculateLayoutSolutionMetrics = ({
  changes,
  collisionCount,
  unresolvedCollisionCount,
  warningCount,
}: {
  changes: LayoutSolutionGeometryChange[];
  collisionCount: number;
  unresolvedCollisionCount: number;
  warningCount: number;
}): LayoutSolutionMetrics => ({
  changedFrameCount: changes.filter((change) => change.changed).length,
  affectedFrameCount: changes.length,
  dirtyFrameCount: changes.filter((change) => change.changed).length,
  collisionCount,
  unresolvedCollisionCount,
  warningCount,
  totalChangedArea: changes.reduce((sum, change) => {
    if (!change.changed) {
      return sum;
    }

    return sum + Math.abs(rectArea(change.after as LayoutRect) - rectArea(change.before as LayoutRect));
  }, 0),
});
