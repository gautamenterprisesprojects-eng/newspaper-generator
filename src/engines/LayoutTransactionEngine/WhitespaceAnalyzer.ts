import { rectArea, rectBottom, rectRight } from "./LayoutGeometry";
import type {
  LayoutColumn,
  LayoutFrameSnapshot,
  LayoutRect,
  LayoutWhitespaceCell,
} from "./LayoutTransactionTypes";

const MIN_CELL_SIZE = 0.001;

const subtractRect = (source: LayoutRect, obstacle: LayoutRect): LayoutRect[] => {
  const x = Math.max(source.x, obstacle.x);
  const y = Math.max(source.y, obstacle.y);
  const right = Math.min(rectRight(source), rectRight(obstacle));
  const bottom = Math.min(rectBottom(source), rectBottom(obstacle));

  if (right <= x || bottom <= y) {
    return [source];
  }

  return [
    { x: source.x, y: source.y, width: source.width, height: y - source.y },
    { x: source.x, y, width: x - source.x, height: bottom - y },
    { x: right, y, width: rectRight(source) - right, height: bottom - y },
    { x: source.x, y: bottom, width: source.width, height: rectBottom(source) - bottom },
  ].filter((rect) => rect.width > MIN_CELL_SIZE && rect.height > MIN_CELL_SIZE);
};

const getBoundedBy = (cell: LayoutRect, frames: LayoutFrameSnapshot[]) =>
  frames
    .filter((frame) => {
      const touchesHorizontally =
        Math.abs(rectRight(frame) - cell.x) < MIN_CELL_SIZE ||
        Math.abs(frame.x - rectRight(cell)) < MIN_CELL_SIZE;
      const touchesVertically =
        Math.abs(rectBottom(frame) - cell.y) < MIN_CELL_SIZE ||
        Math.abs(frame.y - rectBottom(cell)) < MIN_CELL_SIZE;
      const verticalOverlap = Math.max(cell.y, frame.y) < Math.min(rectBottom(cell), rectBottom(frame));
      const horizontalOverlap = Math.max(cell.x, frame.x) < Math.min(rectRight(cell), rectRight(frame));

      return (touchesHorizontally && verticalOverlap) || (touchesVertically && horizontalOverlap);
    })
    .map((frame) => frame.id)
    .sort();

/**
 * Builds a deterministic whitespace map by subtracting visible frames from
 * each column rectangle. Cells are intentionally rectangular because this is a
 * geometry kernel input, not a final visual whitespace classifier.
 */
export const buildWhitespaceMap = ({
  contentBounds,
  columns,
  frames,
}: {
  contentBounds: LayoutRect;
  columns: LayoutColumn[];
  frames: LayoutFrameSnapshot[];
}): LayoutWhitespaceCell[] => {
  const visibleFrames = frames.filter((frame) => !frame.hidden);
  const cells: LayoutWhitespaceCell[] = [];

  for (const column of columns) {
    const seed = {
      x: Math.max(contentBounds.x, column.x),
      y: contentBounds.y,
      width: Math.min(rectRight(contentBounds), rectRight(column)) - Math.max(contentBounds.x, column.x),
      height: contentBounds.height,
    };
    const columnFrames = visibleFrames.filter(
      (frame) => Math.max(frame.x, seed.x) < Math.min(rectRight(frame), rectRight(seed)),
    );
    const freeRects = columnFrames.reduce<LayoutRect[]>(
      (rects, frame) => rects.flatMap((rect) => subtractRect(rect, frame)),
      seed.width > 0 ? [seed] : [],
    );

    for (const rect of freeRects) {
      if (rectArea(rect) <= MIN_CELL_SIZE) {
        continue;
      }

      cells.push({
        ...rect,
        id: `space-${cells.length + 1}`,
        columnIndex: column.index,
        boundedBy: getBoundedBy(rect, visibleFrames),
        area: rectArea(rect),
      });
    }
  }

  return cells.sort((a, b) => a.y - b.y || a.x - b.x || b.area - a.area || a.id.localeCompare(b.id));
};
