import { allocateSpaceAcrossCandidates } from "./SpaceAllocator";
import { clampRequiredSpaceToConstraint } from "./SpaceDistribution";
import type {
  ConstraintResult,
  LayoutSnapshot,
  NeighborResizeRequest,
  NeighborSolution,
  SpaceSolution,
} from "./LayoutTransactionTypes";

/**
 * Converts a NeighborSolution into deterministic space allocations.
 *
 * SpaceSolver is read-only: it never mutates geometry, never creates
 * transaction patches, never allocates negative space, and never allocates more
 * than candidate capacity or source constraint limits allow.
 */
export const solveSpace = ({
  snapshot,
  constraint,
  neighborSolution,
  resizeRequest,
}: {
  snapshot: LayoutSnapshot;
  constraint: ConstraintResult;
  neighborSolution: NeighborSolution;
  resizeRequest: NeighborResizeRequest;
}): SpaceSolution => {
  const requestedRequiredSpace = Math.max(0, resizeRequest.requiredSpace);
  const constrainedRequiredSpace = constraint.allowed
    ? clampRequiredSpaceToConstraint({
        requiredSpace: requestedRequiredSpace,
        direction: resizeRequest.direction,
        constraint,
      })
    : 0;
  const solverWarnings: string[] = [];

  if (!constraint.allowed) {
    solverWarnings.push("Constraint result is blocked; no space allocation was attempted.");
  }

  if (constrainedRequiredSpace < requestedRequiredSpace) {
    solverWarnings.push(
      `Required space was clamped from ${requestedRequiredSpace} to ${constrainedRequiredSpace} by ConstraintSolver limits.`,
    );
  }

  if (neighborSolution.sourceFrameId !== resizeRequest.sourceFrameId) {
    solverWarnings.push("NeighborSolution source does not match ResizeRequest source.");
  }

  if (!snapshot.framesById[resizeRequest.sourceFrameId]) {
    solverWarnings.push(`Source frame '${resizeRequest.sourceFrameId}' is not present in the snapshot.`);
  }

  const allocation = allocateSpaceAcrossCandidates({
    candidates: neighborSolution.candidates,
    requiredSpace: constrainedRequiredSpace,
  });
  const resolvedSpace = allocation.allocations.reduce((sum, item) => sum + item.allocatedSpace, 0);
  const remainingSpace = Math.max(0, constrainedRequiredSpace - resolvedSpace);

  if (remainingSpace > 0) {
    solverWarnings.push(`Unresolved space remains: ${remainingSpace}.`);
  }

  return {
    sourceFrameId: resizeRequest.sourceFrameId,
    requiredSpace: constrainedRequiredSpace,
    resolvedSpace,
    remainingSpace,
    allocations: allocation.allocations,
    rejectedCandidates: [
      ...neighborSolution.rejectedCandidateIds.map((candidateId) => ({
        candidateId,
        reason: "Rejected by NeighborSolver hard filters.",
      })),
      ...allocation.rejectedCandidates,
    ],
    allocationReasons: allocation.allocationReasons,
    solverWarnings,
  };
};

/** Public facade for deterministic space allocation analysis. */
export const SpaceSolver = {
  solveSpace,
};
