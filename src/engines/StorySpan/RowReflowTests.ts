import { prototypeArticle } from "@/data/prototypeArticle";
import { getDefaultStoryTypographySettings } from "@/engines/StoryHierarchy/StoryHierarchyEngine";
import { getStorySpanGeometry } from "@/engines/StorySpan/StorySpanEngine";
import type { ArticleCompositionSettings, StoryColumnSpan, StoryFrame } from "@/types/editor";
import { DEFAULT_PAGE_MASTER } from "@/types/page";
import { POINTS_PER_INCH } from "@/utils/page";
import { rebalanceStorySpans } from "./StorySpanRebalanceEngine";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const toPoints = (inches: number) => inches * POINTS_PER_INCH;

const bounds = {
  pageWidth: toPoints(DEFAULT_PAGE_MASTER.width),
  contentX: toPoints(DEFAULT_PAGE_MASTER.contentX),
  contentY: toPoints(DEFAULT_PAGE_MASTER.contentY),
  contentWidth: toPoints(DEFAULT_PAGE_MASTER.contentWidth),
  contentHeight: toPoints(DEFAULT_PAGE_MASTER.contentHeight),
  columnCount: DEFAULT_PAGE_MASTER.columns,
  gutter: toPoints(DEFAULT_PAGE_MASTER.gutter),
};

const compositionSettings: ArticleCompositionSettings = {
  showRegionDebug: false,
  headlineScale: 0.8,
  baselineGridSize: 12,
  enableDropCap: false,
  enableFactBox: false,
  enablePullQuote: false,
  opticalTypography: true,
};

const createStory = ({
  id,
  priority,
  columnStart,
  columnSpan,
  y,
}: {
  id: string;
  priority: StoryFrame["priority"];
  columnStart: StoryColumnSpan;
  columnSpan: StoryColumnSpan;
  y: number;
}): StoryFrame => {
  const geometry = getStorySpanGeometry({
    columnStart,
    columnSpan,
    bounds,
  });

  return {
    id,
    priority,
    columnStart,
    columnSpan,
    x: geometry.x,
    y,
    width: geometry.width,
    height: 240,
    imageEnabled: true,
    imageAlignment: "top-left",
    imageColumnSpan: 1,
    imageHeight: 80,
    imageHeightMode: "auto",
    imageHeightPreset: "tiny",
    imageHeightProtection: true,
    autoSizeImage: true,
    imageWrapMode: "rectangular",
    ...getDefaultStoryTypographySettings(priority),
    articleData: prototypeArticle,
    compositionSettings,
  };
};

const leadToFullWidth = rebalanceStorySpans({
  stories: [
    createStory({
      id: "lead",
      priority: "lead",
      columnStart: 1,
      columnSpan: 5,
      y: 100,
    }),
    createStory({
      id: "secondary",
      priority: "secondary",
      columnStart: 6,
      columnSpan: 1,
      y: 100,
    }),
  ],
  selectedStoryId: "lead",
  requestedColumnSpan: 6,
  bounds,
});

assert(leadToFullWidth.success, "lead full-width change must reflow successfully");

if (leadToFullWidth.success) {
  const lead = leadToFullWidth.stories.find((story) => story.id === "lead");
  const secondary = leadToFullWidth.stories.find((story) => story.id === "secondary");

  assert(lead?.columnSpan === 6, "lead must be honored at 6 columns");
  assert(secondary !== undefined && secondary.y > (lead?.y ?? 0), "secondary must move to a lower row");
  assert(leadToFullWidth.reflowed, "moving secondary to another row must report reflow");
}

const mergeIntoNextRow = rebalanceStorySpans({
  stories: [
    createStory({
      id: "lead",
      priority: "lead",
      columnStart: 1,
      columnSpan: 5,
      y: 100,
    }),
    createStory({
      id: "brief",
      priority: "brief",
      columnStart: 6,
      columnSpan: 1,
      y: 100,
    }),
    createStory({
      id: "major",
      priority: "major",
      columnStart: 1,
      columnSpan: 3,
      y: 360,
    }),
    createStory({
      id: "secondary",
      priority: "secondary",
      columnStart: 4,
      columnSpan: 2,
      y: 360,
    }),
  ],
  selectedStoryId: "lead",
  requestedColumnSpan: 6,
  bounds,
});

assert(mergeIntoNextRow.success, "reflow should merge moved story into next available row");

if (mergeIntoNextRow.success) {
  const brief = mergeIntoNextRow.stories.find((story) => story.id === "brief");
  const major = mergeIntoNextRow.stories.find((story) => story.id === "major");
  const secondary = mergeIntoNextRow.stories.find((story) => story.id === "secondary");

  assert(
    brief !== undefined && major !== undefined && secondary !== undefined,
    "all row stories must remain present",
  );
  assert(brief?.y === major?.y, "moved brief should merge into the next row when it fits");
  assert(
    [brief, major, secondary].reduce((sum, story) => sum + (story?.columnSpan ?? 0), 0) === 6,
    "merged row must remain packed to 6 columns",
  );
}

console.info("RowReflowTests passed");
