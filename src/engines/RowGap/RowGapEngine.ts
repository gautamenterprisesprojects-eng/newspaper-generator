import type { StoryPriority } from "@/types/editor";

export type RowGapPriority = StoryPriority;

export type RowGapInputRow = {
  y: number;
  height: number;
  priorities: RowGapPriority[];
};

export type RowGapDiagnostics = {
  averageRowGap: number;
  largestRowGap: number;
  rowDensityPercent: number;
};

const priorityRank: Record<RowGapPriority, number> = {
  lead: 0,
  major: 1,
  secondary: 2,
  brief: 3,
  filler: 4,
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getDominantPriority = (priorities: RowGapPriority[]): RowGapPriority =>
  [...priorities].sort((first, second) => priorityRank[first] - priorityRank[second])[0] ?? "filler";

// Ranges cut ~30% from their original values (lead: 8/12/10, major: 6/10/8,
// secondary/default: 4/8/6) per an explicit request to tighten inter-article
// spacing. getEditorialRowGap always resolves to `range.min` in this app —
// every call site passes pageUtilizationPercent: 100 — so `min` is the number
// that actually reaches the page; `max`/`target` are headroom for other callers.
const getGapRange = (upper: RowGapPriority, lower: RowGapPriority) => {
  if (upper === "lead" && (lower === "major" || lower === "secondary")) {
    return { min: 6, max: 8, target: 7 };
  }

  if (
    upper === "major" &&
    (lower === "major" || lower === "secondary" || lower === "brief" || lower === "filler")
  ) {
    return { min: 4, max: 7, target: 6 };
  }

  if (upper === "secondary" && (lower === "brief" || lower === "filler")) {
    return { min: 3, max: 6, target: 4 };
  }

  return { min: 3, max: 6, target: 4 };
};

export const getEditorialRowGap = ({
  upperPriorities,
  lowerPriorities,
  pageUtilizationPercent,
  maxGap = 12,
  gutter,
}: {
  upperPriorities: RowGapPriority[];
  lowerPriorities: RowGapPriority[];
  pageUtilizationPercent: number;
  maxGap?: number;
  gutter?: number;
}) => {
  if (typeof gutter === "number") {
    return gutter;
  }

  const upper = getDominantPriority(upperPriorities);
  const lower = getDominantPriority(lowerPriorities);
  const range = getGapRange(upper, lower);
  const denseTarget = pageUtilizationPercent >= 85 ? range.min : range.target;

  return clamp(denseTarget, range.min, Math.min(range.max, maxGap));
};

export const getEditorialRowGaps = ({
  rows,
  pageUtilizationPercent,
  maxGap = 20,
  gutter,
}: {
  rows: { priorities: RowGapPriority[] }[];
  pageUtilizationPercent: number;
  maxGap?: number;
  gutter?: number;
}) =>
  rows.slice(0, -1).map((row, index) =>
    getEditorialRowGap({
      upperPriorities: row.priorities,
      lowerPriorities: rows[index + 1].priorities,
      pageUtilizationPercent,
      maxGap,
      gutter,
    }),
  );

export const calculateRowGapDiagnostics = ({
  rows,
  contentHeight,
}: {
  rows: RowGapInputRow[];
  contentHeight: number;
}): RowGapDiagnostics => {
  const sortedRows = [...rows].sort((first, second) => first.y - second.y);
  const gaps = sortedRows.slice(0, -1).map((row, index) =>
    Math.max(0, sortedRows[index + 1].y - (row.y + row.height)),
  );
  const totalGap = gaps.reduce((sum, gap) => sum + gap, 0);
  const averageRowGap = gaps.length > 0 ? totalGap / gaps.length : 0;
  const largestRowGap = Math.max(...gaps, 0);

  return {
    averageRowGap,
    largestRowGap,
    rowDensityPercent:
      contentHeight > 0 ? clamp(((contentHeight - totalGap) / contentHeight) * 100, 0, 100) : 0,
  };
};

export const RowGapEngine = {
  calculateRowGapDiagnostics,
  getEditorialRowGap,
  getEditorialRowGaps,
};
