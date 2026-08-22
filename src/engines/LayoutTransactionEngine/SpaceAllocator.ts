import { getSpaceAllocationKind, getSpacePriorityScore } from "./SpacePriority";
import { getAllocationAmount } from "./SpaceDistribution";
import type {
  NeighborCandidate,
  SpaceAllocation,
  SpaceRejectedCandidate,
} from "./LayoutTransactionTypes";

/** Allocates space across already-ranked candidates without reordering them. */
export const allocateSpaceAcrossCandidates = ({
  candidates,
  requiredSpace,
}: {
  candidates: NeighborCandidate[];
  requiredSpace: number;
}) => {
  let remainingSpace = Math.max(0, requiredSpace);
  const allocations: SpaceAllocation[] = [];
  const rejectedCandidates: SpaceRejectedCandidate[] = [];
  const allocationReasons: string[] = [];

  for (const candidate of candidates) {
    if (remainingSpace <= 0) {
      rejectedCandidates.push({
        candidateId: candidate.id,
        reason: "Required space already resolved before this candidate was needed.",
      });
      continue;
    }

    if (candidate.capacity <= 0) {
      rejectedCandidates.push({
        candidateId: candidate.id,
        reason: "Candidate has no available capacity.",
      });
      continue;
    }

    const allocatedSpace = getAllocationAmount(remainingSpace, candidate.capacity);

    if (allocatedSpace <= 0) {
      rejectedCandidates.push({
        candidateId: candidate.id,
        reason: "Candidate allocation would be zero.",
      });
      continue;
    }

    remainingSpace -= allocatedSpace;
    allocations.push({
      candidateId: candidate.id,
      frameId: candidate.frameId,
      kind: getSpaceAllocationKind(candidate),
      requestedSpace: requiredSpace,
      candidateCapacity: candidate.capacity,
      allocatedSpace,
      remainingCandidateCapacity: Math.max(0, candidate.capacity - allocatedSpace),
      priorityScore: getSpacePriorityScore(candidate),
      reason: `Allocated ${allocatedSpace} from ${candidate.kind} candidate '${candidate.id}'.`,
    });
    allocationReasons.push(`Candidate '${candidate.id}' contributed ${allocatedSpace}.`);
  }

  return {
    allocations,
    rejectedCandidates,
    allocationReasons,
    remainingSpace,
  };
};
