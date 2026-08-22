import type { EditorPerformanceDiagnostics } from "@/types/editor";

export type PerformanceOperationName =
  | "store-update"
  | "cache-lookup"
  | "story-compose"
  | "paragraph-compose"
  | "headline-compose"
  | "image-placement"
  | "rich-text"
  | "optical-typography"
  | "composition"
  | "render"
  | "konva-draw"
  | "inspector-update"
  | string;

export type PerformanceProfilerSample = {
  name: PerformanceOperationName;
  durationMs: number;
  metadata?: Record<string, unknown>;
  timestamp: number;
};

export type PerformanceProfilerTimelineEvent = {
  stage: string;
  durationMs: number;
};

export type PerformanceProfilerCacheAudit = {
  cacheSize: number;
  hitPercent: number;
  missPercent: number;
  evictions: number;
  largestCache: string;
  mostRecomposedStoryId: string;
};

export type PerformanceProfilerSnapshot = {
  samples: PerformanceProfilerSample[];
  timeline: PerformanceProfilerTimelineEvent[];
  hotPathOperations: EditorPerformanceDiagnostics["hotPathOperations"];
  slowReactComponents: EditorPerformanceDiagnostics["slowReactComponents"];
  slowStories: EditorPerformanceDiagnostics["slowStories"];
  renderStageBreakdown: EditorPerformanceDiagnostics["renderStageBreakdown"];
  cacheAudit: PerformanceProfilerCacheAudit;
  averageFrameTimeMs: number;
  worstFrameTimeMs: number;
  averageFps: number;
  minimumFps: number;
  maximumFps: number;
};

const MAX_SAMPLES = 800;
const MAX_FRAMES = 180;
const SLOW_OPERATION_THRESHOLD_MS = 2;

const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const round = (value: number) => Math.round(value * 100) / 100;

export class PerformanceProfiler {
  private samples: PerformanceProfilerSample[] = [];
  private frames: number[] = [];
  private cacheAudit: PerformanceProfilerCacheAudit = {
    cacheSize: 0,
    hitPercent: 0,
    missPercent: 0,
    evictions: 0,
    largestCache: "story-composition",
    mostRecomposedStoryId: "-",
  };
  private storyRecomposeCounts = new Map<string, number>();

  recordOperation(
    name: PerformanceOperationName,
    durationMs: number,
    metadata?: Record<string, unknown>,
  ) {
    this.samples.push({
      name,
      durationMs: round(durationMs),
      metadata,
      timestamp: now(),
    });

    if (name === "story-compose" && typeof metadata?.storyId === "string") {
      this.storyRecomposeCounts.set(
        metadata.storyId,
        (this.storyRecomposeCounts.get(metadata.storyId) ?? 0) + 1,
      );
    }

    if (this.samples.length > MAX_SAMPLES) {
      this.samples.splice(0, this.samples.length - MAX_SAMPLES);
    }
  }

  timeOperation<T>(
    name: PerformanceOperationName,
    operation: () => T,
    metadata?: Record<string, unknown>,
  ): T {
    const startedAt = now();

    try {
      return operation();
    } finally {
      this.recordOperation(name, now() - startedAt, metadata);
    }
  }

  recordFrame(durationMs: number) {
    this.frames.push(round(durationMs));

    if (this.frames.length > MAX_FRAMES) {
      this.frames.splice(0, this.frames.length - MAX_FRAMES);
    }
  }

  updateCacheAudit(input: Partial<PerformanceProfilerCacheAudit>) {
    this.cacheAudit = {
      ...this.cacheAudit,
      ...input,
      mostRecomposedStoryId: input.mostRecomposedStoryId ?? this.getMostRecomposedStoryId(),
    };
  }

  getMostRecomposedStoryId() {
    let selected = "-";
    let maxCount = 0;

    for (const [storyId, count] of this.storyRecomposeCounts.entries()) {
      if (count > maxCount) {
        selected = storyId;
        maxCount = count;
      }
    }

    return selected;
  }

  getSnapshot(): PerformanceProfilerSnapshot {
    const samples = [...this.samples];
    const frames = [...this.frames];
    const slowOperations = samples.filter((sample) => sample.durationMs >= SLOW_OPERATION_THRESHOLD_MS);
    const byName = new Map<string, { name: string; durationMs: number; count: number }>();

    for (const sample of slowOperations) {
      const existing = byName.get(sample.name) ?? {
        name: sample.name,
        durationMs: 0,
        count: 0,
      };

      existing.durationMs += sample.durationMs;
      existing.count += 1;
      byName.set(sample.name, existing);
    }

    const hotPathOperations = [...byName.values()]
      .map((operation) => ({
        ...operation,
        durationMs: round(operation.durationMs),
      }))
      .sort((first, second) => second.durationMs - first.durationMs)
      .slice(0, 20);
    const reactComponents = new Map<
      string,
      { name: string; renderCount: number; totalRenderTimeMs: number; longestRenderTimeMs: number; whyRendered: string }
    >();
    const slowStories = new Map<string, { storyId: string; renderTimeMs: number; nodeCount: number }>();

    for (const sample of samples) {
      if (typeof sample.metadata?.component === "string") {
        const name = sample.metadata.component;
        const existing = reactComponents.get(name) ?? {
          name,
          renderCount: 0,
          totalRenderTimeMs: 0,
          longestRenderTimeMs: 0,
          whyRendered: "measured by React Profiler",
        };

        existing.renderCount += 1;
        existing.totalRenderTimeMs += sample.durationMs;
        existing.longestRenderTimeMs = Math.max(existing.longestRenderTimeMs, sample.durationMs);
        existing.whyRendered = String(sample.metadata.whyRendered ?? existing.whyRendered);
        reactComponents.set(name, existing);
      }

      if (typeof sample.metadata?.storyId === "string" && sample.name.includes("render")) {
        const storyId = sample.metadata.storyId;
        const existing = slowStories.get(storyId) ?? {
          storyId,
          renderTimeMs: 0,
          nodeCount: 0,
        };

        existing.renderTimeMs += sample.durationMs;
        existing.nodeCount = Math.max(existing.nodeCount, Number(sample.metadata.nodeCount ?? 0));
        slowStories.set(storyId, existing);
      }
    }

    const slowReactComponents = [...reactComponents.values()]
      .map((component) => ({
        name: component.name,
        renderCount: component.renderCount,
        averageRenderTimeMs: round(component.totalRenderTimeMs / Math.max(1, component.renderCount)),
        longestRenderTimeMs: round(component.longestRenderTimeMs),
        whyRendered: component.whyRendered,
      }))
      .sort((first, second) => second.longestRenderTimeMs - first.longestRenderTimeMs)
      .slice(0, 20);
    const slowStoryList = [...slowStories.values()]
      .map((story) => ({
        ...story,
        renderTimeMs: round(story.renderTimeMs),
      }))
      .sort((first, second) => second.renderTimeMs - first.renderTimeMs)
      .slice(0, 20);
    const renderStageNames = [
      "editor-canvas-render",
      "canvas-layer-render",
      "story-layer-render",
      "story-render",
      "article-box-render",
      "headline-render",
      "subheadline-render",
      "body-render",
      "image-render",
      "caption-render",
      "factbox-render",
      "pullquote-render",
      "selection-render",
      "guides-render",
      "grid-render",
      "react-render",
      "react-commit",
      "konva-draw",
      "konva-batch-draw",
    ];
    const renderStageBreakdown = renderStageNames.map((stage) => ({
      stage,
      durationMs: round(
        samples
          .filter((sample) => sample.name === stage)
          .slice(-12)
          .reduce((sum, sample) => sum + sample.durationMs, 0),
      ),
    }));
    const timeline = [
      "store-update",
      "composition",
      "headline-compose",
      "paragraph-compose",
      "story-compose",
      "image-placement",
      "rich-text",
      "optical-typography",
      "render",
      "konva-draw",
    ].map((stage) => ({
      stage,
      durationMs: round(
        samples
          .filter((sample) => sample.name === stage)
          .slice(-6)
          .reduce((sum, sample) => sum + sample.durationMs, 0),
      ),
    }));
    const averageFrameTimeMs =
      frames.length > 0 ? round(frames.reduce((sum, frame) => sum + frame, 0) / frames.length) : 0;
    const worstFrameTimeMs = frames.length > 0 ? Math.max(...frames) : 0;
    const fpsValues = frames.map((frame) => (frame > 0 ? 1000 / frame : 0)).filter(Boolean);
    const averageFps =
      fpsValues.length > 0 ? Math.round(fpsValues.reduce((sum, fps) => sum + fps, 0) / fpsValues.length) : 0;

    return {
      samples,
      timeline,
      hotPathOperations,
      slowReactComponents,
      slowStories: slowStoryList,
      renderStageBreakdown,
      cacheAudit: {
        ...this.cacheAudit,
        mostRecomposedStoryId: this.getMostRecomposedStoryId(),
      },
      averageFrameTimeMs,
      worstFrameTimeMs,
      averageFps,
      minimumFps: fpsValues.length > 0 ? Math.round(Math.min(...fpsValues)) : 0,
      maximumFps: fpsValues.length > 0 ? Math.round(Math.max(...fpsValues)) : 0,
    };
  }
}

export const createPerformanceProfiler = () => new PerformanceProfiler();

export const getMemoryUsageMb = () => {
  if (typeof performance === "undefined") {
    return 0;
  }

  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } })?.memory;

  return memory ? Math.round((memory.usedJSHeapSize / 1024 / 1024) * 10) / 10 : 0;
};
