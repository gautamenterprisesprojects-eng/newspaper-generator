export type BaselineSnapMode = "floor" | "ceil" | "round";

export type BaselineGrid = {
  gridSize: number;
  /**
   * Phase of the grid, in the same coordinate space as the values being snapped.
   * Rungs sit at `offset + k * gridSize` rather than at multiples of `gridSize`.
   *
   * An article composes in box-local coordinates, so with no phase every box
   * starts its own grid at its own top edge. Two boxes whose page positions
   * differ by anything other than a whole number of rungs then run their body
   * text on two different grids, and the lines in adjacent columns do not line
   * up — the defect a baseline grid exists to prevent. Setting the phase to the
   * box's offset within the page grid pins every box to the one page-wide set
   * of rungs, which is what makes columns align rung for rung.
   *
   * Applies to positions only. A length (a height, a measured block) is a
   * distance between rungs, not a place on the page, so it stays a whole
   * multiple of `gridSize` regardless of phase — see `withoutPhase`.
   */
  offset?: number;
};

/**
 * The same grid with its phase dropped, for snapping lengths rather than
 * positions.
 */
const withoutPhase = (baselineGrid: BaselineGrid): BaselineGrid => ({
  gridSize: baselineGrid.gridSize,
});

/**
 * Phase that pins a box composing in its own local coordinates to the page-wide
 * grid. `boxPageY` is the box's top edge in page coordinates.
 */
export const getPageAlignedPhase = (boxPageY: number, baselineGridSize: number) => {
  const size = Math.max(1, baselineGridSize);
  return ((-boxPageY % size) + size) % size;
};

export type BaselineTextMetrics = {
  startY: number;
  lineAdvance: number;
  height: number;
  linePositions: number[];
};

export const DEFAULT_BASELINE_GRID_SIZE = 12;

export const createBaselineGrid = (
  baselineGridSize = DEFAULT_BASELINE_GRID_SIZE,
  offset = 0,
): BaselineGrid => ({
  gridSize: Math.max(1, baselineGridSize),
  offset,
});

export const snapToBaseline = (
  value: number,
  baselineGrid: BaselineGrid,
  mode: BaselineSnapMode = "ceil",
) => {
  const offset = baselineGrid.offset ?? 0;
  const scaled = (value - offset) / baselineGrid.gridSize;

  if (mode === "floor") {
    return Math.floor(scaled) * baselineGrid.gridSize + offset;
  }

  if (mode === "round") {
    return Math.round(scaled) * baselineGrid.gridSize + offset;
  }

  return Math.ceil(scaled) * baselineGrid.gridSize + offset;
};

export const getBaselineLineAdvance = (lineHeight: number, baselineGrid: BaselineGrid) =>
  Math.max(
    baselineGrid.gridSize,
    Math.round(lineHeight / baselineGrid.gridSize) * baselineGrid.gridSize,
  );

export const snapMeasurementToBaseline = (
  value: number,
  baselineGrid: BaselineGrid,
  mode: BaselineSnapMode = "ceil",
) => Math.max(0, snapToBaseline(Math.max(0, value), withoutPhase(baselineGrid), mode));

export const createBaselineTextMetrics = ({
  y,
  lineCount,
  lineHeight,
  baselineGrid,
}: {
  y: number;
  lineCount: number;
  lineHeight: number;
  baselineGrid: BaselineGrid;
}): BaselineTextMetrics => {
  const safeLineCount = Math.max(0, lineCount);
  const startY = snapToBaseline(y, baselineGrid, "ceil");
  const lineAdvance = getBaselineLineAdvance(lineHeight, baselineGrid);
  const linePositions = Array.from({ length: safeLineCount }).map(
    (_, index) => startY + index * lineAdvance,
  );

  // A height is a length, not a position on the page, so it snaps to a whole
  // number of rungs and ignores the grid's phase.
  const rawHeight = safeLineCount > 0 ? (safeLineCount - 1) * lineAdvance + lineHeight : 0;
  const height = snapToBaseline(rawHeight, withoutPhase(baselineGrid), "ceil");

  return {
    startY,
    lineAdvance,
    height,
    linePositions,
  };
};

export const snapRegionToBaseline = <Region extends { y: number; height: number }>(
  region: Region,
  baselineGrid: BaselineGrid,
): Region | null => {
  const y = snapToBaseline(region.y, baselineGrid, "ceil");
  const bottom = snapToBaseline(region.y + region.height, baselineGrid, "floor");
  const height = bottom - y;

  if (height <= 0) {
    return null;
  }

  return {
    ...region,
    y,
    height,
  };
};

export const BaselineGridEngine = {
  DEFAULT_BASELINE_GRID_SIZE,
  createBaselineGrid,
  createBaselineTextMetrics,
  getBaselineLineAdvance,
  getPageAlignedPhase,
  snapMeasurementToBaseline,
  snapRegionToBaseline,
  snapToBaseline,
};
