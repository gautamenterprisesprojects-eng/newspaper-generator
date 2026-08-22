import { calculateEditorialDensity } from "./EditorialDensityEngine";
import type { ArticleLayoutBodyColumn } from "@/types/editor";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const createColumn = ({
  y,
  height,
  lineCount,
  lineHeight,
  capacity,
}: {
  y: number;
  height: number;
  lineCount: number;
  lineHeight: number;
  capacity: number;
}): ArticleLayoutBodyColumn => ({
  id: "region-a",
  x: 0,
  y,
  width: 120,
  height,
  columnIndex: 0,
  capacity,
  assignedLineCount: lineCount,
  remainingCapacity: Math.max(0, capacity - lineCount),
  lines: Array.from({ length: lineCount }).map((_, index) => ({
    x: 0,
    y: y + index * lineHeight,
    width: 120,
    height: lineHeight,
    text: `Line ${index + 1}`,
    style: {
      fill: "#000",
      fontFamily: "Arial",
      fontSize: 10,
      lineHeight: 1,
    },
  })),
  lineCount,
  overflow: false,
});

export const runEditorialDensityTests = () => {
  const full = calculateEditorialDensity({
    storyHeight: 240,
    storyTopPadding: 4,
    storyBottomPadding: 4,
    bodyY: 40,
    bodyHeight: 192,
    bodyColumns: [createColumn({ y: 40, height: 192, lineCount: 16, lineHeight: 12, capacity: 16 })],
    visibleLineCount: 16,
    remainingLineCount: 8,
    totalLineCapacity: 16,
  });
  const partial = calculateEditorialDensity({
    storyHeight: 240,
    storyTopPadding: 4,
    storyBottomPadding: 4,
    bodyY: 40,
    bodyHeight: 192,
    bodyColumns: [createColumn({ y: 40, height: 192, lineCount: 8, lineHeight: 12, capacity: 16 })],
    visibleLineCount: 8,
    remainingLineCount: 0,
    totalLineCapacity: 16,
  });

  assert(full.bodyFillPercent === 100, "overset body should consume all available capacity");
  assert(full.unusedVerticalSpace === 0, "overset body should have no unused vertical space");
  assert(partial.bodyFillPercent === 50, "partial body fill should reflect line capacity usage");
  assert(partial.unusedVerticalSpace === 96, "partial body should report unused lower depth");
  assert(partial.internalWhitespacePercent > 0, "partial body should expose internal whitespace");

  return {
    passed: true,
  };
};

if (require.main === module) {
  runEditorialDensityTests();
  console.log("EditorialDensityTests passed");
}
