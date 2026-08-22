import { NEWSPAPER_PAGE, PAGE_MARGIN } from "@/utils/page";
import {
  calculatePageCoverage,
  hasOverlappingSlots,
  optimizePageCoverage,
} from "./PageCoverageOptimizer";
import { allocateStoryPriorities } from "./StoryPriorityAllocator";
import type { StoryPriorityRole } from "./StoryPriorityAllocator";

export type EditorialPageSlot = {
  id: string;
  columnStart: number;
  columnSpan: number;
  x: number;
  y: number;
  width: number;
  height: number;
  role: StoryPriorityRole;
  hasImage: boolean;
};

export type EditorialPageComposition = {
  storyCount: number;
  pageWidth: number;
  pageHeight: number;
  pageMargin: number;
  contentX: number;
  contentY: number;
  contentWidth: number;
  contentHeight: number;
  columnCount: number;
  coverageRatio: number;
  slots: EditorialPageSlot[];
};

type SlotDraft = {
  columnStart: number;
  columnSpan: number;
  yPercent: number;
  heightPercent: number;
};

const COLUMN_COUNT = 6;

const getLeadHeightPercent = (storyCount: number) => {
  if (storyCount <= 6) {
    return 42;
  }

  if (storyCount <= 8) {
    return 40;
  }

  return 38;
};

const getMajorHeightPercent = (storyCount: number) => {
  if (storyCount <= 6) {
    return 32;
  }

  if (storyCount <= 8) {
    return 26;
  }

  if (storyCount <= 10) {
    return 22;
  }

  return 18;
};

const getBriefHeightPercent = (briefCount: number) => {
  if (briefCount === 0) {
    return 0;
  }

  if (briefCount <= 2) {
    return 12;
  }

  if (briefCount <= 4) {
    return 18;
  }

  return 24;
};

const createLeadDraft = (): SlotDraft => ({
  columnStart: 0,
  columnSpan: 6,
  yPercent: 0,
  heightPercent: 0,
});

const createMajorDrafts = (yPercent: number, heightPercent: number): SlotDraft[] => [
  {
    columnStart: 0,
    columnSpan: 3,
    yPercent,
    heightPercent,
  },
  {
    columnStart: 3,
    columnSpan: 3,
    yPercent,
    heightPercent,
  },
];

const distributeMediumDrafts = (
  count: number,
  yPercent: number,
  heightPercent: number,
): SlotDraft[] => {
  if (count <= 0) {
    return [];
  }

  if (count === 1) {
    return [{ columnStart: 0, columnSpan: 6, yPercent, heightPercent }];
  }

  if (count === 2) {
    return [
      { columnStart: 0, columnSpan: 3, yPercent, heightPercent },
      { columnStart: 3, columnSpan: 3, yPercent, heightPercent },
    ];
  }

  if (count === 3) {
    return [
      { columnStart: 0, columnSpan: 3, yPercent, heightPercent },
      { columnStart: 3, columnSpan: 2, yPercent, heightPercent },
      { columnStart: 5, columnSpan: 1, yPercent, heightPercent },
    ];
  }

  if (count === 4) {
    return [
      { columnStart: 0, columnSpan: 3, yPercent, heightPercent: heightPercent / 2 },
      { columnStart: 3, columnSpan: 3, yPercent, heightPercent: heightPercent / 2 },
      {
        columnStart: 0,
        columnSpan: 2,
        yPercent: yPercent + heightPercent / 2,
        heightPercent: heightPercent / 2,
      },
      {
        columnStart: 2,
        columnSpan: 4,
        yPercent: yPercent + heightPercent / 2,
        heightPercent: heightPercent / 2,
      },
    ];
  }

  return [
    { columnStart: 0, columnSpan: 2, yPercent, heightPercent: heightPercent / 2 },
    { columnStart: 2, columnSpan: 4, yPercent, heightPercent: heightPercent / 2 },
    {
      columnStart: 0,
      columnSpan: 3,
      yPercent: yPercent + heightPercent / 2,
      heightPercent: heightPercent / 2,
    },
    {
      columnStart: 3,
      columnSpan: 2,
      yPercent: yPercent + heightPercent / 2,
      heightPercent: heightPercent / 2,
    },
    {
      columnStart: 5,
      columnSpan: 1,
      yPercent: yPercent + heightPercent / 2,
      heightPercent: heightPercent / 2,
    },
  ].slice(0, count);
};

const distributeBriefDrafts = (
  count: number,
  yPercent: number,
  heightPercent: number,
): SlotDraft[] => {
  if (count <= 0) {
    return [];
  }

  if (count <= 3) {
    const patterns: Record<number, number[]> = {
      1: [6],
      2: [3, 3],
      3: [2, 2, 2],
    };
    const spans = patterns[count];
    let cursor = 0;

    return spans.map((columnSpan) => {
      const draft = {
        columnStart: cursor,
        columnSpan,
        yPercent,
        heightPercent,
      };

      cursor += columnSpan;

      return draft;
    });
  }

  const topCount = Math.ceil(count / 2);
  const bottomCount = count - topCount;

  return [
    ...distributeBriefDrafts(topCount, yPercent, heightPercent / 2),
    ...distributeBriefDrafts(bottomCount, yPercent + heightPercent / 2, heightPercent / 2),
  ];
};

const buildDrafts = (storyCount: number, roles: StoryPriorityRole[]): SlotDraft[] => {
  const leadHeight = getLeadHeightPercent(storyCount);
  const majorHeight = getMajorHeightPercent(storyCount);
  const briefCount = roles.filter((role) => role === "brief").length;
  const briefHeight = getBriefHeightPercent(briefCount);
  const mediumCount = roles.filter((role) => role === "medium").length;
  const mediumY = leadHeight + majorHeight;
  const mediumHeight = 100 - leadHeight - majorHeight - briefHeight;

  return [
    {
      ...createLeadDraft(),
      heightPercent: leadHeight,
    },
    ...createMajorDrafts(leadHeight, majorHeight),
    ...distributeMediumDrafts(mediumCount, mediumY, mediumHeight),
    ...distributeBriefDrafts(briefCount, 100 - briefHeight, briefHeight),
  ].slice(0, storyCount);
};

export const composeEditorialPage = ({
  storyCount,
  pageWidth = NEWSPAPER_PAGE.width,
  pageHeight = NEWSPAPER_PAGE.height,
  pageMargin = PAGE_MARGIN,
  contentX = pageMargin,
  contentY = pageMargin,
  contentWidth = pageWidth - pageMargin * 2,
  contentHeight = pageHeight - pageMargin * 2,
}: {
  storyCount: number;
  pageWidth?: number;
  pageHeight?: number;
  pageMargin?: number;
  contentX?: number;
  contentY?: number;
  contentWidth?: number;
  contentHeight?: number;
}): EditorialPageComposition | null => {
  if (storyCount < 5 || storyCount > 13) {
    return null;
  }

  const priorities = allocateStoryPriorities(storyCount);
  const columnWidth = contentWidth / COLUMN_COUNT;
  const drafts = buildDrafts(storyCount, priorities.map((priority) => priority.role));
  const slots = drafts.map((draft, index): EditorialPageSlot => {
    const priority = priorities[index];

    return {
      id: `slot-${index + 1}`,
      columnStart: draft.columnStart + 1,
      columnSpan: draft.columnSpan,
      x: contentX + draft.columnStart * columnWidth,
      y: contentY + contentHeight * (draft.yPercent / 100),
      width: draft.columnSpan * columnWidth,
      height: contentHeight * (draft.heightPercent / 100),
      role: priority.role,
      hasImage: priority.hasImage,
    };
  });
  const optimizedSlots = optimizePageCoverage(
    slots,
    {
      x: contentX,
      y: contentY,
      width: contentWidth,
      height: contentHeight,
    },
  ) as EditorialPageSlot[];
  const coverage = calculatePageCoverage(optimizedSlots, {
    x: contentX,
    y: contentY,
    width: contentWidth,
    height: contentHeight,
  });

  if (hasOverlappingSlots(optimizedSlots)) {
    throw new Error("Editorial page composition produced overlapping slots");
  }

  return {
    storyCount,
    pageWidth,
    pageHeight,
    pageMargin,
    contentX,
    contentY,
    contentWidth,
    contentHeight,
    columnCount: COLUMN_COUNT,
    coverageRatio: coverage.coverageRatio,
    slots: optimizedSlots,
  };
};

export const EditorialPageComposer = {
  composeEditorialPage,
};
