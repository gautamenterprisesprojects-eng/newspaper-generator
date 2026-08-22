import {
  createGeometryPatchId,
  getAllocationPatchOperation,
  getSourcePatchOperation,
} from "./PatchOperations";
import type { GeometryPatch, GeometryPatchBuildResult } from "./GeometryPatch";
import type {
  ConstraintResult,
  LayoutSnapshot,
  NeighborSolution,
  SpaceSolution,
} from "./LayoutTransactionTypes";

/**
 * Converts a SpaceSolution into immutable geometry patch intents.
 *
 * GeometryPatchBuilder does not compute final rectangles, validate overlap, or
 * execute patches. It only produces deterministic operation descriptors for a
 * later geometry solver or transaction executor.
 */
export const buildGeometryPatches = ({
  snapshot,
  constraint,
  neighborSolution,
  spaceSolution,
}: {
  snapshot: LayoutSnapshot;
  constraint: ConstraintResult;
  neighborSolution: NeighborSolution;
  spaceSolution: SpaceSolution;
}): GeometryPatchBuildResult => {
  const warnings: string[] = [];
  const reasons: string[] = [];
  const patches: GeometryPatch[] = [];

  if (!constraint.allowed) {
    warnings.push("Constraint result is blocked; no geometry patch intents were created.");
  }

  if (!snapshot.framesById[spaceSolution.sourceFrameId]) {
    warnings.push(`Source frame '${spaceSolution.sourceFrameId}' is missing from the snapshot.`);
  }

  if (spaceSolution.remainingSpace > 0) {
    warnings.push(`Space solution has unresolved space: ${spaceSolution.remainingSpace}.`);
  }

  if (spaceSolution.resolvedSpace > 0 && constraint.allowed) {
    const operation = getSourcePatchOperation(neighborSolution.resizeDirection);
    const index = patches.length + 1;

    patches.push({
      id: createGeometryPatchId({
        frameId: spaceSolution.sourceFrameId,
        operation,
        direction: neighborSolution.resizeDirection,
        amount: spaceSolution.resolvedSpace,
        index,
      }),
      frameId: spaceSolution.sourceFrameId,
      operation,
      direction: neighborSolution.resizeDirection,
      amount: spaceSolution.resolvedSpace,
      priority: 0,
      reason: `Source frame intends to ${operation} by resolved space ${spaceSolution.resolvedSpace}.`,
      dependencies: spaceSolution.allocations.map((allocation) => allocation.candidateId),
    });
    reasons.push(`Created source ${operation} patch for '${spaceSolution.sourceFrameId}'.`);
  }

  for (const allocation of spaceSolution.allocations) {
    if (allocation.allocatedSpace <= 0) {
      warnings.push(`Skipped zero allocation for '${allocation.candidateId}'.`);
      continue;
    }

    const operation = getAllocationPatchOperation(allocation);
    const frameId = allocation.frameId ?? allocation.candidateId;
    const index = patches.length + 1;

    patches.push({
      id: createGeometryPatchId({
        frameId,
        operation,
        direction: neighborSolution.resizeDirection,
        amount: allocation.allocatedSpace,
        index,
      }),
      frameId,
      operation,
      direction: neighborSolution.resizeDirection,
      amount: allocation.allocatedSpace,
      priority: allocation.priorityScore,
      reason: allocation.reason,
      dependencies: [spaceSolution.sourceFrameId],
    });
    reasons.push(`Created ${operation} patch for '${frameId}'.`);
  }

  return {
    patches: patches.map((patch) => ({
      ...patch,
      dependencies: [...patch.dependencies],
    })),
    warnings,
    reasons,
  };
};

/** Public facade for deterministic geometry patch intent building. */
export const GeometryPatchBuilder = {
  buildGeometryPatches,
};
