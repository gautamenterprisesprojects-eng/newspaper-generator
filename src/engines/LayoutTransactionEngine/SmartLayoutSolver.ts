import { resolveCollisions } from "./CollisionResolver";
import { validateSolvedGeometry } from "./ConstraintValidator";
import { resolveGeometryPatches } from "./GeometryResolver";
import { snapGeometryToGrid } from "./GridSnapResolver";
import { buildLayoutSolution } from "./TransactionBuilder";
import type { GeometryPatch } from "./GeometryPatch";
import type { LayoutSnapshot, LayoutSolution } from "./LayoutTransactionTypes";

/**
 * Orchestrates geometry patch resolution into a validated LayoutSolution.
 *
 * SmartLayoutSolver is pure and immutable. It produces proposed rectangles and
 * transaction metadata, but does not update stories, commit layout, render UI,
 * call PDF export, or touch editor state.
 */
export const solveSmartLayout = ({
  snapshot,
  patches,
  baselineGridSize,
}: {
  snapshot: LayoutSnapshot;
  patches: GeometryPatch[];
  baselineGridSize?: number;
}): LayoutSolution => {
  const geometry = resolveGeometryPatches(snapshot, patches);
  const collision = resolveCollisions(snapshot, geometry.proposed);
  const snapped = snapGeometryToGrid(snapshot, collision.resolved, baselineGridSize);
  const validation = validateSolvedGeometry(snapshot, snapped);
  const warnings = [...geometry.warnings, ...collision.warnings, ...validation.warnings];

  return buildLayoutSolution({
    snapshot,
    proposed: snapped,
    unresolvedCollisionCount: collision.unresolvedCollisions.length,
    warnings,
    errors: validation.errors,
  });
};

/** Public facade for deterministic smart layout solving. */
export const SmartLayoutSolver = {
  solveSmartLayout,
};
