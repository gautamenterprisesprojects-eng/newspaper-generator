import { strict as assert } from "node:assert";
import { LayoutTransactionEngine } from "./LayoutTransactionEngine";
import { buildLayoutCluster } from "./LayoutClusterBuilder";
import { solveRegionFlow } from "./RegionFlowSolver";
import { applyVerticalCascade } from "./VerticalCascade";
import { eliminateWhitespace } from "./WhitespaceEliminator";
import type { LayoutColumn, LayoutFrameSnapshot, LayoutRect } from "./LayoutTransactionTypes";

const pageBounds: LayoutRect = { x: 0, y: 0, width: 640, height: 820 };
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
      frame("lead", { x: 20, y: 20, width: 180, height: 160 }, { columnStart: 1, columnSpan: 1 }),
      frame("brief", { x: 20, y: 220, width: 180, height: 120 }, { columnStart: 1, columnSpan: 1 }),
      frame("side", { x: 220, y: 20, width: 180, height: 160 }, { columnStart: 2, columnSpan: 1 }),
      frame("locked", { x: 420, y: 20, width: 200, height: 160 }, { locked: true, columnStart: 3, columnSpan: 1 }),
      frame("ad", { x: 20, y: 520, width: 180, height: 120 }, { kind: "advertisement" }),
    ],
  });

const assertClusterStopsAtImmutableFrames = () => {
  const cluster = buildLayoutCluster({
    snapshot: createSnapshot(),
    sourceFrameId: "lead",
  });

  assert(cluster.frameIds.includes("lead"));
  assert(cluster.frameIds.includes("brief"));
  assert(cluster.frameIds.includes("side"));
  assert(!cluster.frameIds.includes("locked"));
  assert(!cluster.frameIds.includes("ad"));
  assert(cluster.boundaries.some((boundary) => boundary.frameId === "locked" && boundary.reason === "locked-frame"));
};

const assertVerticalCascadeRemovesFloatingGap = () => {
  const cluster = buildLayoutCluster({
    snapshot: createSnapshot(),
    sourceFrameId: "lead",
  });
  const cascaded = applyVerticalCascade({
    cluster,
    rects: {
      lead: { x: 20, y: 20, width: 180, height: 200 },
      brief: { x: 20, y: 260, width: 180, height: 120 },
      side: { x: 220, y: 20, width: 180, height: 160 },
    },
  });

  assert.equal(cascaded.brief.y, 220);
};

const assertWhitespaceEliminatorExpandsNearestStory = () => {
  const cluster = buildLayoutCluster({
    snapshot: createSnapshot(),
    sourceFrameId: "lead",
  });
  const result = eliminateWhitespace({
    cluster,
    rects: {
      lead: { x: 20, y: 20, width: 180, height: 160 },
      brief: { x: 20, y: 220, width: 180, height: 120 },
      side: { x: 220, y: 20, width: 180, height: 160 },
    },
  });

  assert.equal(result.rects.lead.height, 200);
  assert(result.eliminatedArea > 0);
};

const assertRegionFlowBalancesCluster = () => {
  const snapshot = createSnapshot();
  const cluster = buildLayoutCluster({
    snapshot,
    sourceFrameId: "lead",
  });
  const result = solveRegionFlow({
    cluster,
    contentBounds,
    columns,
    proposedRects: {
      lead: { x: 20, y: 20, width: 180, height: 220 },
    },
  });

  assert(result.changedFrameIds.includes("lead"));
  assert(result.changedFrameIds.includes("brief"));
  assert.equal(result.after.brief.y, 240);
  assert(result.metrics.changedFrameCount >= 2);
};

assertClusterStopsAtImmutableFrames();
assertVerticalCascadeRemovesFloatingGap();
assertWhitespaceEliminatorExpandsNearestStory();
assertRegionFlowBalancesCluster();

console.log("Layout cluster and region flow tests passed: 4");
