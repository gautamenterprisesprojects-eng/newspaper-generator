"use client";

import type { EditorPerformanceDiagnostics } from "@/types/editor";

type PerformanceOverlayProps = {
  diagnostics: EditorPerformanceDiagnostics;
};

const formatMs = (value: number) => `${value.toFixed(2)} ms`;

export function PerformanceOverlay({ diagnostics }: PerformanceOverlayProps) {
  const slowest = diagnostics.hotPathOperations.slice(0, 8);
  const stages = diagnostics.renderStageBreakdown
    .filter((stage) => stage.durationMs > 0)
    .slice(0, 10);
  const components = diagnostics.slowReactComponents.slice(0, 8);
  const stories = diagnostics.slowStories.slice(0, 6);

  return (
    <aside className="performance-overlay" aria-label="Performance profiler">
      <div className="performance-overlay-title">Performance Profiler</div>
      <div className="performance-overlay-grid">
        <span>FPS</span>
        <strong>{diagnostics.fps}</strong>
        <span>Frame Time</span>
        <strong>{formatMs(diagnostics.averageFrameTimeMs || diagnostics.renderTimeMs)}</strong>
        <span>Composition</span>
        <strong>{formatMs(diagnostics.compositionTimeMs)}</strong>
        <span>Render</span>
        <strong>{formatMs(diagnostics.renderTimeMs)}</strong>
        <span>Konva Draw</span>
        <strong>{formatMs(diagnostics.konvaDrawTimeMs)}</strong>
        <span>Batch Draw</span>
        <strong>{formatMs(diagnostics.konvaBatchDrawTimeMs)}</strong>
        <span>Article Render</span>
        <strong>{formatMs(diagnostics.articleBoxRenderTimeMs || diagnostics.storyRenderTimeMs)}</strong>
        <span>Body Render</span>
        <strong>{formatMs(diagnostics.bodyRenderTimeMs)}</strong>
        <span>Recomposed</span>
        <strong>{diagnostics.storiesRecomposed}</strong>
        <span>Cached</span>
        <strong>{diagnostics.storiesCached}</strong>
        <span>Dirty Stories</span>
        <strong>{diagnostics.dirtyStories}</strong>
        <span>Cache Hit</span>
        <strong>{diagnostics.cacheHitPercent.toFixed(1)}%</strong>
        <span>Memory</span>
        <strong>{diagnostics.memoryUsageMb.toFixed(1)} MB</strong>
        <span>Konva Nodes</span>
        <strong>{diagnostics.konvaNodes}</strong>
        <span>Text Nodes</span>
        <strong>{diagnostics.textNodeCount}</strong>
        <span>Groups</span>
        <strong>{diagnostics.groupCount}</strong>
        <span>Rects</span>
        <strong>{diagnostics.rectCount}</strong>
        <span>Lines</span>
        <strong>{diagnostics.lineCount}</strong>
        <span>Created / Destroyed</span>
        <strong>
          {diagnostics.createdNodes} / {diagnostics.destroyedNodes}
        </strong>
        <span>Visible Stories</span>
        <strong>{diagnostics.visibleStories}</strong>
        <span>Avg Story Compose</span>
        <strong>{formatMs(diagnostics.averageStoryComposeMs)}</strong>
        <span>Slowest Story</span>
        <strong>{formatMs(diagnostics.slowestStoryMs)}</strong>
        <span>Inspector</span>
        <strong>{formatMs(diagnostics.inspectorUpdateTimeMs)}</strong>
        <span>Store Update</span>
        <strong>{formatMs(diagnostics.storeUpdateTimeMs)}</strong>
      </div>

      <div className="performance-overlay-subtitle">Render Stages</div>
      <ol className="performance-hot-path-list">
        {stages.length > 0 ? (
          stages.map((stage) => (
            <li key={stage.stage}>
              <span>{stage.stage}</span>
              <strong>{formatMs(stage.durationMs)}</strong>
            </li>
          ))
        ) : (
          <li>
            <span>No render samples</span>
            <strong>0 ms</strong>
          </li>
        )}
      </ol>

      <div className="performance-overlay-subtitle">Top Slow Operations</div>
      <ol className="performance-hot-path-list">
        {slowest.length > 0 ? (
          slowest.map((operation) => (
            <li key={operation.name}>
              <span>{operation.name}</span>
              <strong>
                {formatMs(operation.durationMs)} / {operation.count}
              </strong>
            </li>
          ))
        ) : (
          <li>
            <span>No slow operations</span>
            <strong>&lt;2 ms</strong>
          </li>
        )}
      </ol>

      <div className="performance-overlay-subtitle">Top React Components</div>
      <ol className="performance-hot-path-list">
        {components.length > 0 ? (
          components.map((component) => (
            <li key={component.name}>
              <span title={component.whyRendered}>
                {component.name}
                <small>{component.whyRendered}</small>
              </span>
              <strong>
                {formatMs(component.longestRenderTimeMs)} / {component.renderCount}
              </strong>
            </li>
          ))
        ) : (
          <li>
            <span>No component samples</span>
            <strong>-</strong>
          </li>
        )}
      </ol>

      <div className="performance-overlay-subtitle">Top Stories</div>
      <ol className="performance-hot-path-list">
        {stories.length > 0 ? (
          stories.map((story) => (
            <li key={story.storyId}>
              <span>{story.storyId}</span>
              <strong>
                {formatMs(story.renderTimeMs)} / {story.nodeCount}
              </strong>
            </li>
          ))
        ) : (
          <li>
            <span>No story samples</span>
            <strong>-</strong>
          </li>
        )}
      </ol>
    </aside>
  );
}
