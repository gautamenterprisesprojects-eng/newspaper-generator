import type { NeighborCandidate, SpaceAllocationKind } from "./LayoutTransactionTypes";

const editorialSpaceRank = {
  filler: 30,
  brief: 40,
  secondary: 50,
  major: 60,
  lead: 70,
} as const;

/** Resolves the allocation class for a neighbor candidate. */
export const getSpaceAllocationKind = (candidate: NeighborCandidate): SpaceAllocationKind => {
  if (candidate.kind === "whitespace") {
    return candidate.distance > 0 ? "reserved-gap" : "whitespace";
  }

  return "story";
};

/** Returns deterministic allocation priority without changing candidate order. */
export const getSpacePriorityScore = (candidate: NeighborCandidate) => {
  if (candidate.kind === "whitespace") {
    return candidate.distance > 0 ? 10 : 0;
  }

  return candidate.editorialPriority ? editorialSpaceRank[candidate.editorialPriority] : 80;
};
