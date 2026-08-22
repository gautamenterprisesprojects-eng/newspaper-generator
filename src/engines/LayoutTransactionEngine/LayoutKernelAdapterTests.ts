import { strict as assert } from "node:assert";
import {
  LayoutTransactionEngine,
  type LayoutColumn,
  type LayoutFrameSnapshot,
  type LayoutRect,
} from "./LayoutTransactionEngine";
import { runLayoutKernelShadowResize } from "./LayoutKernelAdapter";

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

const frames = [
  frame("source", { x: 20, y: 20, width: 180, height: 220 }, { priority: "major" }),
  frame("filler", { x: 260, y: 20, width: 40, height: 220 }, { priority: "filler" }),
  frame("brief", { x: 320, y: 20, width: 80, height: 220 }, { priority: "brief" }),
];

const createDiff = () =>
  runLayoutKernelShadowResize({
    pageId: "page-1",
    pageBounds,
    contentBounds,
    columns,
    frames,
    sourceFrameId: "source",
    before: { x: 20, y: 20, width: 180, height: 220 },
    requested: { x: 20, y: 20, width: 220, height: 220 },
    minSize: { width: 40, height: 40 },
    baselineGridSize: 6,
  });

const assertShadowModeDiff = () => {
  const diff = createDiff();

  assert.equal(diff.shadowMode, true);
  assert.equal(diff.sourceFrameId, "source");
  assert.equal(diff.resizeDirection, "right");
  assert.equal(diff.requiredSpace, 40);
  assert(diff.geometryDifferences.some((item) => item.frameId === "source"));
};

const assertWhitespaceAndCollisionDiffs = () => {
  const diff = createDiff();

  assert(diff.whitespaceDifferences.oldCellCount >= 0);
  assert(diff.whitespaceDifferences.newCellCount >= 0);
  assert(typeof diff.whitespaceDifferences.areaDelta === "number");
  assert(diff.collisionDifferences.oldCollisionCount >= 0);
  assert(diff.collisionDifferences.newCollisionCount >= 0);
};

const assertDiagnosticsAndNoMutation = () => {
  const beforeSnapshot = LayoutTransactionEngine.analyzeLayoutSnapshot({
    pageId: "page-1",
    pageBounds,
    contentBounds,
    columns,
    frames,
  });
  const diff = createDiff();
  const afterSnapshot = LayoutTransactionEngine.analyzeLayoutSnapshot({
    pageId: "page-1",
    pageBounds,
    contentBounds,
    columns,
    frames,
  });

  assert.deepEqual(beforeSnapshot.framesById.source, afterSnapshot.framesById.source);
  assert(diff.performance.totalTimeMs >= 0);
  assert(Array.isArray(diff.constraintViolations));
  assert(Array.isArray(diff.warnings));
};

const assertDeterministicExceptTiming = () => {
  const first = createDiff();
  const second = createDiff();
  const stripTiming = (value: typeof first) => ({
    ...value,
    performance: {
      snapshotTimeMs: 0,
      constraintTimeMs: 0,
      neighborTimeMs: 0,
      spaceTimeMs: 0,
      patchTimeMs: 0,
      solveTimeMs: 0,
      diffTimeMs: 0,
      totalTimeMs: 0,
    },
  });

  assert.deepEqual(stripTiming(first), stripTiming(second));
};

assertShadowModeDiff();
assertWhitespaceAndCollisionDiffs();
assertDiagnosticsAndNoMutation();
assertDeterministicExceptTiming();

console.log("LayoutKernelAdapter tests passed: 4");
