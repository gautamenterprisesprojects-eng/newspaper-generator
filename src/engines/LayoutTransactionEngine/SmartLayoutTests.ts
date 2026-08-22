import { strict as assert } from "node:assert";
import {
  LayoutTransactionEngine,
  type LayoutColumn,
  type LayoutFrameSnapshot,
  type LayoutRect,
} from "./LayoutTransactionEngine";
import type { GeometryPatch } from "./GeometryPatch";
import { solveSmartLayout } from "./SmartLayoutSolver";

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

const createSnapshot = (frames: LayoutFrameSnapshot[]) =>
  LayoutTransactionEngine.analyzeLayoutSnapshot({
    pageId: "page-1",
    pageBounds,
    contentBounds,
    columns,
    frames,
    gapTolerance: 5,
  });

const patch = (
  frameId: string,
  operation: GeometryPatch["operation"],
  amount: number,
  direction: GeometryPatch["direction"] = "right",
): GeometryPatch => ({
  id: `patch-${frameId}-${operation}-${amount}-${direction}`,
  frameId,
  operation,
  direction,
  amount,
  priority: 0,
  reason: "test patch",
  dependencies: [],
});

const assertGeometryExpansion = () => {
  const snapshot = createSnapshot([
    frame("source", { x: 20, y: 20, width: 180, height: 120 }),
    frame("peer", { x: 420, y: 20, width: 200, height: 120 }),
  ]);
  const solution = solveSmartLayout({
    snapshot,
    patches: [patch("source", "expand", 40)],
  });

  assert.equal(solution.after.source.width, 220);
  assert(solution.geometryChanges.find((change) => change.frameId === "source")?.changed);
};

const assertGeometryShrink = () => {
  const snapshot = createSnapshot([
    frame("source", { x: 20, y: 20, width: 180, height: 120 }),
  ]);
  const solution = solveSmartLayout({
    snapshot,
    patches: [patch("source", "shrink", 30)],
  });

  assert.equal(solution.after.source.x, 50);
  assert.equal(solution.after.source.width, 150);
};

const assertCollisionResolution = () => {
  const snapshot = createSnapshot([
    frame("source", { x: 20, y: 20, width: 180, height: 120 }),
    frame("below", { x: 20, y: 130, width: 180, height: 120 }),
  ]);
  const solution = solveSmartLayout({
    snapshot,
    patches: [patch("source", "expand", 40, "bottom")],
  });

  assert.equal(solution.errors.length, 0);
  assert(solution.after.below.y >= solution.after.source.y + solution.after.source.height);
};

const assertGridSnapping = () => {
  const snapshot = createSnapshot([
    frame("source", { x: 22, y: 23, width: 176, height: 119 }),
  ]);
  const solution = solveSmartLayout({
    snapshot,
    patches: [],
    baselineGridSize: 6,
  });

  assert.equal(solution.after.source.x, 20);
  assert.equal(solution.after.source.y, 20);
};

const assertTransactionCreation = () => {
  const snapshot = createSnapshot([
    frame("source", { x: 20, y: 20, width: 180, height: 120 }),
  ]);
  const solution = solveSmartLayout({
    snapshot,
    patches: [patch("source", "expand", 20)],
  });

  assert.equal(solution.pageId, "page-1");
  assert(solution.id.startsWith("layout-solution"));
  assert.deepEqual(solution.affectedFrames, ["source"]);
  assert.deepEqual(solution.dirtyFrames, ["source"]);
  assert.equal(solution.metrics.changedFrameCount, 1);
};

const assertDeterministicOutput = () => {
  const snapshot = createSnapshot([
    frame("source", { x: 20, y: 20, width: 180, height: 120 }),
    frame("peer", { x: 420, y: 20, width: 200, height: 120 }),
  ]);
  const patches = [patch("source", "expand", 40)];
  const first = solveSmartLayout({ snapshot, patches });
  const second = solveSmartLayout({ snapshot, patches });

  assert.deepEqual(first, second);
};

assertGeometryExpansion();
assertGeometryShrink();
assertCollisionResolution();
assertGridSnapping();
assertTransactionCreation();
assertDeterministicOutput();

console.log("SmartLayoutSolver tests passed: 6");
