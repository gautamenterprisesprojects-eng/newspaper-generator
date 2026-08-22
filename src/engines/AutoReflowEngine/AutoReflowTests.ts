import { countOverlaps, detectNeighboringBoxes, reflowArticleBoxes } from "./AutoReflowEngine";
import type { AutoReflowBox, AutoReflowPageBounds } from "./AutoReflowTypes";

type TestCase = {
  name: string;
  run: () => void;
};

const pageBounds: AutoReflowPageBounds = {
  x: 0,
  y: 0,
  width: 600,
  height: 900,
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const getBox = (boxes: AutoReflowBox[], id: string) => {
  const box = boxes.find((item) => item.id === id);

  if (!box) {
    throw new Error(`missing box ${id}`);
  }

  return box;
};

const assertNeighborDetection = () => {
  const boxes: AutoReflowBox[] = [
    { id: "lead", x: 0, y: 0, width: 280, height: 260 },
    { id: "below", x: 0, y: 280, width: 280, height: 180 },
    { id: "right", x: 300, y: 0, width: 280, height: 260 },
  ];
  const neighbors = detectNeighboringBoxes(boxes, "lead", 20);

  assert(neighbors.some((neighbor) => neighbor.id === "below"), "below neighbor not detected");
  assert(neighbors.some((neighbor) => neighbor.id === "right"), "right neighbor not detected");
};

const assertResizeGrowthMovesAffectedBoxes = () => {
  const result = reflowArticleBoxes({
    changedBoxId: "lead",
    pageBounds,
    gap: 18,
    gridSize: 9,
    boxes: [
      { id: "lead", x: 0, y: 0, width: 280, height: 360 },
      { id: "below", x: 0, y: 280, width: 280, height: 180 },
      { id: "side", x: 300, y: 0, width: 280, height: 260 },
    ],
  });
  const below = getBox(result.boxes, "below");

  assert(below.y >= 378, "below box should move down after lead article grows");
  assert(result.movedBoxIds.includes("below"), "below box should be marked moved");
  assert(result.overlapCount === 0, "reflow should prevent overlaps after growth");
};

const assertResizeShrinkClosesGap = () => {
  const result = reflowArticleBoxes({
    changedBoxId: "lead",
    pageBounds,
    gap: 18,
    gridSize: 9,
    boxes: [
      { id: "lead", x: 0, y: 0, width: 280, height: 180 },
      { id: "below", x: 0, y: 460, width: 280, height: 180 },
    ],
  });
  const below = getBox(result.boxes, "below");

  assert(below.y === 198, "below box should move up to close the gap");
  assert(result.overlapCount === 0, "reflow should prevent overlaps after shrink");
};

const assertPageBoundariesArePreserved = () => {
  const result = reflowArticleBoxes({
    changedBoxId: "lead",
    pageBounds,
    gap: 18,
    gridSize: 9,
    boxes: [
      { id: "lead", x: 0, y: 0, width: 280, height: 840 },
      { id: "below", x: 0, y: 820, width: 280, height: 120 },
    ],
  });
  const below = getBox(result.boxes, "below");

  assert(below.x >= pageBounds.x, "box should remain inside left page boundary");
  assert(below.y >= pageBounds.y, "box should remain inside top page boundary");
  assert(below.x + below.width <= pageBounds.x + pageBounds.width, "box should remain inside right page boundary");
  assert(below.y + below.height <= pageBounds.y + pageBounds.height, "box should remain inside bottom page boundary");
};

const assertOverlapPrevention = () => {
  const result = reflowArticleBoxes({
    changedBoxId: "lead",
    pageBounds,
    gap: 18,
    gridSize: 9,
    boxes: [
      { id: "lead", x: 0, y: 0, width: 280, height: 360 },
      { id: "second", x: 0, y: 260, width: 280, height: 180 },
      { id: "third", x: 0, y: 300, width: 280, height: 180 },
    ],
  });

  assert(countOverlaps(result.boxes) === 0, "reflowed boxes should not overlap");
  assert(result.overlapCount === 0, "result overlap count should be zero");
};

const tests: TestCase[] = [
  {
    name: "Detect neighboring boxes",
    run: assertNeighborDetection,
  },
  {
    name: "Growth moves affected boxes",
    run: assertResizeGrowthMovesAffectedBoxes,
  },
  {
    name: "Shrink closes vertical gap",
    run: assertResizeShrinkClosesGap,
  },
  {
    name: "Page boundaries are preserved",
    run: assertPageBoundariesArePreserved,
  },
  {
    name: "Overlaps are prevented",
    run: assertOverlapPrevention,
  },
];

export const runAutoReflowTests = () => {
  for (const test of tests) {
    test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  const result = runAutoReflowTests();
  console.log(`Auto reflow tests passed: ${result.passed}`);
}
