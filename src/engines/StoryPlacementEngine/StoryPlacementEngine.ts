import type { ArticleBoxModel, Size, StoryFrame } from "@/types/editor";
import { GUIDE_GUTTER, snapValue } from "@/utils/grid";
import { NEWSPAPER_PAGE, PAGE_MARGIN } from "@/utils/page";

export type StoryPlacementInput = {
  stories: StoryFrame[];
  preferredSize?: Size;
  pageWidth?: number;
  pageHeight?: number;
  pageMargin?: number;
  contentX?: number;
  contentY?: number;
  contentWidth?: number;
  contentHeight?: number;
  columnCount?: number;
  columnGap?: number;
  storyGap?: number;
};

export type StoryPlacementResult = {
  storyFrame: ArticleBoxModel | null;
  warning: string | null;
};

type ColumnGrid = {
  columnWidth: number;
  starts: number[];
};

const DEFAULT_COLUMN_COUNT = 6;
const DEFAULT_STORY_GAP = GUIDE_GUTTER;
const DEFAULT_STORY_COLUMN_SPAN = 2;
const DEFAULT_STORY_HEIGHT = 360;
const VERTICAL_SCAN_STEP = 9;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getColumnGrid = ({
  pageWidth,
  pageMargin,
  contentX = pageMargin,
  contentWidth = pageWidth - pageMargin * 2,
  columnCount,
  columnGap,
}: Required<Pick<StoryPlacementInput, "pageWidth" | "pageMargin" | "columnCount" | "columnGap">> &
  Pick<StoryPlacementInput, "contentX" | "contentWidth">): ColumnGrid => {
  const totalGutters = columnGap * Math.max(0, columnCount - 1);
  const columnWidth = (contentWidth - totalGutters) / columnCount;

  return {
    columnWidth,
    starts: Array.from({ length: columnCount }).map(
      (_, index) => contentX + index * (columnWidth + columnGap),
    ),
  };
};

const getSpanWidth = (span: number, columnWidth: number, columnGap: number) =>
  columnWidth * span + columnGap * Math.max(0, span - 1);

const getColumnSpanForWidth = (width: number, columnWidth: number, columnGap: number, columnCount: number) => {
  for (let span = 1; span <= columnCount; span += 1) {
    if (getSpanWidth(span, columnWidth, columnGap) >= width) {
      return span;
    }
  }

  return columnCount;
};

export const getDefaultStorySize = (
  input: Pick<StoryPlacementInput, "pageWidth" | "pageMargin" | "columnCount" | "columnGap"> = {},
): Size => {
  const pageWidth = input.pageWidth ?? NEWSPAPER_PAGE.width;
  const pageMargin = input.pageMargin ?? PAGE_MARGIN;
  const columnCount = input.columnCount ?? DEFAULT_COLUMN_COUNT;
  const columnGap = input.columnGap ?? GUIDE_GUTTER;
  const { columnWidth } = getColumnGrid({
    pageWidth,
    pageMargin,
    columnCount,
    columnGap,
  });

  return {
    width: Math.round(getSpanWidth(DEFAULT_STORY_COLUMN_SPAN, columnWidth, columnGap)),
    height: DEFAULT_STORY_HEIGHT,
  };
};

const normalizeSizeToColumnGrid = ({
  preferredSize,
  pageWidth,
  pageHeight,
  pageMargin,
  columnCount,
  columnGap,
}: Required<Pick<StoryPlacementInput, "pageWidth" | "pageHeight" | "pageMargin" | "columnCount" | "columnGap">> & {
  preferredSize?: Size;
}) => {
  const { columnWidth } = getColumnGrid({
    pageWidth,
    pageMargin,
    columnCount,
    columnGap,
  });
  const rawWidth = preferredSize?.width ?? getSpanWidth(DEFAULT_STORY_COLUMN_SPAN, columnWidth, columnGap);
  const columnSpan = clamp(
    getColumnSpanForWidth(rawWidth, columnWidth, columnGap, columnCount),
    1,
    columnCount,
  );
  const width = Math.round(getSpanWidth(columnSpan, columnWidth, columnGap));
  const height = preferredSize?.height
    ? snapValue(clamp(preferredSize.height, 120, pageHeight - pageMargin * 2), VERTICAL_SCAN_STEP)
    : DEFAULT_STORY_HEIGHT;

  return {
    width,
    height,
    columnSpan,
  };
};

const getCandidateXPositions = (starts: number[], columnSpan: number, columnCount: number) =>
  starts.slice(0, columnCount - columnSpan + 1);

const isAvailable = (candidate: ArticleBoxModel, existing: StoryFrame[], storyGap: number) =>
  !existing.some(
    (story) =>
      candidate.x < story.x + story.width + storyGap &&
      candidate.x + candidate.width + storyGap > story.x &&
      candidate.y < story.y + story.height + storyGap &&
      candidate.y + candidate.height + storyGap > story.y,
  );

export const findStoryPlacement = ({
  stories,
  preferredSize,
  pageWidth = NEWSPAPER_PAGE.width,
  pageHeight = NEWSPAPER_PAGE.height,
  pageMargin = PAGE_MARGIN,
  contentX = pageMargin,
  contentY = pageMargin,
  contentWidth = pageWidth - pageMargin * 2,
  contentHeight = pageHeight - pageMargin * 2,
  columnCount = DEFAULT_COLUMN_COUNT,
  columnGap = GUIDE_GUTTER,
  storyGap = columnGap,
}: StoryPlacementInput): StoryPlacementResult => {
  const { starts } = getColumnGrid({
    pageWidth,
    pageMargin: contentX,
    columnCount,
    columnGap,
    contentX,
    contentWidth,
  });
  const size = normalizeSizeToColumnGrid({
    preferredSize,
    pageWidth: contentX + contentWidth,
    pageHeight: contentY + contentHeight,
    pageMargin: contentX,
    columnCount,
    columnGap,
  });
  const maxY = contentY + contentHeight - size.height;
  const candidateXs = getCandidateXPositions(starts, size.columnSpan, columnCount);

  for (let y = contentY; y <= maxY; y += VERTICAL_SCAN_STEP) {
    const snappedY = snapValue(y, VERTICAL_SCAN_STEP);

    for (const x of candidateXs) {
      const candidate = {
        x: Math.round(x),
        y: snappedY,
        width: size.width,
        height: size.height,
      };

      if (isAvailable(candidate, stories, storyGap)) {
        return {
          storyFrame: candidate,
          warning: null,
        };
      }
    }
  }

  return {
    storyFrame: null,
    warning: "Page is full",
  };
};

export const StoryPlacementEngine = {
  findStoryPlacement,
  getDefaultStorySize,
};
