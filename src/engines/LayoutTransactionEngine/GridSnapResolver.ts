import { rectBottom, rectRight } from "./LayoutGeometry";
import type { LayoutRect, LayoutSnapshot } from "./LayoutTransactionTypes";

const snapValue = (value: number, targets: number[], tolerance: number) => {
  const target = targets
    .map((candidate) => ({ candidate, distance: Math.abs(candidate - value) }))
    .filter((item) => item.distance <= tolerance)
    .sort((a, b) => a.distance - b.distance || a.candidate - b.candidate)[0];

  return target ? target.candidate : value;
};

const snapToBaseline = (value: number, gridSize: number) =>
  Math.round(value / gridSize) * gridSize;

/** Snaps proposed geometry to margins, columns, gutters, and baseline grid. */
export const snapGeometryToGrid = (
  snapshot: LayoutSnapshot,
  proposed: Map<string, LayoutRect>,
  baselineGridSize = 6,
) => {
  const snapped = new Map<string, LayoutRect>();
  const tolerance = snapshot.gapTolerance ?? 4;
  const verticalTargets = [
    snapshot.contentBounds.x,
    rectRight(snapshot.contentBounds),
    ...snapshot.columns.flatMap((column) => [column.x, rectRight(column)]),
  ];
  const horizontalTargets = [
    snapshot.contentBounds.y,
    rectBottom(snapshot.contentBounds),
  ];

  for (const [frameId, rect] of proposed) {
    const x = snapValue(rect.x, verticalTargets, tolerance);
    const y = snapValue(snapToBaseline(rect.y, baselineGridSize), horizontalTargets, tolerance);
    const right = snapValue(rectRight(rect), verticalTargets, tolerance);
    const bottom = snapValue(snapToBaseline(rectBottom(rect), baselineGridSize), horizontalTargets, tolerance);

    snapped.set(frameId, {
      x,
      y,
      width: Math.max(1, right - x),
      height: Math.max(1, bottom - y),
    });
  }

  return snapped;
};
