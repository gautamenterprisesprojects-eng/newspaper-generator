import { justifyColumnsVertically } from "./VerticalJustificationEngine";

type TestCase = {
  name: string;
  run: () => void;
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertClose = (actual: number, expected: number, message: string) => {
  if (Math.abs(actual - expected) > 0.0001) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
};

const createLines = (count: number, lineHeight: number) =>
  Array.from({ length: count }).map((_, index) => ({
    y: index * lineHeight,
    height: lineHeight,
    text: `line-${index + 1}`,
  }));

const assertExpandsColumnToTargetDepth = () => {
  const result = justifyColumnsVertically({
    columns: [
      {
        y: 0,
        height: 63,
        lines: createLines(3, 20),
      },
    ],
    maxAdjustmentRatio: 0.05,
  });

  assertClose(result.columns[0].lines[0].y, 0, "first line should stay anchored");
  assertClose(result.columns[0].lines[1].y, 21, "second line y should expand");
  assertClose(result.columns[0].lines[2].y, 42, "third line y should expand");
  assertClose(result.columns[0].lines[2].y + result.columns[0].lines[2].height, 63, "bottom should align");
};

const assertCapsAdjustment = () => {
  const result = justifyColumnsVertically({
    columns: [
      {
        y: 0,
        height: 100,
        lines: createLines(3, 20),
      },
    ],
    maxAdjustmentRatio: 0.05,
  });

  assertClose(result.metrics[0].adjustmentRatio, 0.05, "adjustment should cap at 5 percent");
  assertClose(result.columns[0].lines[1].y, 21, "line advance should be capped");
};

const assertPreservesSingleLineColumn = () => {
  const result = justifyColumnsVertically({
    columns: [
      {
        y: 0,
        height: 100,
        lines: createLines(1, 20),
      },
    ],
  });

  assertClose(result.columns[0].lines[0].y, 0, "single line y should not change");
  assertClose(result.columns[0].lines[0].height, 20, "single line height should not change");
  assertClose(result.metrics[0].adjustmentRatio, 0, "single line should not adjust");
};

const assertBaselineAwareJustification = () => {
  const result = justifyColumnsVertically({
    columns: [
      {
        y: 0,
        height: 63,
        lines: createLines(3, 24),
      },
    ],
    baselineGridSize: 12,
    maxAdjustmentRatio: 0.05,
  });

  assert(
    result.columns[0].lines.every((line) => line.y % 12 === 0 && line.height % 12 === 0),
    "baseline-aware justification must keep lines on the baseline grid",
  );
  assertClose(result.columns[0].lines[1].y, 24, "baseline-aware advance should remain a grid unit");
  assertClose(result.metrics[0].adjustmentRatio, 0, "off-grid adjustment should be rejected");
};

const assertJustifiesColumnWith2To5RemainingLines = () => {
  const result = justifyColumnsVertically({
    columns: [
      {
        y: 0,
        height: 100, // fits 5 lines of 20px
        lines: createLines(3, 20), // 3 lines = 60px consumed, 40px (2 lines) remaining space
      },
    ],
    maxAdjustmentRatio: 0.03,
  });

  const adjustedLineHeight = result.columns[0].lines[0].height;
  assert(adjustedLineHeight > 20, "line height should expand when 2-5 lines remain");
  assert(adjustedLineHeight <= 20.6, "line height expansion should be capped at +3%");
};

const tests: TestCase[] = [
  {
    name: "Expands line spacing to align bottom",
    run: assertExpandsColumnToTargetDepth,
  },
  {
    name: "Caps line spacing adjustment",
    run: assertCapsAdjustment,
  },
  {
    name: "Preserves single-line columns",
    run: assertPreservesSingleLineColumn,
  },
  {
    name: "Keeps justified lines on the baseline grid when requested",
    run: assertBaselineAwareJustification,
  },
  {
    name: "Justifies column with 2-5 remaining blank lines",
    run: assertJustifiesColumnWith2To5RemainingLines,
  },
];

export const runVerticalJustificationTests = () => {
  for (const test of tests) {
    test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  const result = runVerticalJustificationTests();
  console.log(`Vertical justification tests passed: ${result.passed}`);
}
