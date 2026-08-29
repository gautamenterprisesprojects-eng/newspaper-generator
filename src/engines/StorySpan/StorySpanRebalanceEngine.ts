import type { StoryColumnSpan, StoryFrame, StoryFrameId } from "@/types/editor";
import type { StorySpanBounds } from "./StorySpanEngine";
import {
  assignRowColumnGeometry,
  groupStoriesIntoRows,
  reflowRows,
} from "./RowReflowEngine";

export type StorySpanRebalanceBounds = StorySpanBounds & {
  contentY: number;
  contentHeight: number;
};

export type StorySpanRebalanceInput = {
  stories: StoryFrame[];
  selectedStoryId: StoryFrameId;
  requestedColumnSpan: StoryColumnSpan;
  bounds: StorySpanRebalanceBounds;
};

export type StorySpanRebalanceResult =
  | {
      success: true;
      stories: StoryFrame[];
      adjustedStoryIds: StoryFrameId[];
      reflowed: boolean;
    }
  | {
      success: false;
      message: string;
    };

const minSpanByPriority: Record<StoryFrame["priority"], StoryColumnSpan> = {
  lead: 4,
  major: 2,
  secondary: 1,
  brief: 1,
  filler: 1,
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const MAX_STORY_COLUMN_SPAN = 8;

const toStoryColumnSpan = (value: number): StoryColumnSpan =>
  clamp(Math.round(value), 1, MAX_STORY_COLUMN_SPAN) as StoryColumnSpan;

const getMinSpan = (story: StoryFrame) => minSpanByPriority[story.priority];

const getAdjustedStoryIds = (previousStories: StoryFrame[], nextStories: StoryFrame[]) =>
  nextStories
    .filter((nextStory) => {
      const previousStory = previousStories.find((story) => story.id === nextStory.id);

      return (
        previousStory &&
        (previousStory.columnStart !== nextStory.columnStart ||
          previousStory.columnSpan !== nextStory.columnSpan ||
          previousStory.x !== nextStory.x ||
          previousStory.y !== nextStory.y ||
          previousStory.width !== nextStory.width ||
          previousStory.height !== nextStory.height)
      );
    })
    .map((story) => story.id);

export const rebalanceStorySpans = ({
  stories,
  selectedStoryId,
  requestedColumnSpan,
  bounds,
}: StorySpanRebalanceInput): StorySpanRebalanceResult => {
  const selectedStory = stories.find((story) => story.id === selectedStoryId);

  if (!selectedStory) {
    return {
      success: false,
      message: "Story not found",
    };
  }

  const rows = groupStoriesIntoRows(stories.map((story) => ({ ...story })));
  const selectedDraft = rows.flatMap((row) => row.stories).find((story) => story.id === selectedStoryId);

  if (!selectedDraft) {
    return {
      success: false,
      message: "Story not found",
    };
  }

  selectedDraft.columnSpan = toStoryColumnSpan(
    clamp(requestedColumnSpan, getMinSpan(selectedDraft), bounds.columnCount),
  );

  const reflow = reflowRows({
    rows,
    selectedStory: selectedDraft,
    bounds,
  });

  if (!reflow.success) {
    return {
      success: false,
      message: reflow.message,
    };
  }

  const nextStories = assignRowColumnGeometry(reflow.rows, bounds);

  return {
    success: true,
    stories: nextStories,
    adjustedStoryIds: getAdjustedStoryIds(stories, nextStories),
    reflowed: reflow.reflowed,
  };
};

export const StorySpanRebalanceEngine = {
  rebalanceStorySpans,
};
