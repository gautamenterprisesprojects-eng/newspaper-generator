import { selectNeighborCandidates } from "./NeighborSelection";
import type {
  ConstraintResult,
  LayoutSnapshot,
  NeighborResizeRequest,
  NeighborSolution,
} from "./LayoutTransactionTypes";

/**
 * Resolves legal redistribution candidates for a resize request.
 *
 * NeighborSolver is read-only: it consumes the snapshot, neighbor graph, and
 * constraint result, then returns ranked candidates and unresolved space. It
 * never mutates frame geometry and never creates layout patches.
 */
export const solveNeighbors = ({
  snapshot,
  constraint,
  resizeRequest,
}: {
  snapshot: LayoutSnapshot;
  constraint: ConstraintResult;
  resizeRequest: NeighborResizeRequest;
}): NeighborSolution => {
  if (!constraint.allowed) {
    return {
      sourceFrameId: resizeRequest.sourceFrameId,
      resizeDirection: resizeRequest.direction,
      requiredSpace: Math.max(0, resizeRequest.requiredSpace),
      candidates: [],
      remainingUnresolvedSpace: Math.max(0, resizeRequest.requiredSpace),
      rejectedCandidateIds: [],
      reasons: ["Constraint result is blocked; neighbor selection skipped."],
    };
  }

  const { candidates, rejectedCandidateIds } = selectNeighborCandidates({
    snapshot,
    constraint,
    direction: resizeRequest.direction,
  });
  const requiredSpace = Math.max(0, resizeRequest.requiredSpace);
  const capacity = candidates.reduce((sum, candidate) => sum + candidate.capacity, 0);

  return {
    sourceFrameId: resizeRequest.sourceFrameId,
    resizeDirection: resizeRequest.direction,
    requiredSpace,
    candidates,
    remainingUnresolvedSpace: Math.max(0, requiredSpace - capacity),
    rejectedCandidateIds,
    reasons: [
      `Loaded ${candidates.length} ranked candidates from NeighborGraph and WhitespaceMap.`,
      `Candidate capacity ${capacity} for required space ${requiredSpace}.`,
    ],
  };
};

/** Public facade for deterministic neighbor candidate selection. */
export const NeighborSolver = {
  solveNeighbors,
};
