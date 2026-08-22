import { strict as assert } from "node:assert";
import { prototypeArticle } from "@/data/prototypeArticle";
import { createDocumentFromStoryFrames } from "@/engines/DocumentEngine/DocumentEngine";
import { createCleanDirtyFlags } from "@/engines/IncrementalComposition/IncrementalCompositionEngine";
import type { StoryFrame } from "@/types/editor";
import { LiveResizeController } from "./LiveResizeController";
import type { LayoutColumn, LayoutFrameSnapshot, LayoutRect } from "./LayoutTransactionTypes";

const pageBounds: LayoutRect = { x: 0, y: 0, width: 420, height: 320 };
const contentBounds: LayoutRect = { x: 20, y: 20, width: 380, height: 280 };
const columns: LayoutColumn[] = [
  { index: 1, x: 20, y: 20, width: 180, height: 280 },
  { index: 2, x: 220, y: 20, width: 180, height: 280 },
];

const createStory = (
  id: string,
  rect: LayoutRect,
  priority: StoryFrame["priority"] = "secondary",
): StoryFrame => ({
  id,
  ...rect,
  priority,
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
  articleData: prototypeArticle,
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

const toFrame = (story: StoryFrame, index: number): LayoutFrameSnapshot => ({
  id: story.id,
  pageId: "page-1",
  storyId: story.id,
  kind: "story",
  locked: false,
  hidden: false,
  pinned: false,
  priority: story.priority,
  zIndex: index,
  x: story.x,
  y: story.y,
  width: story.width,
  height: story.height,
});

const createStories = () => [
  createStory("source", { x: 20, y: 20, width: 180, height: 180 }, "major"),
  createStory("neighbor", { x: 220, y: 20, width: 180, height: 180 }, "filler"),
];

const beginController = () => {
  const stories = createStories();
  const document = createDocumentFromStoryFrames(stories);
  const controller = new LiveResizeController({ minFrameIntervalMs: 16 });

  controller.beginResize({
    pageId: "page-1",
    pageBounds,
    contentBounds,
    columns,
    frames: stories.map(toFrame),
    sourceFrameId: "source",
    before: { x: 20, y: 20, width: 180, height: 180 },
    handle: "e",
    startPointer: { x: 200, y: 110 },
    minSize: { width: 80, height: 80 },
    commitContext: {
      stories,
      document,
      pageId: document.pages[0].id,
    },
  });

  return { controller, stories };
};

const assertPreviewDoesNotMutateStories = () => {
  const { controller, stories } = beginController();
  const result = controller.updateResize({
    pointer: { x: 272, y: 110 },
    nowMs: 20,
    force: true,
  });

  assert(result);
  assert.equal(stories[0].width, 180);
  assert.equal(stories[1].x, 220);
  assert(result.preview.solution.valid);
  assert(result.preview.frames.some((frame) => frame.frameId === "source" && frame.after.width > 180));
  assert(result.drawCommands.length > 0);
};

const assertThrottlesToFrameBudget = () => {
  const { controller } = beginController();

  assert(controller.updateResize({ pointer: { x: 240, y: 110 }, nowMs: 20, force: true }));
  assert.equal(controller.updateResize({ pointer: { x: 250, y: 110 }, nowMs: 24 }), null);
  assert(controller.updateResize({ pointer: { x: 250, y: 110 }, nowMs: 40 }));
};

const assertCancelDiscardsPreview = () => {
  const { controller } = beginController();

  controller.updateResize({ pointer: { x: 272, y: 110 }, nowMs: 20, force: true });
  const result = controller.cancelResize();

  assert.equal(result.committed, false);
  assert.equal(result.discarded, true);
  assert.equal(result.preview?.status, "discarded");
};

const assertReleaseCommitsOnlyAfterValidPreview = () => {
  const { controller, stories } = beginController();

  controller.updateResize({ pointer: { x: 272, y: 110 }, nowMs: 20, force: true });
  assert.equal(stories[0].width, 180);

  const result = controller.endResize();

  assert.equal(result.committed, true);
  assert(result.commit);
  assert.deepEqual(result.commit.updatedStoryIds, ["neighbor", "source"]);
  assert.equal(result.commit.stories[0].width, 252);
  assert.equal(result.commit.stories[1].width, 108);
  assert.equal(stories[0].width, 180);
};

const assertDeterministicPreviewOutput = () => {
  const first = beginController().controller.updateResize({
    pointer: { x: 272, y: 110 },
    nowMs: 20,
    force: true,
  });
  const second = beginController().controller.updateResize({
    pointer: { x: 272, y: 110 },
    nowMs: 20,
    force: true,
  });
  const stripTiming = (result: NonNullable<typeof first>) => ({
    preview: {
      ...result.preview,
      metrics: {
        snapshotTimeMs: 0,
        constraintTimeMs: 0,
        neighborTimeMs: 0,
        spaceTimeMs: 0,
        patchTimeMs: 0,
        solveTimeMs: 0,
        diffTimeMs: 0,
        totalTimeMs: 0,
      },
    },
    drawCommands: result.drawCommands,
  });

  assert(first);
  assert(second);
  assert.deepEqual(stripTiming(first), stripTiming(second));
};

assertPreviewDoesNotMutateStories();
assertThrottlesToFrameBudget();
assertCancelDiscardsPreview();
assertReleaseCommitsOnlyAfterValidPreview();
assertDeterministicPreviewOutput();

console.log("LiveResize preview tests passed: 5");
