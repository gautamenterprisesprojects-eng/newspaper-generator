import { strict as assert } from "node:assert";
import { prototypeArticle } from "@/data/prototypeArticle";
import { createDocumentFromStoryFrames } from "@/engines/DocumentEngine/DocumentEngine";
import { createCleanDirtyFlags } from "@/engines/IncrementalComposition/IncrementalCompositionEngine";
import type { StoryFrame } from "@/types/editor";
import { commitLayoutSolution } from "./LayoutCommitEngine";
import type { LayoutSolution } from "./LayoutTransactionTypes";

const createStory = (id: string, x: number): StoryFrame => ({
  id,
  x,
  y: 20,
  width: 180,
  height: 220,
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

const createSolution = (valid: boolean): LayoutSolution => ({
  id: "solution-1",
  pageId: "page-1",
  valid,
  before: {},
  after: {
    story1: { x: 40, y: 20, width: 200, height: 220 },
  },
  geometryChanges: [],
  affectedFrames: ["story1"],
  dirtyFrames: ["story1"],
  metrics: {
    changedFrameCount: valid ? 1 : 0,
    affectedFrameCount: 1,
    dirtyFrameCount: valid ? 1 : 0,
    collisionCount: 0,
    unresolvedCollisionCount: 0,
    warningCount: 0,
    totalChangedArea: 0,
  },
  warnings: [],
  errors: valid ? [] : ["bad layout"],
});

const stories = [createStory("story1", 20), createStory("story2", 260)];
const document = createDocumentFromStoryFrames(stories);

const assertCommitsMinimalUpdates = () => {
  const result = commitLayoutSolution({
    stories,
    document,
    pageId: document.pages[0].id,
    solution: createSolution(true),
  });

  assert.equal(result.committed, true);
  assert.deepEqual(result.updatedStoryIds, ["story1"]);
  assert.equal(result.stories[0].x, 40);
  assert.equal(result.stories[0].width, 200);
  assert.equal(result.stories[1], stories[1]);
  assert.equal(result.stories[0].dirtyFlags?.geometryDirty, true);
  assert.equal(result.stories[0].dirtyFlags?.compositionDirty, true);
  assert.equal(result.stories[0].dirtyFlags?.renderDirty, true);
};

const assertRollsBackInvalidSolution = () => {
  const result = commitLayoutSolution({
    stories,
    document,
    pageId: document.pages[0].id,
    solution: createSolution(false),
  });

  assert.equal(result.committed, false);
  assert.equal(result.stories, stories);
  assert.equal(result.document, document);
  assert(result.errors[0].includes("rolled back"));
};

assertCommitsMinimalUpdates();
assertRollsBackInvalidSolution();

console.log("LayoutCommitEngine tests passed: 2");
