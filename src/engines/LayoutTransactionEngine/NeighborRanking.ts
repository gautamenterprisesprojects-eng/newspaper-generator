import type { NeighborCandidate } from "./LayoutTransactionTypes";

const kindRank: Record<string, number> = {
  whitespace: 0,
  story: 10,
  asset: 50,
  master: 60,
  unknown: 70,
  advertisement: 1000,
};

const editorialRank = {
  filler: 0,
  brief: 1,
  secondary: 2,
  major: 3,
  lead: 4,
} as const;

/** Returns the soft ranking score for neighbor redistribution candidates. */
export const getNeighborPriorityScore = (candidate: Pick<NeighborCandidate, "kind" | "editorialPriority">) => {
  if (candidate.kind === "whitespace") {
    return 0;
  }

  return kindRank[candidate.kind] + (candidate.editorialPriority ? editorialRank[candidate.editorialPriority] : 5);
};

/** Sorts candidates by deterministic Smart Auto Resize preference order. */
export const rankNeighborCandidates = (candidates: NeighborCandidate[]) =>
  [...candidates].sort((first, second) => {
    if (first.priorityScore !== second.priorityScore) {
      return first.priorityScore - second.priorityScore;
    }

    if (first.distance !== second.distance) {
      return first.distance - second.distance;
    }

    if (second.capacity !== first.capacity) {
      return second.capacity - first.capacity;
    }

    if (second.alignmentScore !== first.alignmentScore) {
      return second.alignmentScore - first.alignmentScore;
    }

    if (first.readingOrder !== second.readingOrder) {
      return first.readingOrder - second.readingOrder;
    }

    return first.id.localeCompare(second.id);
  });
