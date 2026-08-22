import type { IncrementalCompositionResult } from "@/engines/IncrementalComposition/IncrementalCompositionEngine";
import type { LayoutRect, LayoutSolution } from "@/engines/LayoutTransactionEngine/LayoutTransactionTypes";

export type CompositionOperationType =
  | "resize-story"
  | "move-story"
  | "delete-story"
  | "insert-story"
  | "image-resize"
  | "image-crop"
  | "headline-change";

export type CompositionGeometrySnapshot = Record<string, LayoutRect>;

export type CompositionTransactionMetrics = {
  layoutChangedFrameCount: number;
  affectedStoryCount: number;
  affectedColumnCount: number;
  whitespaceRemoved: number;
  overflowRemoved: number;
  executionTimeMs: number;
};

export type CompositionTransaction = {
  id: string;
  sessionId: string;
  pageId: string;
  operation: CompositionOperationType;
  beforeGeometry: CompositionGeometrySnapshot;
  afterGeometry: CompositionGeometrySnapshot;
  beforeComposition?: IncrementalCompositionResult;
  afterComposition?: IncrementalCompositionResult;
  affectedStories: string[];
  affectedImages: string[];
  affectedCaptions: string[];
  layoutSolution?: LayoutSolution;
  layoutMetrics: LayoutSolution["metrics"] | null;
  typographyMetrics: Record<string, number>;
  metrics: CompositionTransactionMetrics;
  createdAt: number;
};

const cloneGeometry = (geometry: CompositionGeometrySnapshot): CompositionGeometrySnapshot =>
  Object.fromEntries(
    Object.entries(geometry).map(([frameId, rect]) => [
      frameId,
      {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
    ]),
  );

const getChangedStories = (
  before: CompositionGeometrySnapshot,
  after: CompositionGeometrySnapshot,
) =>
  Object.keys(after)
    .filter((storyId) => {
      const previous = before[storyId];
      const next = after[storyId];

      return !previous ||
        previous.x !== next.x ||
        previous.y !== next.y ||
        previous.width !== next.width ||
        previous.height !== next.height;
    })
    .sort();

/** Builds an immutable composition transaction from session before/after state. */
export const createCompositionTransaction = ({
  id,
  sessionId,
  pageId,
  operation,
  beforeGeometry,
  afterGeometry,
  beforeComposition,
  afterComposition,
  layoutSolution,
  affectedImages = [],
  affectedCaptions = [],
  executionTimeMs,
}: {
  id: string;
  sessionId: string;
  pageId: string;
  operation: CompositionOperationType;
  beforeGeometry: CompositionGeometrySnapshot;
  afterGeometry: CompositionGeometrySnapshot;
  beforeComposition?: IncrementalCompositionResult;
  afterComposition?: IncrementalCompositionResult;
  layoutSolution?: LayoutSolution;
  affectedImages?: string[];
  affectedCaptions?: string[];
  executionTimeMs: number;
}): CompositionTransaction => {
  const affectedStories = getChangedStories(beforeGeometry, afterGeometry);

  return {
    id,
    sessionId,
    pageId,
    operation,
    beforeGeometry: cloneGeometry(beforeGeometry),
    afterGeometry: cloneGeometry(afterGeometry),
    beforeComposition,
    afterComposition,
    affectedStories,
    affectedImages: [...affectedImages].sort(),
    affectedCaptions: [...affectedCaptions].sort(),
    layoutSolution,
    layoutMetrics: layoutSolution?.metrics ? { ...layoutSolution.metrics } : null,
    typographyMetrics: {
      beforeCompositionTimeMs: beforeComposition?.diagnostics.compositionTimeMs ?? 0,
      afterCompositionTimeMs: afterComposition?.diagnostics.compositionTimeMs ?? 0,
      recomposedStories: afterComposition?.diagnostics.storiesRecomposed ?? 0,
    },
    metrics: {
      layoutChangedFrameCount: layoutSolution?.metrics.changedFrameCount ?? affectedStories.length,
      affectedStoryCount: affectedStories.length,
      affectedColumnCount: 0,
      whitespaceRemoved: 0,
      overflowRemoved: 0,
      executionTimeMs,
    },
    createdAt: Date.now(),
  };
};
