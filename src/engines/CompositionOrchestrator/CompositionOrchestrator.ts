import {
  composeStoriesIncrementally,
  type IncrementalCompositionResult,
  type IncrementalStoryLayout,
  type StoryCompositionCache,
} from "@/engines/IncrementalComposition/IncrementalCompositionEngine";
import { analyzeLayoutSnapshot } from "@/engines/LayoutTransactionEngine/LayoutSnapshotAnalyzer";
import { buildLayoutCluster } from "@/engines/LayoutTransactionEngine/LayoutClusterBuilder";
import { runLayoutKernelShadowResize, type LayoutDiff } from "@/engines/LayoutTransactionEngine/LayoutKernelAdapter";
import { rectBottom, rectRight, rectsOverlap } from "@/engines/LayoutTransactionEngine/LayoutGeometry";
import { mergeRegionFlowIntoLayoutSolution } from "@/engines/LayoutTransactionEngine/RegionFlowBridge";
import { solveRegionFlow } from "@/engines/LayoutTransactionEngine/RegionFlowSolver";
import type {
  LayoutColumn,
  LayoutFrameSnapshot,
  LayoutRect,
  LayoutSolution,
} from "@/engines/LayoutTransactionEngine/LayoutTransactionTypes";
import { cloneStoryProfile, type StoryProfile } from "@/engines/EditorialStory";
import type { ArticleBoxModel, StoryFrame } from "@/types/editor";
import type { NewspaperPageId } from "@/types/document";

export type CompositionOrchestratorInput = {
  pageId: NewspaperPageId;
  pageBounds: LayoutRect;
  contentBounds: LayoutRect;
  columns: LayoutColumn[];
  stories: StoryFrame[];
  changedStoryIds: string[];
  productionView?: boolean;
  cache?: StoryCompositionCache;
  maxIterations?: number;
  minSize?: Pick<LayoutRect, "width" | "height">;
  underflowWhitespacePercent?: number;
  illegalWhitespaceArea?: number;
  storyProfiles?: Record<string, StoryProfile>;
};

export type CompositionIterationDiagnostics = {
  iteration: number;
  overflowStoryIds: string[];
  underflowStoryIds: string[];
  collisionCount: number;
  illegalWhitespaceArea: number;
  stable: boolean;
  requestedLayout: boolean;
  storyProfileIds: string[];
  warnings: string[];
};

export type CompositionOrchestratorResult = {
  stable: boolean;
  reason: "stable" | "max-iteration" | "no-layout-solution";
  stories: StoryFrame[];
  composition: IncrementalCompositionResult;
  layoutSolutions: LayoutSolution[];
  layoutDiffs: LayoutDiff[];
  iterations: CompositionIterationDiagnostics[];
  storyProfiles: Record<string, StoryProfile>;
};

const DEFAULT_MAX_ITERATIONS = 4;
const DEFAULT_MIN_SIZE = { width: 120, height: 80 };
const DEFAULT_UNDERFLOW_WHITESPACE_PERCENT = 24;
const DEFAULT_ILLEGAL_WHITESPACE_AREA = 1;
const OVERFLOW_GROW_STEP = 36;
const UNDERFLOW_SHRINK_STEP = 24;

const toArticleBox = (story: StoryFrame): ArticleBoxModel => ({
  x: story.x,
  y: story.y,
  width: story.width,
  height: story.height,
});

const toFrameSnapshots = (
  stories: StoryFrame[],
  pageId: NewspaperPageId,
): LayoutFrameSnapshot[] =>
  stories.map((story, index) => ({
    id: story.id,
    pageId,
    storyId: story.id,
    kind: "story",
    locked: Boolean(story.locked),
    hidden: Boolean(story.hidden),
    pinned: false,
    priority: story.priority,
    columnStart: story.columnStart,
    columnSpan: story.columnSpan,
    zIndex: index,
    x: story.x,
    y: story.y,
    width: story.width,
    height: story.height,
  }));

const countCollisions = (frames: LayoutFrameSnapshot[]) => {
  let collisionCount = 0;

  for (let firstIndex = 0; firstIndex < frames.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < frames.length; secondIndex += 1) {
      if (rectsOverlap(frames[firstIndex], frames[secondIndex])) {
        collisionCount += 1;
      }
    }
  }

  return collisionCount;
};

const getIllegalWhitespaceArea = ({
  stories,
  pageId,
  pageBounds,
  contentBounds,
  columns,
}: Pick<CompositionOrchestratorInput, "pageId" | "pageBounds" | "contentBounds" | "columns"> & {
  stories: StoryFrame[];
}) => {
  const snapshot = analyzeLayoutSnapshot({
    pageId,
    pageBounds,
    contentBounds,
    columns,
    frames: toFrameSnapshots(stories, pageId),
  });

  return snapshot.whitespaceMap.reduce((sum, cell) => sum + cell.area, 0);
};

const getOverflowStoryIds = (layouts: IncrementalStoryLayout[]) =>
  layouts
    .filter(({ layout }) => layout.metrics.overflow || layout.metrics.overflowPercentage > 0)
    .map(({ story }) => story.id)
    .sort();

const getUnderflowStoryIds = (
  layouts: IncrementalStoryLayout[],
  underflowWhitespacePercent: number,
) =>
  layouts
    .filter(({ layout }) =>
      !layout.metrics.overflow &&
      layout.metrics.whitespacePercentage >= underflowWhitespacePercent,
    )
    .map(({ story }) => story.id)
    .sort();

const chooseLayoutTarget = ({
  stories,
  overflowStoryIds,
  underflowStoryIds,
  changedStoryIds,
}: {
  stories: StoryFrame[];
  overflowStoryIds: string[];
  underflowStoryIds: string[];
  changedStoryIds: string[];
}) => {
  const priorityIds = [...changedStoryIds, ...overflowStoryIds, ...underflowStoryIds];
  const storyId = priorityIds.find((id) => stories.some((story) => story.id === id));

  return storyId ? stories.find((story) => story.id === storyId) ?? null : null;
};

const getRequestedRect = ({
  story,
  overflow,
  underflow,
  minSize,
}: {
  story: StoryFrame;
  overflow: boolean;
  underflow: boolean;
  minSize: Pick<LayoutRect, "width" | "height">;
}): LayoutRect => {
  if (overflow) {
    return {
      ...toArticleBox(story),
      height: story.height + OVERFLOW_GROW_STEP,
    };
  }

  if (underflow) {
    return {
      ...toArticleBox(story),
      height: Math.max(minSize.height, story.height - UNDERFLOW_SHRINK_STEP),
    };
  }

  return {
    ...toArticleBox(story),
    height: story.height + OVERFLOW_GROW_STEP,
  };
};

const applyLayoutSolutionToStories = (
  stories: StoryFrame[],
  solution: LayoutSolution,
) =>
  stories.map((story) => {
    const rect = solution.after[story.id];

    if (!rect) {
      return story;
    }

    return {
      ...story,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  });

const rectsByStoryId = (stories: StoryFrame[]) =>
  Object.fromEntries(stories.map((story) => [story.id, toArticleBox(story)]));

const sameStoryGeometry = (first: StoryFrame[], second: StoryFrame[]) => {
  const before = rectsByStoryId(first);
  const after = rectsByStoryId(second);

  return Object.keys(before).every((storyId) => {
    const current = before[storyId];
    const next = after[storyId];

    return Boolean(next) &&
      current.x === next.x &&
      current.y === next.y &&
      current.width === next.width &&
      current.height === next.height;
  });
};

const cloneStoryProfiles = (profiles: Record<string, StoryProfile> = {}) =>
  Object.fromEntries(
    Object.entries(profiles)
      .sort(([firstId], [secondId]) => firstId.localeCompare(secondId))
      .map(([storyId, profile]) => [storyId, cloneStoryProfile(profile)]),
  );

/**
 * Runs the newspaper composition root pipeline until layout and composition are stable.
 *
 * The orchestrator coordinates typography/copyfit composition, overflow and
 * underflow detection, layout-kernel requests, and targeted recomposition
 * loops. It does not mutate editor stores or document state.
 */
export const orchestrateComposition = (
  input: CompositionOrchestratorInput,
): CompositionOrchestratorResult => {
  const maxIterations = input.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const minSize = input.minSize ?? DEFAULT_MIN_SIZE;
  const underflowWhitespacePercent = input.underflowWhitespacePercent ?? DEFAULT_UNDERFLOW_WHITESPACE_PERCENT;
  const illegalWhitespaceArea = input.illegalWhitespaceArea ?? DEFAULT_ILLEGAL_WHITESPACE_AREA;
  const cache = input.cache ?? new Map();
  const layoutSolutions: LayoutSolution[] = [];
  const layoutDiffs: LayoutDiff[] = [];
  const iterations: CompositionIterationDiagnostics[] = [];
  const storyProfiles = cloneStoryProfiles(input.storyProfiles);
  const storyProfileIds = Object.keys(storyProfiles);
  let stories = input.stories.map((story) => ({ ...story }));
  let composition = composeStoriesIncrementally({
    stories,
    productionView: Boolean(input.productionView),
    cache,
  });

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    composition = composeStoriesIncrementally({
      stories,
      productionView: Boolean(input.productionView),
      cache,
    });

    const frames = toFrameSnapshots(stories, input.pageId);
    const overflowStoryIds = getOverflowStoryIds(composition.storyLayouts);
    const underflowStoryIds = getUnderflowStoryIds(composition.storyLayouts, underflowWhitespacePercent);
    const collisionCount = countCollisions(frames);
    const whitespaceArea = getIllegalWhitespaceArea({
      stories,
      pageId: input.pageId,
      pageBounds: input.pageBounds,
      contentBounds: input.contentBounds,
      columns: input.columns,
    });
    const stable =
      overflowStoryIds.length === 0 &&
      underflowStoryIds.length === 0 &&
      collisionCount === 0 &&
      whitespaceArea <= illegalWhitespaceArea;

    iterations.push({
      iteration,
      overflowStoryIds,
      underflowStoryIds,
      collisionCount,
      illegalWhitespaceArea: whitespaceArea,
      stable,
      requestedLayout: false,
      storyProfileIds,
      warnings: [],
    });

    if (stable) {
      return {
        stable: true,
        reason: "stable",
        stories,
        composition,
        layoutSolutions,
        layoutDiffs,
        iterations,
        storyProfiles,
      };
    }

    const target = chooseLayoutTarget({
      stories,
      overflowStoryIds,
      underflowStoryIds,
      changedStoryIds: input.changedStoryIds,
    });

    if (!target) {
      return {
        stable: false,
        reason: "no-layout-solution",
        stories,
        composition,
        layoutSolutions,
        layoutDiffs,
        iterations,
        storyProfiles,
      };
    }

    const requested = getRequestedRect({
      story: target,
      overflow: overflowStoryIds.includes(target.id),
      underflow: underflowStoryIds.includes(target.id),
      minSize,
    });
    const diff = runLayoutKernelShadowResize({
      pageId: input.pageId,
      pageBounds: input.pageBounds,
      contentBounds: input.contentBounds,
      columns: input.columns,
      frames,
      sourceFrameId: target.id,
      before: toArticleBox(target),
      requested,
      minSize,
      baselineGridSize: target.compositionSettings.baselineGridSize,
    });
    const latest = iterations[iterations.length - 1];
    latest.requestedLayout = true;
    latest.warnings = [...diff.warnings, ...diff.constraintViolations];
    layoutDiffs.push(diff);
    const regionSnapshot = analyzeLayoutSnapshot({
      pageId: input.pageId,
      pageBounds: input.pageBounds,
      contentBounds: input.contentBounds,
      columns: input.columns,
      frames,
    });
    const cluster = buildLayoutCluster({
      snapshot: regionSnapshot,
      sourceFrameId: target.id,
    });
    const balancedCluster = solveRegionFlow({
      cluster,
      contentBounds: input.contentBounds,
      columns: input.columns,
      proposedRects: diff.solution.after,
    });
    const mergedSolution = mergeRegionFlowIntoLayoutSolution({
      solution: diff.solution,
      balancedCluster,
    });

    layoutSolutions.push(mergedSolution);

    if (!mergedSolution.valid || mergedSolution.affectedFrames.length === 0) {
      return {
        stable: false,
        reason: "no-layout-solution",
        stories,
        composition,
        layoutSolutions,
        layoutDiffs,
        iterations,
        storyProfiles,
      };
    }

    const nextStories = applyLayoutSolutionToStories(stories, mergedSolution);

    if (sameStoryGeometry(stories, nextStories)) {
      return {
        stable: false,
        reason: "no-layout-solution",
        stories,
        composition,
        layoutSolutions,
        layoutDiffs,
        iterations,
        storyProfiles,
      };
    }

    stories = nextStories;
  }

  composition = composeStoriesIncrementally({
    stories,
    productionView: Boolean(input.productionView),
    cache,
  });

  return {
    stable: false,
    reason: "max-iteration",
    stories,
    composition,
    layoutSolutions,
    layoutDiffs,
    iterations,
    storyProfiles,
  };
};

/** Public facade for the root newspaper composition pipeline. */
export const CompositionOrchestrator = {
  orchestrateComposition,
};
