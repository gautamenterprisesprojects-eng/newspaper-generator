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
import { buildGeometryPatches } from "./GeometryPatchBuilder";

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
  const spaceSolution = solveSpace({
    snapshot,
    constraint,
    neighborSolution,
    resizeRequest,
  });

  return {
    snapshot,
    constraint,
    neighborSolution,
    spaceSolution,
  };
};

const assertBuildsSourceAndAllocationPatches = () => {
  const result = buildGeometryPatches(createPipeline(60));

  assert(result.patches.length >= 2);
  assert.equal(result.patches[0].frameId, "source");
  assert.equal(result.patches[0].operation, "expand");
  assert.equal(result.patches[0].direction, "right");
  assert(result.patches[0].dependencies.length > 0);
  assert(result.patches.slice(1).every((patch) => patch.dependencies.includes("source")));
};

const assertPatchOperationsReflectAllocationKinds = () => {
  const pipeline = createPipeline(60);
  const result = buildGeometryPatches({
    ...pipeline,
    spaceSolution: {
      ...pipeline.spaceSolution,
      allocations: [
        ...pipeline.spaceSolution.allocations,
        {
          candidateId: "filler",
          frameId: "filler",
          kind: "story",
          requestedSpace: 60,
          candidateCapacity: 20,
          allocatedSpace: 20,
          remainingCandidateCapacity: 0,
          priorityScore: 30,
          reason: "Synthetic story allocation for patch operation coverage.",
        },
      ],
    },
  });
  const operations = result.patches.map((patch) => patch.operation);

  assert(operations.includes("reserve") || operations.includes("release"));
  assert(operations.includes("shrink"));
};

const assertDoesNotCreateFinalRectangles = () => {
  const result = buildGeometryPatches(createPipeline(40));

  assert(result.patches.every((patch) => !("after" in patch)));
  assert(result.patches.every((patch) => patch.amount >= 0));
};

const assertBlockedConstraintCreatesNoPatches = () => {
  const snapshot = createSnapshot();
  const constraint = solveConstraints(snapshot, {
    frameId: "source",
    operation: "move",
    delta: { x: 10_000 },
  });
  const neighborSolution = solveNeighbors({
    snapshot,
    constraint,
    resizeRequest: {
      sourceFrameId: "source",
      direction: "right",
      requiredSpace: 80,
    },
  });
  const spaceSolution = solveSpace({
    snapshot,
    constraint,
    neighborSolution,
    resizeRequest: {
      sourceFrameId: "source",
      direction: "right",
      requiredSpace: 80,
    },
  });
  const result = buildGeometryPatches({
    snapshot,
    constraint,
    neighborSolution,
    spaceSolution,
  });

  assert.equal(result.patches.length, 0);
  assert(result.warnings.some((warning) => warning.includes("blocked")));
};

const assertDeterministicPatchIds = () => {
  const first = buildGeometryPatches(createPipeline(60));
  const second = buildGeometryPatches(createPipeline(60));

  assert.deepEqual(first.patches.map((patch) => patch.id), second.patches.map((patch) => patch.id));
};

assertBuildsSourceAndAllocationPatches();
assertPatchOperationsReflectAllocationKinds();
assertDoesNotCreateFinalRectangles();
assertBlockedConstraintCreatesNoPatches();
assertDeterministicPatchIds();

console.log("GeometryPatchBuilder tests passed: 5");
