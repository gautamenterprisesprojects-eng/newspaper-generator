import { createColumnGrid } from "@/engines/PageMaster/ColumnGridEngine";
import type { StoryColumnSpan, StoryFrame, StoryFrameId, StoryPriority } from "@/types/editor";

export type StorySpanBounds = {
  pageWidth: number;
  contentX: number;
  contentWidth: number;
  columnCount: number;
  gutter: number;
};

export type StorySpanGeometry = {
  columnStart: StoryColumnSpan;
  columnSpan: StoryColumnSpan;
  x: number;
  width: number;
};

export type StorySpanValidationResult =
  | {
      valid: true;
      geometry: StorySpanGeometry;
    }
  | {
      valid: false;
      reason: "column-overflow" | "story-overlap" | "page-overflow";
      message: string;
    };

export type StoryDominanceMetrics = {
  storyAreaPercent: number;
  pageAreaPercent: number;
  largestStoryPercent: number;
  largestImagePercent: number;
  largestHeadlinePercent: number;
  leadDominanceScore: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const toStoryColumnSpan = (value: number): StoryColumnSpan =>
  clamp(Math.round(value), 1, 6) as StoryColumnSpan;

export const getDefaultStoryColumnSpan = (priority: StoryPriority): StoryColumnSpan => {
  if (priority === "lead") {
    return 5;
  }

  if (priority === "major") {
    return 3;
  }

  if (priority === "secondary") {
    return 2;
  }

  return 1;
};

export const getStorySpanGeometry = ({
  columnStart,
  columnSpan,
  bounds,
}: {
  columnStart: number;
  columnSpan: number;
  bounds: StorySpanBounds;
}): StorySpanGeometry => {
  const safeColumnCount = Math.max(1, Math.floor(bounds.columnCount));
  const safeSpan = toStoryColumnSpan(clamp(columnSpan, 1, safeColumnCount));
  const safeStart = toStoryColumnSpan(clamp(columnStart, 1, safeColumnCount - safeSpan + 1));
  const columns = createColumnGrid({
    pageWidth: bounds.pageWidth,
    contentX: bounds.contentX,
    contentWidth: bounds.contentWidth,
    columnCount: safeColumnCount,
    gutter: bounds.gutter,
  });
  const firstColumn = columns[safeStart - 1];
  const lastColumn = columns[safeStart + safeSpan - 2];

  if (!firstColumn || !lastColumn) {
    return {
      columnStart: 1,
      columnSpan: 1,
      x: bounds.contentX,
      width: columns[0]?.width ?? bounds.contentWidth,
    };
  }

  return {
    columnStart: safeStart,
    columnSpan: safeSpan,
    x: firstColumn.x,
    width: lastColumn.x + lastColumn.width - firstColumn.x,
  };
};

const rangesOverlap = (startA: number, endA: number, startB: number, endB: number) =>
  Math.max(startA, startB) < Math.min(endA, endB);

const rectsOverlap = (
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
) =>
  rangesOverlap(first.x, first.x + first.width, second.x, second.x + second.width) &&
  rangesOverlap(first.y, first.y + first.height, second.y, second.y + second.height);

export const validateStorySpanChange = ({
  storyId,
  stories,
  columnStart,
  columnSpan,
  bounds,
}: {
  storyId: StoryFrameId;
  stories: StoryFrame[];
  columnStart: number;
  columnSpan: number;
  bounds: StorySpanBounds;
}): StorySpanValidationResult => {
  const story = stories.find((candidate) => candidate.id === storyId);

  if (!story) {
    return {
      valid: false,
      reason: "page-overflow",
      message: "Story not found",
    };
  }

  const geometry = getStorySpanGeometry({
    columnStart,
    columnSpan,
    bounds,
  });
  const candidate = {
    ...story,
    x: geometry.x,
    width: geometry.width,
  };
  const rightEdge = candidate.x + candidate.width;

  if (rightEdge > bounds.contentX + bounds.contentWidth + 0.001) {
    return {
      valid: false,
      reason: "column-overflow",
      message: "Story span exceeds page columns",
    };
  }

  for (const otherStory of stories) {
    if (otherStory.id === storyId) {
      continue;
    }

    if (rectsOverlap(candidate, otherStory)) {
      return {
        valid: false,
        reason: "story-overlap",
        message: "Story span would overlap another story",
      };
    }
  }

  return {
    valid: true,
    geometry,
  };
};

export const calculateStoryDominanceMetrics = ({
  selectedStoryId,
  stories,
  imageAreas,
  headlineAreas,
  pageArea,
  contentArea,
}: {
  selectedStoryId: StoryFrameId | null;
  stories: Pick<StoryFrame, "id" | "priority" | "width" | "height">[];
  imageAreas: number[];
  headlineAreas: number[];
  pageArea: number;
  contentArea: number;
}): StoryDominanceMetrics => {
  const selectedStory = stories.find((story) => story.id === selectedStoryId);
  const selectedArea = selectedStory ? selectedStory.width * selectedStory.height : 0;
  const storyAreas = stories.map((story) => story.width * story.height);
  const largestStoryArea = Math.max(...storyAreas, 0);
  const largestImageArea = Math.max(...imageAreas, 0);
  const largestHeadlineArea = Math.max(...headlineAreas, 0);
  const leadStory = stories.find((story) => story.priority === "lead");
  const leadArea = leadStory ? leadStory.width * leadStory.height : 0;
  const largestNonLeadArea = Math.max(
    ...stories
      .filter((story) => story.priority !== "lead")
      .map((story) => story.width * story.height),
    1,
  );
  const leadAreaRatio = leadArea / largestNonLeadArea;
  const leadContentShare = contentArea > 0 ? leadArea / contentArea : 0;
  const leadDominanceScore = Math.round(
    clamp((leadAreaRatio / 2) * 55 + (leadContentShare / 0.4) * 45, 0, 100),
  );

  return {
    storyAreaPercent: contentArea > 0 ? (selectedArea / contentArea) * 100 : 0,
    pageAreaPercent: pageArea > 0 ? (selectedArea / pageArea) * 100 : 0,
    largestStoryPercent: contentArea > 0 ? (largestStoryArea / contentArea) * 100 : 0,
    largestImagePercent: contentArea > 0 ? (largestImageArea / contentArea) * 100 : 0,
    largestHeadlinePercent: contentArea > 0 ? (largestHeadlineArea / contentArea) * 100 : 0,
    leadDominanceScore,
  };
};

export const StorySpanEngine = {
  calculateStoryDominanceMetrics,
  getDefaultStoryColumnSpan,
  getStorySpanGeometry,
  validateStorySpanChange,
};
