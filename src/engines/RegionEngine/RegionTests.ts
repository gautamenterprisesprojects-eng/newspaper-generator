import { generateTextRegions } from "./RegionEngine";
import type { ImagePosition, RegionRect } from "./RegionTypes";

type TestCase = {
  name: string;
  run: () => void;
};

const ARTICLE_WIDTH = 600;
const ARTICLE_HEIGHT = 500;
const IMAGE_WIDTH = 220;
const IMAGE_HEIGHT = 160;
const COLUMN_GAP = 12;

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const nearlyEqual = (a: number, b: number) => Math.abs(a - b) < 0.0001;

const getImageRect = (position: ImagePosition): RegionRect => {
  const xByPosition: Record<ImagePosition, number> = {
    "top-left": 0,
    "top-center": (ARTICLE_WIDTH - IMAGE_WIDTH) / 2,
    "top-right": ARTICLE_WIDTH - IMAGE_WIDTH,
    "middle-left": 0,
    "middle-center": (ARTICLE_WIDTH - IMAGE_WIDTH) / 2,
    "middle-right": ARTICLE_WIDTH - IMAGE_WIDTH,
  };
  const yByPosition: Record<ImagePosition, number> = {
    "top-left": 0,
    "top-center": 0,
    "top-right": 0,
    "middle-left": 170,
    "middle-center": 170,
    "middle-right": 170,
  };

  return {
    x: xByPosition[position],
    y: yByPosition[position],
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
  };
};

const intersects = (a: RegionRect, b: RegionRect) =>
  Math.max(a.x, b.x) < Math.min(a.x + a.width, b.x + b.width) &&
  Math.max(a.y, b.y) < Math.min(a.y + a.height, b.y + b.height);

const assertRegionSet = (position: ImagePosition, columnCount: number) => {
  const imageRect = getImageRect(position);
  const result = generateTextRegions({
    articleWidth: ARTICLE_WIDTH,
    articleHeight: ARTICLE_HEIGHT,
    columnCount,
    columnGap: COLUMN_GAP,
    imageRect,
  });
  const expectedColumnWidth =
    (ARTICLE_WIDTH - COLUMN_GAP * Math.max(0, columnCount - 1)) / columnCount;

  assert(result.columnCount === columnCount, `${position}/${columnCount}: column count mismatch`);
  assert(result.columnWidth === expectedColumnWidth, `${position}/${columnCount}: column width mismatch`);
  assert(result.regions.length > 0, `${position}/${columnCount}: no regions generated`);

  for (const region of result.regions) {
    assert(region.width > 0, `${position}/${columnCount}: zero-width region`);
    assert(region.height > 0, `${position}/${columnCount}: zero-height region`);
    assert(region.area === region.width * region.height, `${position}/${columnCount}: bad region area`);
    assert(region.x >= 0 && region.y >= 0, `${position}/${columnCount}: negative region position`);
    assert(
      region.x + region.width <= ARTICLE_WIDTH && region.y + region.height <= ARTICLE_HEIGHT,
      `${position}/${columnCount}: region outside article`,
    );
    assert(!intersects(region, imageRect), `${position}/${columnCount}: region intersects image`);
  }

  for (let index = 1; index < result.regions.length; index += 1) {
    const previous = result.regions[index - 1];
    const current = result.regions[index];

    assert(
      previous.y < current.y || (previous.y === current.y && previous.x <= current.x),
      `${position}/${columnCount}: regions are not in reading order`,
    );
  }

  const repeated = generateTextRegions({
    articleWidth: ARTICLE_WIDTH,
    articleHeight: ARTICLE_HEIGHT,
    columnCount,
    columnGap: COLUMN_GAP,
    imageRect,
  });

  assert(
    JSON.stringify(repeated) === JSON.stringify(result),
    `${position}/${columnCount}: output is not deterministic`,
  );
};

const assertTopSideImageCreatesColumnRecoveryRegions = () => {
  const columnCount = 3;
  const columnWidth = (ARTICLE_WIDTH - COLUMN_GAP * (columnCount - 1)) / columnCount;
  const imageRect = {
    x: columnWidth + COLUMN_GAP,
    y: 0,
    width: columnWidth * 2 + COLUMN_GAP,
    height: IMAGE_HEIGHT,
  };
  const result = generateTextRegions({
    articleWidth: ARTICLE_WIDTH,
    articleHeight: ARTICLE_HEIGHT,
    columnCount,
    columnGap: COLUMN_GAP,
    imageRect,
  });

  // Column 0 never overlaps the image horizontally (the image spans columns
  // 1-2 only), so it now flows as a single continuous region for the full
  // article height instead of being needlessly split into a "side" band
  // above the image's bottom edge and a separate "recovery" band below it —
  // that fragmentation used to happen for every column just because SOME
  // column touched the image, leaving an artificial gap in columns that had
  // no obstacle in their own path. Only columns 1 and 2, which actually
  // cross the image, get the recovery-region split.
  assert(result.regions.length === 3, "expected one continuous column region plus one recovery region per overlapping column");

  const continuousColumn = result.regions.find((region) => region.columnIndex === 0);
  assert(Boolean(continuousColumn), "non-overlapping column must produce a region");
  assert(nearlyEqual(continuousColumn!.width, columnWidth), "non-overlapping column region should use column width");
  assert(nearlyEqual(continuousColumn!.y, 0), "non-overlapping column region should start at the article top");
  assert(nearlyEqual(continuousColumn!.height, ARTICLE_HEIGHT), "non-overlapping column region should span the full article height");

  const recoveryRegions = result.regions.filter((region) => region.columnIndex !== 0);
  assert(recoveryRegions.length === 2, "expected one recovery region for each column overlapping the image");
  recoveryRegions.forEach((region) => {
    assert(nearlyEqual(region.width, columnWidth), "recovery region should use column width");
    assert(
      nearlyEqual(region.y, imageRect.y + imageRect.height),
      "recovery region should start after image obstacle",
    );
  });
};

const assertTopRightImageLeavesNoUnusedColumns = (columnCount: number) => {
  const columnWidth = (ARTICLE_WIDTH - COLUMN_GAP * Math.max(0, columnCount - 1)) / columnCount;
  const imageRect = {
    x: (columnWidth + COLUMN_GAP) * (columnCount - 1),
    y: 0,
    width: columnWidth,
    height: IMAGE_HEIGHT,
  };
  const result = generateTextRegions({
    articleWidth: ARTICLE_WIDTH,
    articleHeight: ARTICLE_HEIGHT,
    columnCount,
    columnGap: COLUMN_GAP,
    imageRect,
  });
  const coveredColumns = new Set(result.regions.map((region) => region.columnIndex));

  assert(
    coveredColumns.size === columnCount,
    `${columnCount}-column story should generate text regions for every column`,
  );
};

const assertMultipleObstaclesAreRemoved = () => {
  const imageRect = {
    x: 0,
    y: 0,
    width: 180,
    height: 120,
  };
  const factBoxRect = {
    x: 420,
    y: 180,
    width: 180,
    height: 120,
  };
  const result = generateTextRegions({
    articleWidth: ARTICLE_WIDTH,
    articleHeight: ARTICLE_HEIGHT,
    columnCount: 3,
    columnGap: COLUMN_GAP,
    imageRect,
    obstacleRects: [factBoxRect],
  });

  for (const region of result.regions) {
    assert(!intersects(region, imageRect), "region intersects image obstacle");
    assert(!intersects(region, factBoxRect), "region intersects fact box obstacle");
  }

  assert(result.obstacleRects.length === 2, "expected image and fact box obstacles");
};

const positions: ImagePosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
];

const tests: TestCase[] = positions.flatMap((position) =>
  [1, 2, 3, 4, 5, 6].map((columnCount) => ({
    name: `${position} / ${columnCount} columns`,
    run: () => assertRegionSet(position, columnCount),
  })),
).concat({
  name: "Top-side image creates column recovery regions",
  run: assertTopSideImageCreatesColumnRecoveryRegions,
}, ...[2, 3, 4, 5, 6].map((columnCount) => ({
  name: `${columnCount}-column top-right image leaves no unused columns`,
  run: () => assertTopRightImageLeavesNoUnusedColumns(columnCount),
})), {
  name: "Multiple obstacles are removed from text regions",
  run: assertMultipleObstaclesAreRemoved,
});

export const runRegionTests = () => {
  for (const test of tests) {
    test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  const result = runRegionTests();
  console.log(`Region tests passed: ${result.passed}`);
}
