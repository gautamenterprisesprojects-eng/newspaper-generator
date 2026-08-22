import {
  createBaselineGrid,
  createBaselineTextMetrics,
  getBaselineLineAdvance,
  getPageAlignedPhase,
  snapMeasurementToBaseline,
  snapRegionToBaseline,
  snapToBaseline,
} from "./BaselineGridEngine";

type TestCase = {
  name: string;
  run: () => void;
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertOnGrid = (value: number, gridSize: number, message: string) => {
  assert(value % gridSize === 0, message);
};

const assertSnapping = () => {
  const grid = createBaselineGrid(12);

  assert(snapToBaseline(13, grid, "ceil") === 24, "ceil snap failed");
  assert(snapToBaseline(23, grid, "floor") === 12, "floor snap failed");
  assert(snapToBaseline(18, grid, "round") === 24, "round snap failed");
};

const assertTextMetrics = () => {
  const grid = createBaselineGrid(12);
  const metrics = createBaselineTextMetrics({
    y: 17,
    lineCount: 3,
    lineHeight: 16.2,
    baselineGrid: grid,
  });

  assert(metrics.startY === 24, "text start was not snapped to baseline");
  assert(metrics.lineAdvance === 12, "line advance should snap to the nearest baseline row");
  assert(metrics.height === 48, "height should be based on baseline line advance plus final line height");
  metrics.linePositions.forEach((lineY) => assertOnGrid(lineY, grid.gridSize, "line is off baseline"));
};

const assertRegionSnapping = () => {
  const grid = createBaselineGrid(12);
  const region = snapRegionToBaseline(
    {
      x: 0,
      y: 13,
      width: 120,
      height: 80,
    },
    grid,
  );

  assert(region !== null, "region should survive baseline snapping");
  if (!region) {
    return;
  }

  assert(region.y === 24, "region y should snap down into usable baseline range");
  assert(region.height === 60, "region height should end on baseline row");
  assert(getBaselineLineAdvance(12, grid) === 12, "native grid line advance failed");
};

const assertMeasurementSnapping = () => {
  const grid = createBaselineGrid(12);

  assert(snapMeasurementToBaseline(0, grid) === 0, "zero measurement should stay zero");
  assert(snapMeasurementToBaseline(56, grid, "ceil") === 60, "ceil measurement snap failed");
  assert(snapMeasurementToBaseline(56, grid, "floor") === 48, "floor measurement snap failed");
  assert(snapMeasurementToBaseline(-8, grid, "ceil") === 0, "negative measurements should clamp to zero");
};

/**
 * The property the phase exists for: two boxes at unrelated page positions must
 * put their body lines on the same page-wide rungs.
 */
const assertPageAlignedPhase = () => {
  const gridSize = 6;

  // A phase of zero is the old behaviour — rungs at multiples of the grid.
  const unphased = createBaselineGrid(gridSize);
  assert(snapToBaseline(13, unphased, "ceil") === 18, "unphased ceil snap failed");

  // Phase shifts the rungs, and snapping still lands on one of them.
  const phased = createBaselineGrid(gridSize, 2);
  assert(snapToBaseline(13, phased, "ceil") === 14, "phased ceil snap failed");
  assert(snapToBaseline(13, phased, "floor") === 8, "phased floor snap failed");
  assert(snapToBaseline(14, phased, "ceil") === 14, "a value already on a phased rung must not move");

  // Two boxes at page positions that are not a whole number of rungs apart.
  const boxAPageY = 100.5;
  const boxBPageY = 233.2;
  const gridA = createBaselineGrid(gridSize, getPageAlignedPhase(boxAPageY, gridSize));
  const gridB = createBaselineGrid(gridSize, getPageAlignedPhase(boxBPageY, gridSize));

  // Each box snaps a body start in its own local coordinates...
  const localA = snapToBaseline(37.4, gridA, "ceil");
  const localB = snapToBaseline(21.9, gridB, "ceil");

  // ...and both land on the same page-wide grid once translated to the page.
  const pageA = boxAPageY + localA;
  const pageB = boxBPageY + localB;
  const offGridA = Math.abs(pageA / gridSize - Math.round(pageA / gridSize));
  const offGridB = Math.abs(pageB / gridSize - Math.round(pageB / gridSize));
  assert(offGridA < 1e-9, `box A body start is off the page grid by ${offGridA} rungs`);
  assert(offGridB < 1e-9, `box B body start is off the page grid by ${offGridB} rungs`);

  // Without the phase they would not have — this is the defect being prevented.
  const naive = createBaselineGrid(gridSize);
  const naivePageB = boxBPageY + snapToBaseline(21.9, naive, "ceil");
  assert(
    Math.abs(naivePageB / gridSize - Math.round(naivePageB / gridSize)) > 1e-9,
    "the unphased case must be off the page grid, otherwise this test proves nothing",
  );

  // A length is not a position: it ignores phase and stays a whole multiple.
  assertOnGrid(
    snapMeasurementToBaseline(13, phased, "ceil"),
    gridSize,
    "a measurement must stay a whole multiple of the grid regardless of phase",
  );
  const phasedMetrics = createBaselineTextMetrics({
    y: 10,
    lineCount: 4,
    lineHeight: 11,
    baselineGrid: phased,
  });
  assertOnGrid(
    phasedMetrics.height,
    gridSize,
    "text-block height must stay a whole multiple of the grid regardless of phase",
  );
};

const tests: TestCase[] = [
  {
    name: "Snaps values to baseline rows",
    run: assertSnapping,
  },
  {
    name: "Pins boxes at any page position to one shared grid",
    run: assertPageAlignedPhase,
  },
  {
    name: "Creates text metrics on baseline rows",
    run: assertTextMetrics,
  },
  {
    name: "Snaps regions into baseline-safe bounds",
    run: assertRegionSnapping,
  },
  {
    name: "Snaps measurements to baseline units",
    run: assertMeasurementSnapping,
  },
];

export const runBaselineGridTests = () => {
  for (const test of tests) {
    test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  const result = runBaselineGridTests();
  console.log(`Baseline grid tests passed: ${result.passed}`);
}
