import { DEFAULT_PAGE_MASTER } from "@/types/page";
import { createColumnGrid } from "./ColumnGridEngine";

type TestCase = {
  name: string;
  run: () => void;
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertDefaultMasterColumns = () => {
  const columns = createColumnGrid({
    pageWidth: DEFAULT_PAGE_MASTER.width,
    contentX: DEFAULT_PAGE_MASTER.contentX,
    contentWidth: DEFAULT_PAGE_MASTER.contentWidth,
    columnCount: DEFAULT_PAGE_MASTER.columns,
    gutter: DEFAULT_PAGE_MASTER.gutter,
  });
  const firstColumn = columns[0];
  const secondColumn = columns[1];
  const lastColumn = columns[columns.length - 1];
  const rightEdge = lastColumn.x + lastColumn.width;

  assert(columns.length === 6, "default page master should return six columns");
  assert(columns.every((column) => column.width > 0), "columns should have positive widths");
  assert(firstColumn.x === DEFAULT_PAGE_MASTER.contentX, "first column should start at content x");
  assert(
    Math.abs(secondColumn.x - (firstColumn.x + firstColumn.width + DEFAULT_PAGE_MASTER.gutter)) < 0.0001,
    "columns should be separated by the master gutter",
  );
  assert(
    Math.abs(rightEdge - (DEFAULT_PAGE_MASTER.contentX + DEFAULT_PAGE_MASTER.contentWidth)) < 0.0001,
    "columns should fill the content width",
  );
};

const tests: TestCase[] = [
  {
    name: "Builds default six-column master grid",
    run: assertDefaultMasterColumns,
  },
];

export const runColumnGridTests = () => {
  for (const test of tests) {
    test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  const result = runColumnGridTests();
  console.log(`Column grid tests passed: ${result.passed}`);
}
