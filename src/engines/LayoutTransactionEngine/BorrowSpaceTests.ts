import { strict as assert } from "node:assert";
import { solveBorrowSpace } from "./BorrowSpaceSolver";
import { solveConstraints } from "./ConstraintSolver";
import { LayoutTransactionEngine } from "./LayoutTransactionEngine";
import type { LayoutColumn, LayoutFrameSnapshot, LayoutRect } from "./LayoutTransactionTypes";

const pageBounds: LayoutRect = { x: 0, y: 0, width: 420, height: 320 };
const contentBounds: LayoutRect = { x: 20, y: 20, width: 380, height: 280 };
const columns: LayoutColumn[] = [
  { index: 1, x: 20, y: 20, width: 180, height: 280 },
  { index: 2, x: 220, y: 20, width: 180, height: 280 },
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

const rectOf = (rect: LayoutRect): LayoutRect => ({
  x: rect.x,
  y: rect.y,
  width: rect.width,
  height: rect.height,
});

const createSnapshot = () =>
  LayoutTransactionEngine.analyzeLayoutSnapshot({
    pageId: "page-1",
    pageBounds,
    contentBounds,
    columns,
    frames: [
      frame("source", { x: 20, y: 20, width: 180, height: 180 }, { priority: "major" }),
      frame("neighbor", { x: 220, y: 20, width: 180, height: 180 }, { priority: "filler" }),
    ],
  });

const assertBorrowBuildsTemporaryAllocation = () => {
  const snapshot = createSnapshot();
  const result = solveBorrowSpace({
    snapshot,
    intent: {
      sourceFrameId: "source",
      direction: "right",
      requiredSpace: 72,
      requestedRect: { x: 20, y: 20, width: 252, height: 180 },
    },
    minSize: { width: 80, height: 80 },
  });

  assert.equal(result.spaceSolution.resolvedSpace, 72);
  assert.equal(result.spaceSolution.remainingSpace, 0);
  assert.equal(result.spaceSolution.allocations[0].frameId, "neighbor");
  assert.deepEqual(rectOf(result.proposedFrames.source), { x: 20, y: 20, width: 252, height: 180 });
  assert.deepEqual(rectOf(result.proposedFrames.neighbor), { x: 292, y: 20, width: 108, height: 180 });
};

const assertConstraintValidatesProposedLayout = () => {
  const snapshot = createSnapshot();
  const borrow = solveBorrowSpace({
    snapshot,
    intent: {
      sourceFrameId: "source",
      direction: "right",
      requiredSpace: 72,
      requestedRect: { x: 20, y: 20, width: 452, height: 180 },
    },
    minSize: { width: 80, height: 80 },
  });
  const rawBlocked = solveConstraints(snapshot, {
    frameId: "source",
    operation: "resize",
    delta: { width: 432 },
    minSize: { width: 80, height: 80 },
  });
  const proposedAllowed = solveConstraints(snapshot, {
    frameId: "source",
    operation: "resize",
    delta: { width: 432 },
    proposedFrames: borrow.proposedFrames,
    minSize: { width: 80, height: 80 },
  });

  assert(rawBlocked.blockedBy.some((blocker) => blocker.rule === "page-margins"));
  assert.equal(proposedAllowed.allowed, true);
};

assertBorrowBuildsTemporaryAllocation();
assertConstraintValidatesProposedLayout();

console.log("BorrowSpaceSolver tests passed: 2");
