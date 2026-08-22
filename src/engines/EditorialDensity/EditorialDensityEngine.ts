import type { ArticleLayoutBodyColumn } from "@/types/editor";

export type EditorialDensityInput = {
  storyHeight: number;
  storyTopPadding: number;
  storyBottomPadding: number;
  bodyY: number;
  bodyHeight: number;
  bodyColumns: ArticleLayoutBodyColumn[];
  visibleLineCount: number;
  remainingLineCount: number;
  totalLineCapacity: number;
};

export type EditorialDensityResult = {
  bodyFillPercent: number;
  unusedVerticalSpace: number;
  storyDensityPercent: number;
  internalWhitespacePercent: number;
};

const roundTenth = (value: number) => Math.round(value * 10) / 10;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getColumnUsedBottom = (column: ArticleLayoutBodyColumn) =>
  column.lines.reduce(
    (bottom, line) => Math.max(bottom, line.y + line.height),
    column.y,
  );

export const calculateEditorialDensity = ({
  storyHeight,
  storyTopPadding,
  storyBottomPadding,
  bodyY,
  bodyHeight,
  bodyColumns,
  visibleLineCount,
  remainingLineCount,
  totalLineCapacity,
}: EditorialDensityInput): EditorialDensityResult => {
  const contentHeight = Math.max(1, storyHeight - storyTopPadding - storyBottomPadding);
  const bodyBottom = bodyY + bodyHeight;
  const deepestBodyBottom = bodyColumns.reduce(
    (bottom, column) => Math.max(bottom, getColumnUsedBottom(column)),
    bodyY,
  );
  const unusedVerticalSpace =
    remainingLineCount > 0
      ? 0
      : Math.max(0, bodyBottom - deepestBodyBottom);
  const bodyFillPercent =
    totalLineCapacity > 0
      ? clamp((visibleLineCount / totalLineCapacity) * 100, 0, 100)
      : 0;
  const usedStoryHeight = clamp(deepestBodyBottom - storyTopPadding, 0, contentHeight);
  const storyDensityPercent = clamp((usedStoryHeight / contentHeight) * 100, 0, 100);
  const internalWhitespacePercent = clamp(100 - storyDensityPercent, 0, 100);

  return {
    bodyFillPercent: roundTenth(remainingLineCount > 0 ? 100 : bodyFillPercent),
    unusedVerticalSpace: roundTenth(unusedVerticalSpace),
    storyDensityPercent: roundTenth(storyDensityPercent),
    internalWhitespacePercent: roundTenth(internalWhitespacePercent),
  };
};

export const EditorialDensityEngine = {
  calculateEditorialDensity,
};
