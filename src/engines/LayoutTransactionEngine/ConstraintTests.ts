import { strict as assert } from "node:assert";
import {
  LayoutTransactionEngine,
  type ConstraintOperation,
  type LayoutColumn,
  type LayoutFrameSnapshot,
  type LayoutRect,
} from "./LayoutTransactionEngine";
import { solveConstraints } from "./ConstraintSolver";

const pageBounds: LayoutRect = {
  x: 0,
  y: 0,
  width: 600,
  height: 800,
};

const contentBounds: LayoutRect = {
  x: 20,
  y: 20,
  width: 560,
  height: 760,
};

const columns: LayoutColumn[] = [
  { index: 1, x: 20, y: 20, width: 170, height: 760 },
  { index: 2, x: 210, y: 20, width: 170, height: 760 },
  { index: 3, x: 400, y: 20, width: 180, height: 760 },
];

const createFrame = (
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

const createSnapshot = (extraFrames: LayoutFrameSnapshot[] = []) =>
  LayoutTransactionEngine.analyzeLayoutSnapshot({
    pageId: "page-1",
    pageBounds,
    contentBounds,
    columns,
    frames: [
      createFrame("lead", { x: 20, y: 20, width: 360, height: 220 }, { priority: "lead", columnStart: 1, columnSpan: 2 }),
      createFrame("right", { x: 400, y: 20, width: 180, height: 220 }, { columnStart: 3, columnSpan: 1 }),
      createFrame("below", { x: 20, y: 260, width: 170, height: 180 }, { priority: "brief", columnStart: 1, columnSpan: 1 }),
      ...extraFrames,
    ],
  });

const assertAllowedResize = () => {
  const result = solveConstraints(createSnapshot(), {
    frameId: "lead",
    operation: "resize",
    delta: { width: -40, height: 0 },
    minSize: { width: 180, height: 120 },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.limits.shrink.width, 180);
  assert(result.resolvedPriorities.some((priority) => priority.frameId === "right"));
};

const assertLockedRuleFirst = () => {
  const snapshot = createSnapshot([
    createFrame("locked", { x: 210, y: 260, width: 170, height: 180 }, { locked: true }),
  ]);
  const result = solveConstraints(snapshot, {
    frameId: "locked",
    operation: "move",
    delta: { x: 20 },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.blockedBy[0].rule, "locked-frame");
};

const assertAdvertisementRule = () => {
  const snapshot = createSnapshot([
    createFrame("ad", { x: 210, y: 260, width: 170, height: 180 }, { kind: "advertisement" }),
  ]);
  const result = solveConstraints(snapshot, {
    frameId: "ad",
    operation: "resize",
    delta: { width: 20 },
  });

  assert.equal(result.allowed, false);
  assert(result.blockedBy.some((blocker) => blocker.rule === "advertisement"));
};

const assertPinnedRule = () => {
  const snapshot = createSnapshot([
    createFrame("pinned", { x: 210, y: 260, width: 170, height: 180 }, { pinned: true }),
  ]);
  const result = solveConstraints(snapshot, {
    frameId: "pinned",
    operation: "move",
    delta: { y: 10 },
  });

  assert.equal(result.allowed, false);
  assert(result.blockedBy.some((blocker) => blocker.rule === "pinned-frame"));
};

const assertMarginAndSizeRules = () => {
  const margin = solveConstraints(createSnapshot(), {
    frameId: "right",
    operation: "move",
    delta: { x: 40 },
  });
  const minimum = solveConstraints(createSnapshot(), {
    frameId: "below",
    operation: "resize",
    delta: { width: -160 },
    minSize: { width: 40, height: 80 },
  });
  const maximum = solveConstraints(createSnapshot(), {
    frameId: "below",
    operation: "resize",
    delta: { width: 120 },
    maxSize: { width: 240 },
  });

  assert(margin.blockedBy.some((blocker) => blocker.rule === "page-margins"));
  assert(minimum.blockedBy.some((blocker) => blocker.rule === "minimum-size"));
  assert(maximum.blockedBy.some((blocker) => blocker.rule === "maximum-size"));
};

const assertSoftRules = () => {
  const preferred = solveConstraints(createSnapshot(), {
    frameId: "lead",
    operation: "resize",
    delta: { width: -20 },
    preferredSize: { width: 360, height: 220 },
  });
  const deletion = solveConstraints(createSnapshot(), {
    frameId: "lead",
    operation: "delete",
  });
  const autoPlacement = solveConstraints(createSnapshot(), {
    frameId: "lead",
    operation: "automatic-placement",
  });

  assert(preferred.warnings.some((warning) => warning.rule === "preferred-size"));
  assert(deletion.warnings.some((warning) => warning.rule === "editorial-priority"));
  assert(autoPlacement.reasons.some((reason) => reason.startsWith("Whitespace rule")));
};

const assertAllOperationsAreSupported = () => {
  const operations: ConstraintOperation[] = ["resize", "move", "delete", "insert", "merge", "split", "automatic-placement"];

  for (const operation of operations) {
    const result = solveConstraints(createSnapshot(), {
      frameId: "below",
      operation,
      delta: operation === "move" ? { x: 0, y: 0 } : undefined,
    });

    assert.equal(result.operation, operation);
    assert.equal(result.frameId, "below");
  }
};

assertAllowedResize();
assertLockedRuleFirst();
assertAdvertisementRule();
assertPinnedRule();
assertMarginAndSizeRules();
assertSoftRules();
assertAllOperationsAreSupported();

console.log("ConstraintSolver tests passed: 7");
