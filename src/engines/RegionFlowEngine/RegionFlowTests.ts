import { generateTextRegions } from "@/engines/RegionEngine/RegionEngine";
import { flowLinesThroughRegions } from "./RegionFlowEngine";

type TestCase = {
  name: string;
  run: () => void;
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const createLines = (count: number) =>
  Array.from({ length: count }).map((_, index) => `line-${index + 1}`);

const createRegion = ({
  order,
  columnIndex,
  x,
  y,
  width,
  height,
}: {
  order: number;
  columnIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}) => ({
  order,
  columnIndex,
  x,
  y,
  width,
  height,
  area: width * height,
});

const assertRegionFlow = () => {
  const regions = generateTextRegions({
    articleWidth: 600,
    articleHeight: 500,
    columnCount: 3,
    columnGap: 12,
    imageRect: {
      x: 190,
      y: 0,
      width: 220,
      height: 160,
    },
  }).regions;
  const lineHeight = 20;
  const wrappedLines = createLines(80);
  const result = flowLinesThroughRegions({
    wrappedLines,
    regions,
    lineHeight,
  });

  assert(result.regions[0].id === "Region A", "first region should be Region A");
  assert(result.regions[1].id === "Region C", "second region should continue column 1");
  assert(result.regions[2].id === "Region D", "third region should move to column 2");
  assert(result.regions[0].region.x === 0 && result.regions[0].region.y === 0, "Region A should be left top");
  assert(result.regions[1].region.x === 0, "Region C should stay in column 1");
  assert(result.regions[1].region.y > result.regions[0].region.y, "Region C should be below Region A");
  assert(result.regions[2].region.columnIndex === 1, "Region D should be in column 2");

  const flattened = result.regions.flatMap((region) => region.lines.map((line) => line.text));

  assert(flattened.join("|") === result.visibleLines.join("|"), "visible lines are not region order");
  assert(result.visibleLines[0] === "line-1", "flow must start with first line");
  assert(result.regions[0].lines.at(-1)?.text === "line-8", "Region A should consume first 8 lines");
  assert(result.regions[1].lines[0]?.text === "line-9", "Region C should continue after Region A");
  assert(
    result.regions.every((region) => region.lines.length <= region.maxLines),
    "a region exceeded its max line capacity",
  );
  assert(
    result.regions.every((region) => region.assignedLineCount === region.lines.length),
    "assigned line count does not match rendered region lines",
  );
  assert(
    result.regions.every(
      (region) => region.remainingCapacity === region.maxLines - region.assignedLineCount,
    ),
    "remaining capacity is not derived from region capacity and assigned lines",
  );
  assert(
    result.totalCapacity === result.regions.reduce((sum, region) => sum + region.maxLines, 0),
    "total capacity does not match region capacities",
  );
  assert(
    result.regions.every((region) =>
      region.lines.every((line, index) => line.y === region.region.y + index * lineHeight),
    ),
    "line y positions are not deterministic",
  );

  const repeated = flowLinesThroughRegions({
    wrappedLines,
    regions,
    lineHeight,
  });

  assert(JSON.stringify(repeated) === JSON.stringify(result), "region flow is not deterministic");
};

const assertOverflow = () => {
  const result = flowLinesThroughRegions({
    wrappedLines: createLines(200),
    lineHeight: 50,
    regions: [
      createRegion({
        order: 0,
        columnIndex: 0,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      }),
      createRegion({
        order: 1,
        columnIndex: 1,
        x: 120,
        y: 0,
        width: 100,
        height: 100,
      }),
    ],
  });

  assert(result.visibleLineCount === 4, "expected four visible lines");
  assert(result.overflow, "expected overflow");
  assert(result.remainingLineCount === 196, "expected remaining lines");
  assert(
    result.regions.every(
      (region) => region.maxLines === 0 || region.assignedLineCount === region.maxLines,
    ),
    "overflow means every available region must be full",
  );
  assert(
    result.consumedRegionCount === result.usableRegionCount,
    "overflow means every usable region must be consumed",
  );
  assert(result.totalCapacity === 4, "expected total capacity");
};

const assertNoDiscardedLines = () => {
  const result = flowLinesThroughRegions({
    wrappedLines: createLines(9),
    lineHeight: 10,
    regions: [
      createRegion({
        order: 0,
        columnIndex: 0,
        x: 0,
        y: 0,
        width: 100,
        height: 30,
      }),
      createRegion({
        order: 1,
        columnIndex: 1,
        x: 110,
        y: 0,
        width: 100,
        height: 70,
      }),
    ],
  });

  assert(!result.overflow, "expected all lines to fit");
  assert(result.remainingLineCount === 0, "no-overflow flow cannot keep remaining lines");
  assert(result.visibleLineCount === 9, "all source lines should be visible");
  assert(result.consumedRegionCount === 2, "both usable regions should be consumed");
  assert(
    result.regions.reduce((sum, region) => sum + region.assignedLineCount, 0) ===
      result.visibleLineCount,
    "region assignments do not add up to visible lines",
  );
  assert(result.regions[1].assignedLineCount === 6, "second region should receive remaining text");
};

const assertSequentialColumnThreading = (columnCount: number) => {
  const lineHeight = 10;
  const linesPerColumn = 4;
  const result = flowLinesThroughRegions({
    wrappedLines: createLines(columnCount * linesPerColumn),
    lineHeight,
    regions: Array.from({ length: columnCount }).map((_, columnIndex) =>
      createRegion({
        order: columnIndex,
        columnIndex,
        x: columnIndex * 120,
        y: 0,
        width: 100,
        height: lineHeight * linesPerColumn,
      }),
    ),
  });

  assert(!result.overflow, `${columnCount} columns should fit all source lines`);
  assert(result.usableRegionCount === columnCount, `${columnCount} usable regions expected`);
  assert(result.consumedRegionCount === columnCount, `${columnCount} consumed regions expected`);

  result.regions.forEach((region, index) => {
    const expectedFirstLine = `line-${index * linesPerColumn + 1}`;
    const expectedLastLine = `line-${(index + 1) * linesPerColumn}`;

    assert(region.region.columnIndex === index, `region ${index + 1} should map to column ${index + 1}`);
    assert(
      region.assignedLineCount === linesPerColumn,
      `column ${index + 1} should fill before the next column starts`,
    );
    assert(region.lines[0]?.text === expectedFirstLine, `column ${index + 1} first line mismatch`);
    assert(region.lines.at(-1)?.text === expectedLastLine, `column ${index + 1} last line mismatch`);
  });
};

const assertUsabilityFiltering = () => {
  const result = flowLinesThroughRegions({
    wrappedLines: createLines(9),
    lineHeight: 10,
    usabilityRules: {
      minRegionWidth: 80,
      minRegionLines: 4,
    },
    regions: [
      createRegion({
        order: 0,
        columnIndex: 0,
        x: 0,
        y: 0,
        width: 100,
        height: 40,
      }),
      createRegion({
        order: 1,
        columnIndex: 1,
        x: 110,
        y: 0,
        width: 24,
        height: 80,
      }),
      createRegion({
        order: 2,
        columnIndex: 2,
        x: 150,
        y: 0,
        width: 100,
        height: 60,
      }),
    ],
  });

  assert(result.usableRegionCount === 2, "expected two usable regions");
  assert(result.consumedRegionCount === 2, "text should consume every needed usable region");
  assert(result.discardedRegionCount === 1, "expected one discarded region");
  assert(result.discardedRegions[0].id === "Region B", "narrow region should be discarded");
  assert(
    result.discardedRegions[0].discardReasons.includes("min-width"),
    "discarded region should expose min-width reason",
  );
  assert(result.regions[0].assignedLineCount === 4, "first usable region should be filled");
  assert(result.regions[1].assignedLineCount === 5, "text should continue into next usable region");
  assert(result.regions[1].lines[0]?.text === "line-5", "discarded region should receive no text");
  assert(!result.overflow, "usable regions should fit all source lines");
  assert(result.remainingLineCount === 0, "no text should remain after usable capacity is used");
};

const assertBaselineUnitPlacement = () => {
  const baselineGridSize = 12;
  const result = flowLinesThroughRegions({
    wrappedLines: createLines(10),
    lineHeight: baselineGridSize * 2,
    regions: [
      createRegion({
        order: 0,
        columnIndex: 0,
        x: 0,
        y: baselineGridSize * 3,
        width: 160,
        height: baselineGridSize * 8,
      }),
    ],
  });

  assert(
    result.regions[0].lines.every((line) => line.y % baselineGridSize === 0),
    "region flow line y positions should remain on baseline rows when given baseline units",
  );
  assert(result.regions[0].maxLines === 4, "baseline region capacity should use whole line units");
  assert(result.remainingLineCount === 6, "remaining lines should reflect baseline capacity");
};

const tests: TestCase[] = [
  {
    name: "Top-center image flows left, right, then lower regions",
    run: assertRegionFlow,
  },
  {
    name: "Overflow returns remaining lines",
    run: assertOverflow,
  },
  {
    name: "Two-column stories thread column 1 then column 2",
    run: () => assertSequentialColumnThreading(2),
  },
  {
    name: "Three-column stories thread columns 1, 2, then 3",
    run: () => assertSequentialColumnThreading(3),
  },
  {
    name: "Four-column stories thread columns 1, 2, 3, then 4",
    run: () => assertSequentialColumnThreading(4),
  },
  {
    name: "No lines are discarded while regions have capacity",
    run: assertNoDiscardedLines,
  },
  {
    name: "Region usability filtering skips narrow strips",
    run: assertUsabilityFiltering,
  },
  {
    name: "Places flowed lines on baseline rows when using baseline units",
    run: assertBaselineUnitPlacement,
  },
];

export const runRegionFlowTests = () => {
  for (const test of tests) {
    test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  const result = runRegionFlowTests();
  console.log(`Region flow tests passed: ${result.passed}`);
}
