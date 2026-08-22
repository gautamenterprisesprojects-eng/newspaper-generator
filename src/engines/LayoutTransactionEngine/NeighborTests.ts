import { strict as assert } from "node:assert";
import {
  LayoutTransactionEngine,
  type LayoutColumn,
  type LayoutFrameSnapshot,
  type LayoutRect,
} from "./LayoutTransactionEngine";
import { solveConstraints } from "./ConstraintSolver";
import { solveNeighbors } from "./NeighborSolver";
import { rankNeighborCandidates } from "./NeighborRanking";
import type { NeighborCandidate } from "./LayoutTransactionTypes";

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
      frame("source", { x: 20, y: 20, width: 180, height: 220 }, { priority: "major", columnStart: 1, columnSpan: 1 }),
      frame("filler", { x: 260, y: 20, width: 40, height: 220 }, { priority: "filler", columnStart: 2, columnSpan: 1 }),
      frame("brief", { x: 320, y: 20, width: 80, height: 220 }, { priority: "brief", columnStart: 2, columnSpan: 1 }),
      frame("lead", { x: 420, y: 20, width: 200, height: 220 }, { priority: "lead", columnStart: 3, columnSpan: 1 }),
      frame("locked", { x: 20, y: 260, width: 180, height: 120 }, { locked: true }),
      frame("ad", { x: 220, y: 260, width: 180, height: 120 }, { kind: "advertisement" }),
      frame("pinned", { x: 420, y: 260, width: 200, height: 120 }, { pinned: true }),
    ],
  });

const createAllowedConstraint = () =>
  solveConstraints(createSnapshot(), {
    frameId: "source",
    operation: "resize",
    delta: { width: 40 },
    minSize: { width: 40, height: 40 },
  });

const assertRanksWhitespaceBeforeStories = () => {
  const snapshot = createSnapshot();
  const solution = solveNeighbors({
    snapshot,
    constraint: createAllowedConstraint(),
    resizeRequest: {
      sourceFrameId: "source",
      direction: "right",
      requiredSpace: 40,
    },
  });

  assert.equal(solution.sourceFrameId, "source");
  assert.equal(solution.resizeDirection, "right");
  assert(solution.candidates.length > 0, "expected candidates");
  assert.equal(solution.candidates[0].kind, "whitespace");
};

const assertRanksFillerBeforeBriefAndLead = () => {
  const baseCandidate = {
    kind: "story",
    capacity: 20,
    distance: 10,
    alignmentScore: 1,
    priorityScore: 0,
    readingOrder: 1,
    reasons: [],
  } satisfies Omit<NeighborCandidate, "id" | "editorialPriority">;
  const ranked = rankNeighborCandidates([
    { ...baseCandidate, id: "lead", editorialPriority: "lead", priorityScore: 14 },
    { ...baseCandidate, id: "brief", editorialPriority: "brief", priorityScore: 11 },
    { ...baseCandidate, id: "filler", editorialPriority: "filler", priorityScore: 10 },
  ]);
  const order = ranked.map((candidate) => candidate.id);

  assert(order.indexOf("filler") < order.indexOf("brief"), "filler should rank before brief");
  assert(order.indexOf("brief") < order.indexOf("lead"), "brief should rank before lead");
};

const assertHardFilters = () => {
  const snapshot = createSnapshot();
  const belowConstraint = solveConstraints(snapshot, {
    frameId: "locked",
    operation: "resize",
    delta: { width: 10 },
  });
  const blocked = solveNeighbors({
    snapshot,
    constraint: belowConstraint,
    resizeRequest: {
      sourceFrameId: "locked",
      direction: "right",
      requiredSpace: 10,
    },
  });

  assert.equal(blocked.candidates.length, 0);
  assert.equal(blocked.remainingUnresolvedSpace, 10);

  const solution = solveNeighbors({
    snapshot,
    constraint: createAllowedConstraint(),
    resizeRequest: {
      sourceFrameId: "source",
      direction: "vertical",
      requiredSpace: 40,
    },
  });

  assert(!solution.candidates.some((candidate) => candidate.id === "ad"));
  assert(!solution.candidates.some((candidate) => candidate.id === "locked"));
  assert(!solution.candidates.some((candidate) => candidate.id === "pinned"));
  assert(solution.rejectedCandidateIds.length > 0);
};

const assertRemainingUnresolvedSpace = () => {
  const snapshot = createSnapshot();
  const solution = solveNeighbors({
    snapshot,
    constraint: createAllowedConstraint(),
    resizeRequest: {
      sourceFrameId: "source",
      direction: "right",
      requiredSpace: 10_000,
    },
  });

  assert(solution.remainingUnresolvedSpace > 0);
  assert(solution.reasons.some((reason) => reason.includes("Candidate capacity")));
};

assertRanksWhitespaceBeforeStories();
assertRanksFillerBeforeBriefAndLead();
assertHardFilters();
assertRemainingUnresolvedSpace();

console.log("NeighborSolver tests passed: 4");
