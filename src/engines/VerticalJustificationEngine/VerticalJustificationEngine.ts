export type VerticalJustificationLine = {
  y: number;
  height: number;
};

export type VerticalJustificationColumn<Line extends VerticalJustificationLine> = {
  y: number;
  height: number;
  lines: Line[];
};

export type VerticalJustificationInput<
  Line extends VerticalJustificationLine,
  Column extends VerticalJustificationColumn<Line>,
> = {
  columns: Column[];
  baselineGridSize?: number;
  maxAdjustmentRatio?: number;
};

export type VerticalJustificationMetric = {
  columnIndex: number;
  originalBottom: number;
  adjustedBottom: number;
  targetBottom: number;
  adjustmentRatio: number;
};

export type VerticalJustificationResult<
  Line extends VerticalJustificationLine,
  Column extends VerticalJustificationColumn<Line>,
> = {
  columns: Column[];
  metrics: VerticalJustificationMetric[];
};

const DEFAULT_MAX_ADJUSTMENT_RATIO = 0.05;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getColumnBottom = <Line extends VerticalJustificationLine>(
  column: VerticalJustificationColumn<Line>,
) => column.y + column.height;

const getLineBottom = (line: VerticalJustificationLine) => line.y + line.height;

const getOriginalLineAdvance = <Line extends VerticalJustificationLine>(
  column: VerticalJustificationColumn<Line>,
) => {
  if (column.lines.length > 1) {
    return column.lines[1].y - column.lines[0].y;
  }

  return column.lines[0]?.height ?? 0;
};

const snapAdvanceToBaseline = (
  desiredAdvance: number,
  originalAdvance: number,
  maxAdjustmentRatio: number,
  baselineGridSize?: number,
) => {
  if (!baselineGridSize || baselineGridSize <= 0) {
    return desiredAdvance;
  }

  const snappedAdvance = Math.max(
    baselineGridSize,
    Math.round(desiredAdvance / baselineGridSize) * baselineGridSize,
  );
  const adjustmentRatio = originalAdvance > 0 ? Math.abs(snappedAdvance / originalAdvance - 1) : 0;

  return adjustmentRatio <= maxAdjustmentRatio ? snappedAdvance : originalAdvance;
};

const justifyColumn = <
  Line extends VerticalJustificationLine,
  Column extends VerticalJustificationColumn<Line>,
>(
  column: Column,
  columnIndex: number,
  maxAdjustmentRatio: number,
  baselineGridSize?: number,
) => {
  if (column.lines.length <= 1) {
    const bottom = column.lines.at(-1) ? getLineBottom(column.lines[column.lines.length - 1]) : column.y;

    return {
      column,
      metric: {
        columnIndex,
        originalBottom: bottom,
        adjustedBottom: bottom,
        targetBottom: getColumnBottom(column),
        adjustmentRatio: 0,
      },
    };
  }

  const firstLineY = column.lines[0].y;
  const originalAdvance = getOriginalLineAdvance(column);
  const targetBottom = getColumnBottom(column);
  const originalBottom = getLineBottom(column.lines[column.lines.length - 1]);
  const remainingHeight = targetBottom - originalBottom;
  const remainingLines = originalAdvance > 0 ? remainingHeight / originalAdvance : 0;

  // Only apply vertical justification to reachable whitespace pockets. This
  // ceiling used to bail out entirely past 18 lines of shortfall, leaving a
  // large visible gap untouched whenever a story's real content ran shorter
  // than its box's capacity — raised twice now (18 -> 60 -> 100) so a bigger
  // gap still gets stretched as far as maxAdjustmentRatio safely allows,
  // rather than being left alone.
  if (remainingHeight <= 0 || remainingLines > 100) {
    return {
      column,
      metric: {
        columnIndex,
        originalBottom,
        adjustedBottom: originalBottom,
        targetBottom,
        adjustmentRatio: 0,
      },
    };
  }

  const desiredAdvance = (targetBottom - firstLineY) / column.lines.length;
  const adjustmentRatio =
    originalAdvance > 0 ? clamp(desiredAdvance / originalAdvance - 1, 0, maxAdjustmentRatio) : 0;
  const targetAdvance = originalAdvance * (1 + adjustmentRatio);
  const snappedAdvance = snapAdvanceToBaseline(
    targetAdvance,
    originalAdvance,
    maxAdjustmentRatio,
    baselineGridSize,
  );
  // Baseline snapping quantises the advance to whole multiples of the grid (12pt
  // by default), but getBaselineLineAdvance has already snapped a standard
  // 12pt/1.38 body down to exactly one 12pt unit. Every sub-grid stretch
  // therefore rounded straight back to originalAdvance, and the only reachable
  // step up — a full second grid unit — is a 100% jump that the ratio cap always
  // rejects. The net effect was that this entire pass could never move a line:
  // short columns kept their bottom whitespace no matter how the caps were
  // tuned. Fall back to the continuous (unsnapped) advance whenever snapping
  // fails to take up any slack. A column whose content stops short cannot both
  // sit on the shared grid and reach its own bottom, so closing the visible gap
  // wins. adjustmentRatio is already exactly the stretch needed (clamped), so a
  // one-line shortfall still only feathers by that one line's worth.
  const adjustedAdvance = snappedAdvance > originalAdvance ? snappedAdvance : targetAdvance;
  const finalAdjustmentRatio = originalAdvance > 0 ? adjustedAdvance / originalAdvance - 1 : 0;
  const adjustedLines = column.lines.map((line, lineIndex) => {
    const newY = firstLineY + lineIndex * adjustedAdvance;
    const newHeight = adjustedAdvance;
    const rawLine = line as any;
    const segments = Array.isArray(rawLine.segments)
      ? rawLine.segments.map((segment: any) => ({
          ...segment,
          y: newY,
          height: newHeight,
        }))
      : rawLine.segments;

    return {
      ...line,
      y: newY,
      height: newHeight,
      ...(segments ? { segments } : {}),
    };
  });
  const adjustedBottom = getLineBottom(adjustedLines[adjustedLines.length - 1]);

  return {
    column: {
      ...column,
      lines: adjustedLines,
    } as Column,
    metric: {
      columnIndex,
      originalBottom,
      adjustedBottom,
      targetBottom,
      adjustmentRatio: finalAdjustmentRatio,
    },
  };
};

export const justifyColumnsVertically = <
  Line extends VerticalJustificationLine,
  Column extends VerticalJustificationColumn<Line>,
>({
  columns,
  baselineGridSize,
  maxAdjustmentRatio = DEFAULT_MAX_ADJUSTMENT_RATIO,
}: VerticalJustificationInput<Line, Column>): VerticalJustificationResult<Line, Column> => {
  const safeMaxAdjustmentRatio = Math.max(0, maxAdjustmentRatio);
  const justified = columns.map((column, columnIndex) =>
    justifyColumn(column, columnIndex, safeMaxAdjustmentRatio, baselineGridSize),
  );

  return {
    columns: justified.map((item) => item.column),
    metrics: justified.map((item) => item.metric),
  };
};

export const VerticalJustificationEngine = {
  justifyColumnsVertically,
};
