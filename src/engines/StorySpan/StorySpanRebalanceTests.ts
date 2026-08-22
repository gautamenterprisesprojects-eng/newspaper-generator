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
}: {
  id: string;
  priority: StoryFrame["priority"];
  columnStart: StoryColumnSpan;
  columnSpan: StoryColumnSpan;
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
    y: 100,
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

const firstExample = rebalanceStorySpans({
  stories: [
    createStory({
      id: "story-a",
      priority: "major",
      columnStart: 1,
      columnSpan: 4,
    }),
    createStory({
      id: "story-b",
      priority: "secondary",
      columnStart: 5,
      columnSpan: 2,
    }),
  ],
  selectedStoryId: "story-a",
  requestedColumnSpan: 5,
  bounds,
});

assert(firstExample.success, "4+2 example must rebalance successfully");

if (firstExample.success) {
  const storyA = firstExample.stories.find((story) => story.id === "story-a");
  const storyB = firstExample.stories.find((story) => story.id === "story-b");

  assert(storyA?.columnSpan === 5, "selected story must be honored at 5 columns");
  assert(storyB?.columnSpan === 1, "neighbor must shrink to 1 column");
  assert(
    firstExample.stories.reduce((sum, story) => sum + story.columnSpan, 0) === 6,
    "row must remain fully packed",
  );
}

const secondExample = rebalanceStorySpans({
  stories: [
    createStory({
      id: "story-a",
      priority: "major",
      columnStart: 1,
      columnSpan: 3,
    }),
    createStory({
      id: "story-b",
      priority: "secondary",
      columnStart: 4,
      columnSpan: 2,
    }),
    createStory({
      id: "story-c",
      priority: "brief",
      columnStart: 6,
      columnSpan: 1,
    }),
  ],
  selectedStoryId: "story-a",
  requestedColumnSpan: 4,
  bounds,
});

assert(secondExample.success, "3+2+1 example must rebalance successfully");

if (secondExample.success) {
  const storyA = secondExample.stories.find((story) => story.id === "story-a");
  const storyB = secondExample.stories.find((story) => story.id === "story-b");
  const storyC = secondExample.stories.find((story) => story.id === "story-c");

  assert(storyA?.columnSpan === 4, "selected story must be honored at 4 columns");
  assert(storyB?.columnSpan === 1, "secondary neighbor must shrink to 1 column");
  assert(storyC?.columnSpan === 1, "brief story must remain at minimum");
}

const rowReflowExample = rebalanceStorySpans({
  stories: [
    createStory({
      id: "lead",
      priority: "lead",
      columnStart: 1,
      columnSpan: 5,
    }),
    createStory({
      id: "secondary",
      priority: "secondary",
      columnStart: 6,
      columnSpan: 1,
    }),
  ],
  selectedStoryId: "lead",
  requestedColumnSpan: 6,
  bounds,
});

assert(rowReflowExample.success, "lead 5+secondary 1 must reflow when lead becomes 6");

if (rowReflowExample.success) {
  const lead = rowReflowExample.stories.find((story) => story.id === "lead");
  const secondary = rowReflowExample.stories.find((story) => story.id === "secondary");

  assert(lead?.columnSpan === 6, "selected lead must be honored at 6 columns");
  assert(secondary !== undefined && secondary.y > (lead?.y ?? 0), "secondary must move to another row");
  assert(rowReflowExample.reflowed, "moving a story to another row must mark layout as reflowed");
}

console.info("StorySpanRebalanceTests passed");
