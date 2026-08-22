import { strict as assert } from "node:assert";
import {
  LayoutTransactionEngine,
  type LayoutColumn,
  type LayoutFrameSnapshot,
  type LayoutRect,
} from "./LayoutTransactionEngine";

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

const frames = [
  createFrame("lead", { x: 20, y: 20, width: 360, height: 220 }, { priority: "lead", columnStart: 1, columnSpan: 2 }),
  createFrame("right", { x: 400, y: 20, width: 180, height: 220 }, { columnStart: 3, columnSpan: 1 }),
  createFrame("below-left", { x: 20, y: 260, width: 170, height: 180 }, { columnStart: 1, columnSpan: 1 }),
  createFrame("below-mid", { x: 210, y: 260, width: 170, height: 180 }, { columnStart: 2, columnSpan: 1 }),
  createFrame("ad-1", { x: 400, y: 260, width: 180, height: 120 }, { kind: "advertisement" }),
];

const createSnapshot = () =>
  LayoutTransactionEngine.analyzeLayoutSnapshot({
    pageId: "page-1",
    pageBounds,
    contentBounds,
    columns,
    frames,
  });

const assertSnapshotAnalyzer = () => {
  const snapshot = createSnapshot();

  assert.equal(snapshot.visibleFrames.length, frames.length);
  assert.equal(snapshot.framesById.lead.id, "lead");
  assert(snapshot.version.includes("lead"), "snapshot version should include frame identity");
  assert.equal(snapshot.columnBands.length, 3);
  assert.equal(snapshot.rowBands.length, 2);
};

const assertNeighborGraph = () => {
  const graph = createSnapshot().neighborGraph;

  assert.equal(graph.nodes.lead.right[0]?.to, "right");
  assert.equal(graph.nodes.right.left[0]?.to, "lead");
  assert.equal(graph.nodes.lead.bottom[0]?.to, "below-left");
  assert.equal(graph.nodes["below-left"].right[0]?.to, "below-mid");
  assert(graph.nodes.lead.right[0].sharedSpan > 0, "neighbor edge should expose shared span");
};

const assertWhitespaceMap = () => {
  const snapshot = createSnapshot();
  const lowerWhiteSpace = snapshot.whitespaceMap.filter((cell) => cell.y >= 380);

  assert(lowerWhiteSpace.length >= 3, "expected free cells below story rows");
  assert(snapshot.whitespaceMap.every((cell) => cell.area > 0), "whitespace cells must have area");
  assert(
    snapshot.whitespaceMap.some((cell) => cell.boundedBy.includes("below-left")),
    "cells should identify bounding frames",
  );
};

const assertBandAnalyzers = () => {
  const snapshot = createSnapshot();

  assert.deepEqual(snapshot.columnBands[0].frameIds, ["lead", "below-left"]);
  assert(snapshot.columnBands[2].frameIds.includes("ad-1"), "ad should appear in its column band");
  assert.deepEqual(snapshot.rowBands[0].frameIds.sort(), ["lead", "right"]);
  assert.deepEqual(snapshot.rowBands[1].frameIds.sort(), ["ad-1", "below-left", "below-mid"]);
};

const assertTransactionValidation = () => {
  const snapshot = createSnapshot();
  const lead = snapshot.framesById.lead;
  const transaction = LayoutTransactionEngine.createLayoutTransaction({
    snapshot,
    sourceFrameId: "lead",
    kind: "resize",
    patches: [
      {
        frameId: "lead",
        before: lead,
        after: { x: 20, y: 20, width: 350, height: 220 },
        reason: "source-resize",
      },
    ],
  });

  assert(LayoutTransactionEngine.validateLayoutTransaction(snapshot, transaction).valid);

  const ad = snapshot.framesById["ad-1"];
  const invalid = LayoutTransactionEngine.createLayoutTransaction({
    snapshot,
    sourceFrameId: "ad-1",
    kind: "resize",
    patches: [
      {
        frameId: "ad-1",
        before: ad,
        after: { ...ad, width: ad.width + 20 },
        reason: "source-resize",
      },
    ],
  });
  const result = LayoutTransactionEngine.validateLayoutTransaction(snapshot, invalid);

  assert.equal(result.valid, false);
  assert(result.issues.some((issue) => issue.code === "advertisement-mutated"));
};

const assertOverlapValidation = () => {
  const snapshot = createSnapshot();
  const belowLeft = snapshot.framesById["below-left"];
  const transaction = LayoutTransactionEngine.createLayoutTransaction({
    snapshot,
    sourceFrameId: "below-left",
    kind: "move",
    patches: [
      {
        frameId: "below-left",
        before: belowLeft,
        after: { x: 210, y: 260, width: 170, height: 180 },
        reason: "source-move",
      },
    ],
  });
  const result = LayoutTransactionEngine.validateLayoutTransaction(snapshot, transaction);

  assert.equal(result.valid, false);
  assert(result.issues.some((issue) => issue.code === "overlap"));
};

assertSnapshotAnalyzer();
assertNeighborGraph();
assertWhitespaceMap();
assertBandAnalyzers();
assertTransactionValidation();
assertOverlapValidation();

console.log("LayoutTransactionEngine tests passed: 6");
