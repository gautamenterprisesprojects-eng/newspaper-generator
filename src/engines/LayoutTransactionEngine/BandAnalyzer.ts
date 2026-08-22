import { rectBottom, rectRight, sortRectsReadingOrder } from "./LayoutGeometry";
import type { LayoutBand, LayoutColumn, LayoutFrameSnapshot } from "./LayoutTransactionTypes";

const rangesTouchOrOverlap = (firstStart: number, firstEnd: number, secondStart: number, secondEnd: number) =>
  Math.max(firstStart, secondStart) <= Math.min(firstEnd, secondEnd);

/**
 * Groups frames by physical newspaper columns using maximum horizontal overlap.
 */
export const buildColumnBands = (
  columns: LayoutColumn[],
  frames: LayoutFrameSnapshot[],
): LayoutBand[] =>
  columns.map((column) => {
    const frameIds = frames
      .filter((frame) => !frame.hidden)
      .filter((frame) => {
        const overlap = Math.max(0, Math.min(rectRight(column), rectRight(frame)) - Math.max(column.x, frame.x));

        return overlap > 0;
      })
      .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))
      .map((frame) => frame.id);

    return {
      id: `column-${column.index}`,
      index: column.index,
      x: column.x,
      y: column.y,
      width: column.width,
      height: column.height,
      frameIds,
    };
  });

/**
 * Builds row bands from vertically touching or overlapping frame intervals.
 */
export const buildRowBands = (frames: LayoutFrameSnapshot[]): LayoutBand[] => {
  const sorted = sortRectsReadingOrder(frames.filter((frame) => !frame.hidden));
  const bands: LayoutBand[] = [];

  for (const frame of sorted) {
    const frameBottom = rectBottom(frame);
    const band = bands.find((candidate) =>
      rangesTouchOrOverlap(candidate.y, rectBottom(candidate), frame.y, frameBottom),
    );

    if (!band) {
      bands.push({
        id: `row-${bands.length + 1}`,
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        frameIds: [frame.id],
      });
      continue;
    }

    const right = Math.max(rectRight(band), rectRight(frame));
    const bottom = Math.max(rectBottom(band), frameBottom);

    band.x = Math.min(band.x, frame.x);
    band.y = Math.min(band.y, frame.y);
    band.width = right - band.x;
    band.height = bottom - band.y;
    band.frameIds = [...band.frameIds, frame.id].sort();
  }

  return bands.map((band, index) => ({
    ...band,
    id: `row-${index + 1}`,
  }));
};
