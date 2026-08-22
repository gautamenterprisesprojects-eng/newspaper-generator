import { DEFAULT_PAGE_MASTER } from "@/types/page";
import { POINTS_PER_INCH } from "@/utils/page";
import {
  calculateStoryDominanceMetrics,
  getDefaultStoryColumnSpan,
  getStorySpanGeometry,
  validateStorySpanChange,
} from "./StorySpanEngine";
import type { ArticleCompositionSettings, StoryFrame } from "@/types/editor";
import { prototypeArticle } from "@/data/prototypeArticle";
import { getDefaultStoryTypographySettings } from "@/engines/StoryHierarchy/StoryHierarchyEngine";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const toPoints = (inches: number) => inches * POINTS_PER_INCH;

const bounds = {
  pageWidth: toPoints(DEFAULT_PAGE_MASTER.width),
  contentX: toPoints(DEFAULT_PAGE_MASTER.contentX),
  contentWidth: toPoints(DEFAULT_PAGE_MASTER.contentWidth),
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

const createStory = (story: Partial<StoryFrame> & Pick<StoryFrame, "id" | "x" | "y" | "width" | "height">): StoryFrame => ({
  priority: "secondary",
  columnStart: 1,
  columnSpan: 2,
  imageEnabled: true,
  imageAlignment: "top-left",
  imageColumnSpan: 1,
  imageHeight: 80,
  imageHeightMode: "auto",
  imageHeightPreset: "tiny",
  imageHeightProtection: true,
  autoSizeImage: true,
  imageWrapMode: "rectangular",
  ...getDefaultStoryTypographySettings(story.priority ?? "secondary"),
  articleData: prototypeArticle,
  compositionSettings,
  ...story,
});

assert(getDefaultStoryColumnSpan("lead") === 5, "lead default span must be 5 columns");
assert(getDefaultStoryColumnSpan("major") === 3, "major default span must be 3 columns");
assert(getDefaultStoryColumnSpan("secondary") === 2, "secondary default span must be 2 columns");
assert(getDefaultStoryColumnSpan("brief") === 1, "brief default span must be 1 column");
assert(getDefaultStoryColumnSpan("filler") === 1, "filler default span must be 1 column");

const geometry = getStorySpanGeometry({
  columnStart: 2,
  columnSpan: 3,
  bounds,
});

assert(geometry.columnStart === 2, "geometry must preserve valid column start");
assert(geometry.columnSpan === 3, "geometry must preserve valid column span");
assert(geometry.x > bounds.contentX, "column 2 geometry must move right");
assert(geometry.width > 0, "span geometry must have positive width");

const clampedGeometry = getStorySpanGeometry({
  columnStart: 5,
  columnSpan: 4,
  bounds,
});

assert(clampedGeometry.columnStart === 3, "start must clamp when span would exceed columns");
assert(clampedGeometry.columnSpan === 4, "span may remain 4 when page has enough columns");

const storyOneGeometry = getStorySpanGeometry({
  columnStart: 1,
  columnSpan: 2,
  bounds,
});
const storyTwoGeometry = getStorySpanGeometry({
  columnStart: 3,
  columnSpan: 2,
  bounds,
});
const stories = [
  createStory({
    id: "story-1",
    x: storyOneGeometry.x,
    y: 100,
    width: storyOneGeometry.width,
    height: 220,
    columnStart: 1,
    columnSpan: 2,
  }),
  createStory({
    id: "story-2",
    x: storyTwoGeometry.x,
    y: 100,
    width: storyTwoGeometry.width,
    height: 220,
    columnStart: 3,
    columnSpan: 2,
  }),
];

const overlapping = validateStorySpanChange({
  storyId: "story-1",
  stories,
  columnStart: 2,
  columnSpan: 3,
  bounds,
});

assert(!overlapping.valid && overlapping.reason === "story-overlap", "span validation must reject overlaps");

const valid = validateStorySpanChange({
  storyId: "story-1",
  stories,
  columnStart: 1,
  columnSpan: 2,
  bounds,
});

assert(valid.valid, "span validation must allow current valid geometry");

const dominance = calculateStoryDominanceMetrics({
  selectedStoryId: "story-1",
  stories: [
    { id: "story-1", priority: "lead", width: 600, height: 500 },
    { id: "story-2", priority: "major", width: 300, height: 300 },
  ],
  imageAreas: [40000, 10000],
  headlineAreas: [24000, 9000],
  pageArea: 936 * 1512,
  contentArea: 900 * 1432,
});

assert(dominance.storyAreaPercent > 0, "selected story area must be reported");
assert(dominance.largestStoryPercent > 0, "largest story percent must be reported");
assert(dominance.largestImagePercent > 0, "largest image percent must be reported");
assert(dominance.largestHeadlinePercent > 0, "largest headline percent must be reported");
assert(dominance.leadDominanceScore > 0, "lead dominance score must be reported");

console.info("StorySpanTests passed");
