import { flowBodyLines } from "./BodyFlowEngine";

type TestCase = {
  name: string;
  run: () => void;
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const createWords = (count: number) =>
  Array.from({ length: count }).map((_, index) => `word${index + 1}`);

const createWrappedLinesFromWords = (wordCount: number, wordsPerLine = 8) => {
  const words = createWords(wordCount);
  const lines: string[] = [];

  for (let index = 0; index < words.length; index += wordsPerLine) {
    lines.push(words.slice(index, index + wordsPerLine).join(" "));
  }

  return lines;
};

const runDistributionAssertions = (wordCount: number, columnCount: number) => {
  const wrappedLines = createWrappedLinesFromWords(wordCount);
  const lineHeight = 16;
  const availableHeight = 160;
  const availableWidth = 480;
  const columnGap = 12;
  const result = flowBodyLines({
    wrappedLines,
    lineHeight,
    availableWidth,
    availableHeight,
    columnCount,
    columnGap,
  });
  const expectedColumnCount = columnCount;
  const expectedColumnWidth =
    (availableWidth - columnGap * Math.max(0, expectedColumnCount - 1)) / expectedColumnCount;
  const expectedMaxLinesPerColumn = Math.floor(availableHeight / lineHeight);
  const expectedCapacity = expectedMaxLinesPerColumn * expectedColumnCount;
  const expectedVisible = Math.min(wrappedLines.length, expectedCapacity);

  assert(result.columns.length === expectedColumnCount, "unexpected column count");
  assert(result.columnWidth === expectedColumnWidth, "unexpected column width");
  assert(result.maxLinesPerColumn === expectedMaxLinesPerColumn, "unexpected line capacity");
  assert(result.visibleLineCount === expectedVisible, "unexpected visible line count");
  assert(result.remainingLineCount === wrappedLines.length - expectedVisible, "bad remaining count");
  assert(result.overflow === wrappedLines.length > expectedCapacity, "bad overflow state");
  assert(result.visibleLines.join("|") === wrappedLines.slice(0, expectedVisible).join("|"), "bad visible lines");
  assert(
    result.remainingLines.join("|") === wrappedLines.slice(expectedVisible).join("|"),
    "bad remaining lines",
  );

  for (const column of result.columns) {
    assert(column.lines.length <= expectedMaxLinesPerColumn, "column exceeds height capacity");
    assert(column.width === expectedColumnWidth, "column width changed");
    assert(column.x === column.index * (expectedColumnWidth + columnGap), "column x mismatch");

    for (const [lineIndex, line] of column.lines.entries()) {
      assert(line.y === lineIndex * lineHeight, "line y mismatch");
      assert(line.height === lineHeight, "line height mismatch");
      assert(line.width === expectedColumnWidth, "line width mismatch");
    }
  }

  const repeated = flowBodyLines({
    wrappedLines,
    lineHeight,
    availableWidth,
    availableHeight,
    columnCount,
    columnGap,
  });

  assert(JSON.stringify(repeated) === JSON.stringify(result), "flow output is not deterministic");
};

const tests: TestCase[] = [500, 2000, 5000].flatMap((wordCount) =>
  [1, 2, 3, 4, 5, 6].map((columnCount) => ({
    name: `${wordCount} words / ${columnCount} columns`,
    run: () => runDistributionAssertions(wordCount, columnCount),
  })),
);

export const runBodyFlowTests = () => {
  for (const test of tests) {
    test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  const result = runBodyFlowTests();
  console.log(`Body flow tests passed: ${result.passed}`);
}
