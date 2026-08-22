import type { StoryColumnSpan, StoryFrame, StoryFrameId, StoryPriority } from "@/types/editor";
import { getEditorialRowGaps } from "@/engines/RowGap/RowGapEngine";
import type { StorySpanRebalanceBounds } from "./StorySpanRebalanceEngine";
import { getStorySpanGeometry } from "./StorySpanEngine";

export type EditorialRow = {
  y: number;
  height: number;
  stories: StoryFrame[];
  inserted?: boolean;
};

export type RowReflowResult =
  | {
      success: true;
      rows: EditorialRow[];
      reflowed: boolean;
    }
  | {
      success: false;
      message: string;
    };

const ROW_TOLERANCE = 1;

const priorityMoveRank: Record<StoryPriority, number> = {
  filler: 0,
  brief: 1,
  secondary: 2,
  major: 3,
  lead: 4,
};

const priorityExpandRank: Record<StoryPriority, number> = {
  lead: 0,
  major: 1,
  secondary: 2,
  brief: 3,
  filler: 4,
};

const minSpanByPriority: Record<StoryPriority, StoryColumnSpan> = {
  lead: 4,
  major: 2,
  secondary: 1,
  brief: 1,
  filler: 1,
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const toStoryColumnSpan = (value: number): StoryColumnSpan =>
  clamp(Math.round(value), 1, 6) as StoryColumnSpan;

const getMinSpan = (story: StoryFrame) => minSpanByPriority[story.priority];

const getRowTotal = (row: EditorialRow) =>
  row.stories.reduce((sum, story) => sum + story.columnSpan, 0);

const getDistance = (first: StoryFrame, second: StoryFrame) =>
  Math.abs(first.columnStart - second.columnStart);

export const groupStoriesIntoRows = (stories: StoryFrame[]): EditorialRow[] => {
  const rows: EditorialRow[] = [];

  for (const story of [...stories].sort((first, second) => first.y - second.y || first.x - second.x)) {
    const row = rows.find((candidate) => Math.abs(candidate.y - story.y) <= ROW_TOLERANCE);

    if (row) {
      row.stories.push(story);
      row.height = Math.max(row.height, story.height);
      continue;
    }

    rows.push({
      y: story.y,
      height: story.height,
      stories: [story],
    });
  }

  return rows
    .sort((first, second) => first.y - second.y)
    .map((row) => ({
      ...row,
      stories: row.stories.sort((first, second) => first.x - second.x),
    }));
};

const shrinkRowToFit = (row: EditorialRow, selectedStory: StoryFrame, columnCount: number) => {
  let total = getRowTotal(row);

  while (total > columnCount) {
    const candidate = row.stories
      .filter((story) => story.id !== selectedStory.id && story.columnSpan > getMinSpan(story))
      .sort((first, second) => {
        const rankDelta = priorityMoveRank[first.priority] - priorityMoveRank[second.priority];

        if (rankDelta !== 0) {
          return rankDelta;
        }

        return getDistance(first, selectedStory) - getDistance(second, selectedStory);
      })[0];

    if (!candidate) {
      break;
    }

    candidate.columnSpan = toStoryColumnSpan(candidate.columnSpan - 1);
    total -= 1;
  }

  return total <= columnCount;
};

const pickStoryToMove = (row: EditorialRow, selectedStoryId: StoryFrameId) =>
  row.stories
    .filter((story) => story.id !== selectedStoryId)
    .sort((first, second) => {
      const rankDelta = priorityMoveRank[first.priority] - priorityMoveRank[second.priority];

      if (rankDelta !== 0) {
        return rankDelta;
      }

      return first.columnSpan - second.columnSpan;
    })[0] ?? null;

const moveLowestPriorityStoryToNextRow = (
  rows: EditorialRow[],
  rowIndex: number,
  selectedStoryId: StoryFrameId,
) => {
  const row = rows[rowIndex];
  const movable = pickStoryToMove(row, selectedStoryId);

  if (!movable) {
    return false;
  }

  row.stories = row.stories.filter((story) => story.id !== movable.id);

  if (!rows[rowIndex + 1]) {
    rows.splice(rowIndex + 1, 0, {
      y: row.y + row.height,
      height: Math.max(160, movable.height),
      stories: [],
      inserted: true,
    });
  }

  rows[rowIndex + 1].stories.unshift(movable);

  return true;
};

const mergeRowsForward = (rows: EditorialRow[], columnCount: number) => {
  let merged = false;

  for (let index = 0; index < rows.length - 1; index += 1) {
    const row = rows[index];
    const nextRow = rows[index + 1];
    let total = getRowTotal(row);
    const movableStories = [...nextRow.stories].sort((first, second) => {
      const rankDelta = priorityMoveRank[first.priority] - priorityMoveRank[second.priority];

      if (rankDelta !== 0) {
        return rankDelta;
      }

      return first.columnSpan - second.columnSpan;
    });

    for (const story of movableStories) {
      if (total + story.columnSpan > columnCount) {
        continue;
      }

      row.stories.push(story);
      nextRow.stories = nextRow.stories.filter((candidate) => candidate.id !== story.id);
      total += story.columnSpan;
      merged = true;
    }
  }

  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index].stories.length === 0) {
      rows.splice(index, 1);
    }
  }

  return merged;
};

const expandRowsToFill = (rows: EditorialRow[], selectedStory: StoryFrame, columnCount: number) => {
  for (const row of rows) {
    if (row.inserted && row.stories.length === 1) {
      continue;
    }

    let total = getRowTotal(row);

    while (total < columnCount) {
      const candidate = row.stories
        .filter((story) => story.id !== selectedStory.id)
        .sort((first, second) => {
          const rankDelta = priorityExpandRank[first.priority] - priorityExpandRank[second.priority];

          if (rankDelta !== 0) {
            return rankDelta;
          }

          return getDistance(first, selectedStory) - getDistance(second, selectedStory);
        })[0];

      if (!candidate) {
        break;
      }

      candidate.columnSpan = toStoryColumnSpan(candidate.columnSpan + 1);
      total += 1;
    }
  }
};

export const assignRowVerticalGeometry = (rows: EditorialRow[], bounds: StorySpanRebalanceBounds) => {
  const rowGaps = getEditorialRowGaps({
    rows: rows.map((row) => ({
      priorities: row.stories.map((story) => story.priority),
    })),
    pageUtilizationPercent: 100,
    gutter: bounds.gutter,
  });
  const totalRowGap = rowGaps.reduce((sum, gap) => sum + gap, 0);
  const availableStoryHeight = Math.max(1, bounds.contentHeight - totalRowGap);
  const rowWeights = rows.map((row) => Math.max(1, row.height));
  const totalWeight = rowWeights.reduce((sum, weight) => sum + weight, 0);
  let currentY = bounds.contentY;

  return rows.map((row, index) => {
    const height =
      index === rows.length - 1
        ? bounds.contentY + bounds.contentHeight - currentY
        : availableStoryHeight * (rowWeights[index] / totalWeight);
    const nextRow = {
      ...row,
      y: currentY,
      height,
    };

    currentY += height + (rowGaps[index] ?? 0);

    return nextRow;
  });
};

export const assignRowColumnGeometry = (rows: EditorialRow[], bounds: StorySpanRebalanceBounds) =>
  rows.flatMap((row) => {
    let columnStart = 1;

    return row.stories
      .sort((first, second) => first.x - second.x)
      .map((story) => {
        const geometry = getStorySpanGeometry({
          columnStart,
          columnSpan: story.columnSpan,
          bounds,
        });

        columnStart += geometry.columnSpan;

        return {
          ...story,
          columnStart: geometry.columnStart,
          columnSpan: geometry.columnSpan,
          x: geometry.x,
          y: row.y,
          width: geometry.width,
          height: row.height,
        };
      });
  });

export const reflowRows = ({
  rows,
  selectedStory,
  bounds,
}: {
  rows: EditorialRow[];
  selectedStory: StoryFrame;
  bounds: StorySpanRebalanceBounds;
}): RowReflowResult => {
  let reflowed = false;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];

    if (row.stories.length === 0) {
      continue;
    }

    const fit = shrinkRowToFit(row, selectedStory, bounds.columnCount);

    if (!fit) {
      const moved = moveLowestPriorityStoryToNextRow(rows, index, selectedStory.id);

      if (!moved) {
        return {
          success: false,
          message: "Unable to reflow row",
        };
      }

      reflowed = true;
      index -= 1;
    }
  }

  if (mergeRowsForward(rows, bounds.columnCount)) {
    reflowed = true;
  }

  expandRowsToFill(rows, selectedStory, bounds.columnCount);

  return {
    success: true,
    rows: reflowed ? assignRowVerticalGeometry(rows, bounds) : rows,
    reflowed,
  };
};

export const RowReflowEngine = {
  assignRowColumnGeometry,
  assignRowVerticalGeometry,
  groupStoriesIntoRows,
  reflowRows,
};
