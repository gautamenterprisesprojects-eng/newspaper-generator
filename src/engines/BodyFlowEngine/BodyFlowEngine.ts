import type { BodyFlowColumn, BodyFlowInput, BodyFlowResult } from "./BodyFlowTypes";
import {
  findNextSentenceBoundary,
  isSentenceBoundaryAt,
} from "@/engines/TypographyEngine/SentenceBoundaryEngine";

const MIN_COLUMN_COUNT = 1;
const MAX_COLUMN_COUNT = 6;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizeBodyFlowInput = (input: BodyFlowInput) => {
  const columnCount = clamp(Math.round(input.columnCount), MIN_COLUMN_COUNT, MAX_COLUMN_COUNT);
  const columnGap = Math.max(0, input.columnGap);
  const availableWidth = Math.max(0, input.availableWidth);
  const availableHeight = Math.max(0, input.availableHeight);
  const lineHeight = Math.max(0, input.lineHeight);
  const totalGapWidth = columnGap * Math.max(0, columnCount - 1);
  const columnWidth = Math.max(0, (availableWidth - totalGapWidth) / columnCount);
  const maxLinesPerColumn =
    lineHeight > 0 && availableHeight > 0 ? Math.floor(availableHeight / lineHeight) : 0;

  return {
    ...input,
    availableWidth,
    availableHeight,
    columnCount,
    columnGap,
    columnWidth,
    lineHeight,
    maxLinesPerColumn,
  };
};

export const flowBodyLines = (input: BodyFlowInput): BodyFlowResult => {
  const normalized = normalizeBodyFlowInput(input);
  const {
    wrappedLines,
    availableHeight,
    columnCount,
    columnGap,
    columnWidth,
    lineHeight,
    maxLinesPerColumn,
  } = normalized;
  const totalCapacity = maxLinesPerColumn * columnCount;
  const visibleLineCount = Math.min(wrappedLines.length, totalCapacity);
  const visibleLines = wrappedLines.slice(0, visibleLineCount);
  const remainingLines = wrappedLines.slice(visibleLineCount);

  const columns: BodyFlowColumn[] = Array.from({ length: columnCount }).map((_, columnIndex) => {
    const start = columnIndex * maxLinesPerColumn;
    const end = start + maxLinesPerColumn;
    const columnLines = visibleLines.slice(start, end);
    const x = columnIndex * (columnWidth + columnGap);

    return {
      index: columnIndex,
      x,
      y: 0,
      width: columnWidth,
      height: availableHeight,
      consumedHeight: columnLines.length * lineHeight,
      lines: columnLines.map((line, lineIndex) => ({
        text: line,
        sourceIndex: start + lineIndex,
        x,
        y: lineIndex * lineHeight,
        width: columnWidth,
        height: lineHeight,
      })),
    };
  });

  return {
    columns,
    columnWidth,
    maxLinesPerColumn,
    visibleLines,
    visibleLineCount,
    remainingLines,
    remainingLineCount: remainingLines.length,
    consumedHeight: columns.reduce((max, column) => Math.max(max, column.consumedHeight), 0),
    overflow: remainingLines.length > 0,
  };
};

export const BodyFlowEngine = {
  flowBodyLines,
};
