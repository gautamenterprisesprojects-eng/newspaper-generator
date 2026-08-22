import { strict as assert } from "node:assert";
import { prototypeArticle } from "@/data/prototypeArticle";
import { createCleanDirtyFlags } from "@/engines/IncrementalComposition/IncrementalCompositionEngine";
import type { LayoutColumn, LayoutRect } from "@/engines/LayoutTransactionEngine/LayoutTransactionTypes";
import type { StoryFrame } from "@/types/editor";
import { orchestrateComposition } from "./CompositionOrchestrator";

Object.defineProperty(globalThis, "OffscreenCanvas", {
  configurable: true,
  value: class {
    getContext() {
      return {
        font: "",
        measureText: (text: string) => ({
          width: Array.from(text).length * 7,
          actualBoundingBoxAscent: 8,
          actualBoundingBoxDescent: 2,
        }),
      };
    }
  },
});

const pageBounds: LayoutRect = { x: 0, y: 0, width: 640, height: 820 };
const contentBounds: LayoutRect = { x: 20, y: 20, width: 600, height: 760 };
const columns: LayoutColumn[] = [
  { index: 1, x: 20, y: 20, width: 180, height: 760 },
  { index: 2, x: 220, y: 20, width: 180, height: 760 },
  { index: 3, x: 420, y: 20, width: 200, height: 760 },
];

const createStory = (
  id: string,
  rect: LayoutRect,
  bodyRepeat = 1,
): StoryFrame => ({
  id,
  ...rect,
  priority: "secondary",
  columnStart: 1,
  columnSpan: 1,
  imageEnabled: false,
  imageAlignment: "top-left",
  imageColumnSpan: 1,
  imageHeight: 80,
  imageHeightMode: "auto",
  imageHeightPreset: "tiny",
  imageHeightProtection: true,
  autoSizeImage: true,
  imageWrapMode: "none",
  headlineFontSize: 20,
  subheadlineFontSize: 12,
  bodyFontSize: 10,
  headlineLineHeight: 1,
  subheadlineLineHeight: 1,
  bodyLineHeight: 1.1,
  headlineWeight: "800",
  subheadlineWeight: "600",
  autoFitHeadline: true,
  autoBalanceHeadline: true,
  enableHyphenation: true,
  forceFullWidthHeadlines: false,
  headlineLayoutMode: "newspaper-fill",
  articleData: {
    ...prototypeArticle,
    headline: "City brief",
    subheadline: "Update",
    body: Array.from({ length: bodyRepeat }).map(() => prototypeArticle.body).join("\n\n"),
  },
  compositionSettings: {
    showRegionDebug: false,
    bodyRendererMode: "line",
    headlineScale: 0.8,
    baselineGridSize: 6,
    enableDropCap: false,
    enableFactBox: false,
    enablePullQuote: false,
    opticalTypography: true,
  },
  dirtyFlags: createCleanDirtyFlags(),
});

const assertStopsWhenAlreadyStable = () => {
  const stories = [
    createStory("fit", { x: 20, y: 20, width: 180, height: 700 }, 1),
  ];
  const result = orchestrateComposition({
    pageId: "page-1",
    pageBounds,
    contentBounds,
    columns,
    stories,
    changedStoryIds: ["fit"],
    maxIterations: 2,
    underflowWhitespacePercent: 101,
    illegalWhitespaceArea: Number.POSITIVE_INFINITY,
  });

  assert.equal(result.stable, true);
  assert.equal(result.reason, "stable");
  assert.equal(result.layoutSolutions.length, 0);
};

const assertRequestsLayoutForOverflow = () => {
  const stories = [
    createStory("overflow", { x: 20, y: 20, width: 180, height: 120 }, 8),
    createStory("neighbor", { x: 220, y: 20, width: 180, height: 220 }, 1),
  ];
  const result = orchestrateComposition({
    pageId: "page-1",
    pageBounds,
    contentBounds,
    columns,
    stories,
    changedStoryIds: ["overflow"],
    maxIterations: 1,
    underflowWhitespacePercent: 101,
    illegalWhitespaceArea: Number.POSITIVE_INFINITY,
    minSize: { width: 80, height: 80 },
  });

  assert.equal(result.stable, false);
  assert.equal(result.reason, "max-iteration");
  assert.equal(result.iterations[0].requestedLayout, true);
  assert(result.iterations[0].overflowStoryIds.includes("overflow"));
  assert(result.layoutSolutions.length === 1);
  assert(result.stories.some((story) => story.id === "overflow" && story.height !== 120));
};

const assertStopsWhenNoSolutionCanChangeGeometry = () => {
  const stories = [
    createStory("locked-overflow", { x: 20, y: 20, width: 180, height: 120 }, 8),
  ].map((story) => ({ ...story, locked: true }));
  const result = orchestrateComposition({
    pageId: "page-1",
    pageBounds,
    contentBounds,
    columns,
    stories,
    changedStoryIds: ["locked-overflow"],
    maxIterations: 2,
    underflowWhitespacePercent: 101,
    illegalWhitespaceArea: Number.POSITIVE_INFINITY,
  });

  assert.equal(result.stable, false);
  assert.equal(result.reason, "no-layout-solution");
  assert(result.layoutDiffs[0].constraintViolations.some((message) => message.includes("Locked frame")));
};

assertStopsWhenAlreadyStable();
assertRequestsLayoutForOverflow();
assertStopsWhenNoSolutionCanChangeGeometry();

console.log("CompositionOrchestrator tests passed: 3");
