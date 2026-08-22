import { strict as assert } from "node:assert";
import {
  LayoutTransactionEngine,
  type LayoutColumn,
  type LayoutFrameSnapshot,
  type LayoutRect,
} from "./LayoutTransactionEngine";
import { solveConstraints } from "./ConstraintSolver";
import { solveNeighbors } from "./NeighborSolver";
import { solveSpace } from "./SpaceSolver";

const pageBounds: LayoutRect = { x: 0, y: 0, width: 640, height: 800 };
const contentBounds: LayoutRect = { x: 20, y: 20, width: 600, height: 760 };
const columns: LayoutColumn[] = [
  { index: 1, x: 20, y: 20, width: 180, height: 760 },
  { index: 2, x: 220, y: 20, width: 180, height: 760 },
  { index: 3, x: 420, y: 20, width: 200, height: 760 },
];

const frame = (
  id: string,
  rect: LayoutRect,
  overrides: Partial<LayoutFrameSnapshot> = {},
): LayoutFrameSnapshot => ({
  id,
  pageId: "page-1",
  kind: "story",
  locked: false,
  hidden: false,
  pinned: false,
  priority: "secondary",
  zIndex: 0,
  ...rect,
  ...overrides,
});

const createSnapshot = () =>
  LayoutTransactionEngine.analyzeLayoutSnapshot({
    pageId: "page-1",
    pageBounds,
    contentBounds,
    columns,
    frames: [
      frame("source", { x: 20, y: 20, width: 180, height: 220 }, { priority: "major" }),
      frame("filler", { x: 260, y: 20, width: 40, height: 220 }, { priority: "filler" }),
      frame("brief", { x: 320, y: 20, width: 80, height: 220 }, { priority: "brief" }),
      frame("lead", { x: 420, y: 20, width: 200, height: 220 }, { priority: "lead" }),
    ],
  });

const createPipeline = (requiredSpace: number) => {
  const snapshot = createSnapshot();
  const constraint = solveConstraints(snapshot, {
    frameId: "source",
    operation: "resize",
    delta: { width: requiredSpace },
    minSize: { width: 40, height: 40 },
  });
  const resizeRequest = {
    sourceFrameId: "source",
    direction: "right" as const,
    requiredSpace,
  };
  const neighborSolution = solveNeighbors({
    snapshot,
    constraint,
    resizeRequest,
  });

  return {
    snapshot,
    constraint,
    resizeRequest,
    neighborSolution,
  };
};

const assertAllocatesWhitespaceFirst = () => {
  const pipeline = createPipeline(30);
  const solution = solveSpace(pipeline);

  assert.equal(solution.requiredSpace, 30);
  assert.equal(solution.resolvedSpace, 30);
  assert.equal(solution.remainingSpace, 0);
  assert.equal(solution.allocations[0].kind, "reserved-gap");
  assert(solution.allocations[0].allocatedSpace <= 30);
};

const assertNeverExceedsCapacity = () => {
  const pipeline = createPipeline(100);
  const solution = solveSpace(pipeline);

  for (const allocation of solution.allocations) {
    assert(allocation.allocatedSpace >= 0);
    assert(allocation.allocatedSpace <= allocation.candidateCapacity);
    assert.equal(allocation.allocatedSpace + allocation.remainingCandidateCapacity, allocation.candidateCapacity);
  }
};

const assertReturnsUnresolvedSpace = () => {
  const pipeline = createPipeline(100);
  const solution = solveSpace({
    ...pipeline,
    neighborSolution: {
      ...pipeline.neighborSolution,
      candidates: pipeline.neighborSolution.candidates.slice(0, 1).map((candidate) => ({
        ...candidate,
        capacity: 10,
      })),
    },
  });

  assert(solution.remainingSpace > 0);
  assert(solution.solverWarnings.some((warning) => warning.includes("Unresolved space")));
};

const assertConstraintClamp = () => {
  const pipeline = createPipeline(10_000);
  const solution = solveSpace(pipeline);

  assert(solution.requiredSpace < 10_000);
  assert(solution.solverWarnings.some((warning) => warning.includes("clamped")));
};

const assertBlockedConstraintDoesNotAllocate = () => {
  const snapshot = createSnapshot();
  const constraint = solveConstraints(snapshot, {
    frameId: "source",
    operation: "move",
    delta: { x: 10_000 },
  });
  const resizeRequest = {
    sourceFrameId: "source",
    direction: "right" as const,
    requiredSpace: 80,
  };
  const neighborSolution = solveNeighbors({
    snapshot,
    constraint,
    resizeRequest,
  });
  const solution = solveSpace({
    snapshot,
    constraint,
    neighborSolution,
    resizeRequest,
  });

  assert.equal(solution.requiredSpace, 0);
  assert.equal(solution.allocations.length, 0);
  assert(solution.solverWarnings.some((warning) => warning.includes("blocked")));
};

const assertDoesNotReorderCandidates = () => {
  const pipeline = createPipeline(120);
  const solution = solveSpace(pipeline);
  const allocatedIds = solution.allocations.map((allocation) => allocation.candidateId);
  const neighborIds = pipeline.neighborSolution.candidates
    .slice(0, allocatedIds.length)
    .map((candidate) => candidate.id);

  assert.deepEqual(allocatedIds, neighborIds);
};

assertAllocatesWhitespaceFirst();
assertNeverExceedsCapacity();
assertReturnsUnresolvedSpace();
assertConstraintClamp();
assertBlockedConstraintDoesNotAllocate();
assertDoesNotReorderCandidates();

console.log("SpaceSolver tests passed: 6");
