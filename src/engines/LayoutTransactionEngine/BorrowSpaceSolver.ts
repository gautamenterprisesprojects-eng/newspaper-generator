import { allocateSpaceAcrossCandidates } from "./SpaceAllocator";
import { selectNeighborCandidates } from "./NeighborSelection";
import { solveConstraints } from "./ConstraintSolver";
import type {
  ConstraintResult,
  LayoutRect,
  LayoutSnapshot,
  ResizeIntent,
  SpaceSolution,
  TemporaryAllocation,
} from "./LayoutTransactionTypes";

const cloneRect = (rect: LayoutRect): LayoutRect => ({ ...rect });

const expandSource = (rect: LayoutRect, intent: ResizeIntent, amount: number): LayoutRect => {
  if (intent.direction === "right") {
    return { ...rect, width: rect.width + amount };
  }

  if (intent.direction === "left") {
    return { ...rect, x: rect.x - amount, width: rect.width + amount };
  }

  if (intent.direction === "bottom") {
    return { ...rect, height: rect.height + amount };
  }

  if (intent.direction === "top") {
    return { ...rect, y: rect.y - amount, height: rect.height + amount };
  }

  return rect;
};

const borrowFromFrame = (rect: LayoutRect, intent: ResizeIntent, amount: number): LayoutRect => {
  if (intent.direction === "right") {
    return { ...rect, x: rect.x + amount, width: Math.max(1, rect.width - amount) };
  }

  if (intent.direction === "left") {
    return { ...rect, width: Math.max(1, rect.width - amount) };
  }

  if (intent.direction === "bottom") {
    return { ...rect, y: rect.y + amount, height: Math.max(1, rect.height - amount) };
  }

  if (intent.direction === "top") {
    return { ...rect, height: Math.max(1, rect.height - amount) };
  }

  return rect;
};

const createCapabilityConstraint = ({
  snapshot,
  intent,
  minSize,
  maxSize,
}: {
  snapshot: LayoutSnapshot;
  intent: ResizeIntent;
  minSize?: Partial<Pick<LayoutRect, "width" | "height">>;
  maxSize?: Partial<Pick<LayoutRect, "width" | "height">>;
}): ConstraintResult => {
  const source = snapshot.framesById[intent.sourceFrameId];
  const base = solveConstraints(snapshot, {
    frameId: intent.sourceFrameId,
    operation: "resize",
    delta: {},
    minSize,
    maxSize,
  });

  if (!source) {
    return base;
  }

  return {
    ...base,
    limits: {
      ...base.limits,
      grow: {
        left: Math.max(base.limits.grow.left, intent.requiredSpace),
        right: Math.max(base.limits.grow.right, intent.requiredSpace),
        top: Math.max(base.limits.grow.top, intent.requiredSpace),
        bottom: Math.max(base.limits.grow.bottom, intent.requiredSpace),
      },
    },
  };
};

const buildProposedFrames = ({
  snapshot,
  intent,
  spaceSolution,
}: {
  snapshot: LayoutSnapshot;
  intent: ResizeIntent;
  spaceSolution: SpaceSolution;
}) => {
  const proposed = new Map<string, LayoutRect>(
    snapshot.visibleFrames.map((frame) => [frame.id, cloneRect(frame)]),
  );
  const source = proposed.get(intent.sourceFrameId);

  if (source) {
    proposed.set(intent.sourceFrameId, expandSource(source, intent, spaceSolution.resolvedSpace));
  }

  for (const allocation of spaceSolution.allocations) {
    if (!allocation.frameId || allocation.allocatedSpace <= 0) {
      continue;
    }

    const frame = proposed.get(allocation.frameId);

    if (frame) {
      proposed.set(allocation.frameId, borrowFromFrame(frame, intent, allocation.allocatedSpace));
    }
  }

  return Object.fromEntries(proposed);
};

/**
 * Converts a resize intent into deterministic temporary space allocation.
 *
 * BorrowSpaceSolver inspects the existing neighbor graph and whitespace map,
 * ranks candidates, allocates requested space, and returns proposed temporary
 * rectangles. It never mutates the layout snapshot or editor state.
 */
export const solveBorrowSpace = ({
  snapshot,
  intent,
  minSize,
  maxSize,
}: {
  snapshot: LayoutSnapshot;
  intent: ResizeIntent;
  minSize?: Partial<Pick<LayoutRect, "width" | "height">>;
  maxSize?: Partial<Pick<LayoutRect, "width" | "height">>;
}): TemporaryAllocation => {
  const requiredSpace = Math.max(0, intent.requiredSpace);
  const capabilityConstraint = createCapabilityConstraint({
    snapshot,
    intent: { ...intent, requiredSpace },
    minSize,
    maxSize,
  });

  const selection = capabilityConstraint.allowed
    ? selectNeighborCandidates({
        snapshot,
        constraint: capabilityConstraint,
        direction: intent.direction,
      })
    : { candidates: [], rejectedCandidateIds: [] };
  const allocation = allocateSpaceAcrossCandidates({
    candidates: selection.candidates,
    requiredSpace,
  });
  const resolvedSpace = allocation.allocations.reduce((sum, item) => sum + item.allocatedSpace, 0);
  const remainingSpace = Math.max(0, requiredSpace - resolvedSpace);
  const neighborSolution = {
    sourceFrameId: intent.sourceFrameId,
    resizeDirection: intent.direction,
    requiredSpace,
    candidates: selection.candidates,
    remainingUnresolvedSpace: remainingSpace,
    rejectedCandidateIds: [...new Set(selection.rejectedCandidateIds)].sort(),
    reasons: capabilityConstraint.allowed
      ? [
          `Loaded ${selection.candidates.length} ranked candidates before constraint validation.`,
          `Candidate capacity ${selection.candidates.reduce((sum, candidate) => sum + candidate.capacity, 0)} for required space ${requiredSpace}.`,
        ]
      : ["Capability constraint is blocked; borrow candidate selection skipped."],
  };
  const spaceSolution: SpaceSolution = {
    sourceFrameId: intent.sourceFrameId,
    requiredSpace,
    resolvedSpace,
    remainingSpace,
    allocations: allocation.allocations,
    rejectedCandidates: [
      ...neighborSolution.rejectedCandidateIds.map((candidateId) => ({
        candidateId,
        reason: "Rejected by BorrowSpaceSolver hard filters.",
      })),
      ...allocation.rejectedCandidates,
    ],
    allocationReasons: allocation.allocationReasons,
    solverWarnings: [
      ...(!capabilityConstraint.allowed
        ? capabilityConstraint.blockedBy.map((blocker) => blocker.message)
        : []),
      ...(remainingSpace > 0 ? [`Unresolved borrowed space remains: ${remainingSpace}.`] : []),
    ],
  };

  return {
    intent: { ...intent, requiredSpace },
    neighborSolution,
    spaceSolution,
    proposedFrames: buildProposedFrames({
      snapshot,
      intent: { ...intent, requiredSpace },
      spaceSolution,
    }),
    warnings: [...spaceSolution.solverWarnings],
    reasons: [
      ...neighborSolution.reasons,
      ...spaceSolution.allocationReasons,
    ],
  };
};

/** Public facade for resize-intent space borrowing. */
export const BorrowSpaceSolver = {
  solveBorrowSpace,
};
