import { strict as assert } from "node:assert";
import { prototypeArticle } from "@/data/prototypeArticle";
import { createDocumentFromStoryFrames } from "@/engines/DocumentEngine/DocumentEngine";
import { createCleanDirtyFlags } from "@/engines/IncrementalComposition/IncrementalCompositionEngine";
import type { StoryFrame } from "@/types/editor";
import { commitLayoutSolution } from "./LayoutCommitEngine";
import { mergeRegionFlowIntoLayoutSolution } from "./RegionFlowBridge";
import type { BalancedCluster } from "./LayoutCluster";
import type { LayoutSolution } from "./LayoutTransactionTypes";

const createSolution = (): LayoutSolution => ({
  id: "solution-1",
  pageId: "page-1",
  valid: true,
  before: {
    source: { x: 20, y: 20, width: 180, height: 160 },
    brief: { x: 20, y: 220, width: 180, height: 120 },
    side: { x: 220, y: 20, width: 180, height: 160 },
  },
  after: {
    source: { x: 20, y: 20, width: 180, height: 200 },
    brief: { x: 20, y: 220, width: 180, height: 120 },
    side: { x: 220, y: 20, width: 180, height: 160 },
  },
  geometryChanges: [
    {
      frameId: "source",
      before: { x: 20, y: 20, width: 180, height: 160 },
      after: { x: 20, y: 20, width: 180, height: 200 },
      changed: true,
      reasons: ["Geometry changed by solved patch pipeline."],
    },
    {
      frameId: "brief",
      before: { x: 20, y: 220, width: 180, height: 120 },
      after: { x: 20, y: 220, width: 180, height: 120 },
      changed: false,
      reasons: [],
    },
    {
      frameId: "side",
      before: { x: 220, y: 20, width: 180, height: 160 },
      after: { x: 220, y: 20, width: 180, height: 160 },
      changed: false,
      reasons: [],
    },
  ],
  affectedFrames: ["source"],
  dirtyFrames: ["source"],
  metrics: {
    changedFrameCount: 1,
    affectedFrameCount: 1,
    dirtyFrameCount: 1,
    collisionCount: 0,
    unresolvedCollisionCount: 0,
    warningCount: 0,
    totalChangedArea: 7200,
  },
  warnings: ["keep warning"],
  errors: [],
});

const createBalancedCluster = (): BalancedCluster => ({
  cluster: {
    id: "layout-cluster:source:source.brief.side",
    sourceFrameId: "source",
    frameIds: ["source", "brief", "side"],
    frames: [],
    bounds: { x: 20, y: 20, width: 380, height: 320 },
    whitespace: [],
    boundaries: [],
  },
  before: {
    source: { x: 20, y: 20, width: 180, height: 160 },
    brief: { x: 20, y: 220, width: 180, height: 120 },
    side: { x: 220, y: 20, width: 180, height: 160 },
  },
  after: {
    source: { x: 20, y: 20, width: 180, height: 220 },
    brief: { x: 20, y: 240, width: 180, height: 120 },
    side: { x: 220, y: 20, width: 180, height: 160 },
  },
  changedFrameIds: ["brief", "source"],
  unresolvedWhitespace: [],
  warnings: ["region warning should not be merged"],
  metrics: {
    beforeWhitespaceArea: 100,
    afterWhitespaceArea: 20,
    eliminatedWhitespaceArea: 80,
    changedFrameCount: 2,
    iterationCount: 1,
  },
});

const createStory = (id: string, rect: StoryFrame): StoryFrame => ({
  ...rect,
  id,
});

const baseStory = (rect: { x: number; y: number; width: number; height: number }): StoryFrame => ({
  id: "story",
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

const assertMergesOnlyChangedClusterFrames = () => {
  const solution = createSolution();
  const merged = mergeRegionFlowIntoLayoutSolution({
    solution,
    balancedCluster: createBalancedCluster(),
  });

  assert.notEqual(merged, solution);
  assert.deepEqual(merged.after.source, { x: 20, y: 20, width: 180, height: 220 });
  assert.deepEqual(merged.after.brief, { x: 20, y: 240, width: 180, height: 120 });
  assert.deepEqual(merged.after.side, solution.after.side);
  assert.deepEqual(merged.metrics, solution.metrics);
  assert.deepEqual(merged.warnings, solution.warnings);
  assert.equal(merged.id, solution.id);
};

const assertCommitReceivesRegionFlowGeometry = () => {
  const merged = mergeRegionFlowIntoLayoutSolution({
    solution: createSolution(),
    balancedCluster: createBalancedCluster(),
  });
  const stories = [
    createStory("source", baseStory({ x: 20, y: 20, width: 180, height: 160 })),
    createStory("brief", baseStory({ x: 20, y: 220, width: 180, height: 120 })),
    createStory("side", baseStory({ x: 220, y: 20, width: 180, height: 160 })),
  ];
  const document = createDocumentFromStoryFrames(stories);
  const commit = commitLayoutSolution({
    stories,
    document,
    pageId: document.pages[0].id,
    solution: merged,
  });

  assert.equal(commit.committed, true);
  assert.deepEqual(commit.updatedStoryIds, ["brief", "source"]);
  assert.equal(commit.stories.find((story) => story.id === "brief")?.y, 240);
  assert.equal(commit.stories.find((story) => story.id === "source")?.height, 220);
};

assertMergesOnlyChangedClusterFrames();
assertCommitReceivesRegionFlowGeometry();

console.log("RegionFlowBridge merge tests passed: 2");
