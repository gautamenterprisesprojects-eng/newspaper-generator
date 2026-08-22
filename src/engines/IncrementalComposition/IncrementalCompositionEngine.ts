import { composeArticleBox } from "@/engines/ArticleComposer/composeArticleBox";
import { normalizeContainerStyles } from "@/engines/ContainerBackground/ContainerBackgroundEngine";
import type { PerformanceProfiler } from "@/engines/PerformanceProfiler/PerformanceProfilerEngine";
import { normalizeRichText } from "@/engines/RichText/RichTextUtils";
import { getStoryHierarchyStyle } from "@/engines/StoryHierarchy/StoryHierarchyEngine";
import type {
  ArticleCompositionSettings,
  ArticleLayout,
  ArticleLayoutTextBlock,
  ArticleLayoutTextLine,
  ArticleTextStyle,
  EditorPerformanceDiagnostics,
  StoryDirtyFlags,
  StoryFrame,
} from "@/types/editor";
import type { RichTextContent, RichTextDocument, RichTextSpan } from "@/types/RichText";

export type IncrementalStoryLayout = {
  story: StoryFrame;
  hierarchyStyle: ReturnType<typeof getStoryHierarchyStyle>;
  layout: ArticleLayout;
  cacheHit: boolean;
};

export type IncrementalCompositionResult = {
  storyLayouts: IncrementalStoryLayout[];
  diagnostics: EditorPerformanceDiagnostics;
};

type CachedStoryLayout = {
  key: string;
  paintKey: string;
  hierarchyStyle: ReturnType<typeof getStoryHierarchyStyle>;
  baseLayout: ArticleLayout;
  layout: ArticleLayout;
};

export type StoryCompositionCache = Map<string, CachedStoryLayout>;

type StoryCompositionKeyCacheEntry = {
  productionView: boolean;
  priority: StoryFrame["priority"];
  storyDecorationIndex?: number;
  storyDecorationCount?: number;
  key: string;
};

const storyCompositionKeyCache = new WeakMap<StoryFrame, StoryCompositionKeyCacheEntry>();
const storyPaintKeyCache = new WeakMap<StoryFrame, string>();

const performanceNow = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

export const createCleanDirtyFlags = (): StoryDirtyFlags => ({
  geometryDirty: false,
  textDirty: false,
  imageDirty: false,
  styleDirty: false,
  typographyDirty: false,
  compositionDirty: false,
  renderDirty: false,
});

export const mergeDirtyFlags = (
  current: StoryDirtyFlags | undefined,
  next: Partial<StoryDirtyFlags>,
): StoryDirtyFlags => ({
  ...createCleanDirtyFlags(),
  ...current,
  ...next,
});

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
};

const PAINT_ONLY_RICH_TEXT_KEYS = new Set(["color", "backgroundColor", "opacity", "underline"]);
const PAINT_ONLY_CONTAINER_KEYS = new Set([
  "containerBackgroundColor",
  "containerBorderColor",
  "containerOpacity",
  "frameBackgroundColor",
  "frameBorderColor",
  "frameOpacity",
  "framePaddingTop",
  "framePaddingBottom",
  "framePaddingLeft",
  "framePaddingRight",
  "frameBorderWidth",
  "frameBorderStyle",
  "frameRadius",
  "containerPaddingTop",
  "containerPaddingBottom",
  "containerPaddingLeft",
  "containerPaddingRight",
  "containerBorderWidth",
  "containerBorderRadius",
  "contentHorizontalAlignment",
  "contentVerticalAlignment",
  "minimumFrameHeight",
  "minimumFrameWidth",
  "autoFrameHeight",
]);

const isRichTextLike = (value: unknown): value is RichTextDocument =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as { spans?: unknown }).spans);

const stripRichTextPaint = (value: unknown): unknown => {
  if (typeof value === "string") {
    return {
      spans: [{ text: value }],
    };
  }

  if (isRichTextLike(value)) {
    return {
      spans: normalizeRichText(value).spans.map((span) =>
        Object.fromEntries(
          Object.entries(span).filter(([key]) => !PAINT_ONLY_RICH_TEXT_KEYS.has(key)),
        ),
      ),
    };
  }

  if (Array.isArray(value)) {
    return value.map(stripRichTextPaint);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        PAINT_ONLY_CONTAINER_KEYS.has(key) ? undefined : stripRichTextPaint(child),
      ]),
    );
  }

  return value;
};

const collectRichTextPaint = (value: unknown): unknown => {
  if (typeof value === "string") {
    return {
      spans: [{ text: value }],
    };
  }

  if (isRichTextLike(value)) {
    return {
      spans: normalizeRichText(value).spans.map((span) => ({
        text: span.text,
        color: span.color,
        backgroundColor: span.backgroundColor,
        opacity: span.opacity,
        underline: span.underline,
      })),
    };
  }

  if (Array.isArray(value)) {
    return value.map(collectRichTextPaint);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        PAINT_ONLY_CONTAINER_KEYS.has(key) ? child : collectRichTextPaint(child),
      ]),
    );
  }

  return undefined;
};

const getStoryPaintKey = (story: StoryFrame) => {
  const cached = storyPaintKeyCache.get(story);

  if (cached) {
    return cached;
  }

  const key = stableStringify(collectRichTextPaint(story.articleData));
  storyPaintKeyCache.set(story, key);

  return key;
};

const cloneLayout = (layout: ArticleLayout): ArticleLayout =>
  typeof structuredClone === "function"
    ? structuredClone(layout)
    : JSON.parse(JSON.stringify(layout));

const getPaintStyleForOffset = (
  spans: RichTextSpan[],
  offset: number,
  fallback: ArticleTextStyle,
): Pick<ArticleTextStyle, "fill" | "backgroundColor" | "opacity" | "textDecoration"> => {
  let cursor = 0;

  for (const span of spans) {
    const nextCursor = cursor + span.text.length;

    if (offset >= cursor && offset < nextCursor) {
      return {
        fill: span.color ?? fallback.fill,
        backgroundColor: span.backgroundColor ?? fallback.backgroundColor,
        opacity: typeof span.opacity === "number" ? span.opacity : fallback.opacity,
        textDecoration: span.underline ? "underline" : fallback.textDecoration,
      };
    }

    cursor = nextCursor;
  }

  return {
    fill: fallback.fill,
    backgroundColor: fallback.backgroundColor,
    opacity: fallback.opacity,
    textDecoration: fallback.textDecoration,
  };
};

const applyPaintToLine = (
  line: ArticleLayoutTextLine,
  spans: RichTextSpan[],
  cursor: number,
): { line: ArticleLayoutTextLine; cursor: number } => {
  const linePaint = getPaintStyleForOffset(spans, cursor, line.style);
  let segmentCursor = cursor;

  return {
    line: {
      ...line,
      style: {
        ...line.style,
        ...linePaint,
      },
      segments: line.segments?.map((segment) => {
        const segmentPaint = getPaintStyleForOffset(spans, segmentCursor, segment.style);
        segmentCursor += segment.text.length;

        return {
          ...segment,
          style: {
            ...segment.style,
            ...segmentPaint,
          },
        };
      }),
    },
    cursor: cursor + line.text.length,
  };
};

const applyRichTextPaintToBlock = (
  block: ArticleLayoutTextBlock | null | undefined,
  content: RichTextContent,
) => {
  if (!block) {
    return;
  }

  const document = normalizeRichText(content);
  let cursor = 0;
  block.lineBoxes = block.lineBoxes.map((line) => {
    const next = applyPaintToLine(line, document.spans, cursor);
    cursor = next.cursor;

    return next.line;
  });

  const blockPaint = getPaintStyleForOffset(document.spans, 0, block.style);
  block.style = {
    ...block.style,
    ...blockPaint,
  };
};

const applyPaintStylesToLayout = (layout: ArticleLayout, story: StoryFrame): ArticleLayout => {
  const paintedLayout = cloneLayout(layout);
  const { articleData } = story;

  applyRichTextPaintToBlock(paintedLayout.headline, articleData.headline);
  applyRichTextPaintToBlock(paintedLayout.subheadline, articleData.subheadline);
  const bodySpans = normalizeRichText(articleData.body).spans;
  let bodyCursor = 0;
  paintedLayout.body.columns = paintedLayout.body.columns.map((column) => {
    return {
      ...column,
      lines: column.lines.map((line) => {
        const next = applyPaintToLine(line, bodySpans, bodyCursor);
        bodyCursor = next.cursor;

        return next.line;
      }),
    };
  });
  applyRichTextPaintToBlock(paintedLayout.caption?.textBlock, articleData.caption.text);
  applyRichTextPaintToBlock(paintedLayout.caption?.creditBlock, articleData.caption.creditText);
  applyRichTextPaintToBlock(paintedLayout.factBox?.headline, articleData.factBox.headline);
  paintedLayout.factBox?.bullets.forEach((bullet, index) =>
    applyRichTextPaintToBlock(bullet, articleData.factBox.bullets[index] ?? ""),
  );
  applyRichTextPaintToBlock(paintedLayout.pullQuote?.textBlock, articleData.pullQuote.text);
  const containerStyles = normalizeContainerStyles(articleData.containerStyles);
  const applyFrameStylePaint = (
    block: typeof paintedLayout.headline | null | undefined,
    style: (typeof containerStyles)[keyof typeof containerStyles],
  ) => {
    if (!block?.containerStyle) {
      return;
    }

    block.containerStyle = {
      ...block.containerStyle,
      ...style,
    };
  };

  if (paintedLayout.headline.containerStyle) {
    applyFrameStylePaint(paintedLayout.headline, containerStyles.headline);
  }
  if (paintedLayout.subheadline.containerStyle) {
    applyFrameStylePaint(paintedLayout.subheadline, containerStyles.subheadline);
  }
  if (paintedLayout.caption?.textBlock.containerStyle) {
    applyFrameStylePaint(paintedLayout.caption.textBlock, {
      ...containerStyles.caption,
      containerBackgroundColor:
        articleData.caption.captionStyle.backgroundColor === "transparent"
          ? containerStyles.caption.containerBackgroundColor
          : articleData.caption.captionStyle.backgroundColor,
      frameBackgroundColor:
        articleData.caption.captionStyle.backgroundColor === "transparent"
          ? containerStyles.caption.frameBackgroundColor
          : articleData.caption.captionStyle.backgroundColor,
    });
  }
  applyFrameStylePaint(paintedLayout.caption?.creditBlock, containerStyles.credit);
  applyFrameStylePaint(paintedLayout.caption?.sourceBlock, containerStyles.source);
  applyFrameStylePaint(paintedLayout.factBox?.headline, containerStyles.factBoxHeading);
  paintedLayout.factBox?.bullets.forEach((bullet) =>
    applyFrameStylePaint(bullet, containerStyles.factBoxContent),
  );
  applyFrameStylePaint(paintedLayout.pullQuote?.textBlock, containerStyles.pullQuote);

  return paintedLayout;
};

const createCompositionSettings = (
  story: StoryFrame,
  productionView: boolean,
  hierarchyStyle: ReturnType<typeof getStoryHierarchyStyle>,
  storyDecorationIndex?: number,
  storyDecorationCount?: number,
): ArticleCompositionSettings => {
  const { bodyRendererMode: _bodyRendererMode, ...compositionSettings } = story.compositionSettings;

  return {
    ...compositionSettings,
    showRegionDebug: productionView ? false : story.compositionSettings.showRegionDebug,
    productionView,
    storyHierarchyStyle: hierarchyStyle,
    storyDecorationIndex,
    storyDecorationCount,
  };
};

export const getStoryCompositionKey = (
  story: StoryFrame,
  productionView: boolean,
  hierarchyStyle = getStoryHierarchyStyle(story.priority),
  storyDecorationIndex?: number,
  storyDecorationCount?: number,
) => {
  const cached = storyCompositionKeyCache.get(story);

  if (
    cached &&
    cached.productionView === productionView &&
    cached.priority === story.priority &&
    cached.storyDecorationIndex === storyDecorationIndex &&
    cached.storyDecorationCount === storyDecorationCount
  ) {
    return cached.key;
  }

  const key = stableStringify({
    geometry: {
      width: story.width,
      height: story.height,
      columnStart: story.columnStart,
      columnSpan: story.columnSpan,
      priority: story.priority,
    },
    // Affects composeArticleBox.ts's body font choice (English content gets
    // ENGLISH_NEWSPAPER_BODY_FONT_FAMILY instead of the default sans) --
    // without this in the key, a story cached before contentLanguage was
    // attached (or before it changed) reads as an unchanged cache hit
    // afterward, since nothing else here reflects it, and keeps rendering
    // with the stale font.
    contentLanguage: story.contentLanguage,
    image: {
      imageEnabled: story.imageEnabled,
      imageAlignment: story.imageAlignment,
      imageColumnSpan: story.imageColumnSpan,
      imageHeight: story.imageHeight,
      imageHeightMode: story.imageHeightMode,
      imageHeightPreset: story.imageHeightPreset,
      imageHeightProtection: story.imageHeightProtection,
      autoSizeImage: story.autoSizeImage,
      imageWrapMode: story.imageWrapMode,
      imageShapeType: story.imageShapeType,
      imageShapePoints: story.imageShapePoints,
      imageCrop: story.imageCrop,
      wrapContourPoints: story.wrapContourPoints,
      wrapTextOffset: story.wrapTextOffset,
    },
    typography: {
      headlineFontSize: story.headlineFontSize,
      subheadlineFontSize: story.subheadlineFontSize,
      bodyFontSize: story.bodyFontSize,
      headlineLineHeight: story.headlineLineHeight,
      subheadlineLineHeight: story.subheadlineLineHeight,
      bodyLineHeight: story.bodyLineHeight,
      headlineLineHeightMode: story.headlineLineHeightMode,
      subheadlineLineHeightMode: story.subheadlineLineHeightMode,
      bodyLineHeightMode: story.bodyLineHeightMode,
      headlineLeadingValue: story.headlineLeadingValue,
      subheadlineLeadingValue: story.subheadlineLeadingValue,
      bodyLeadingValue: story.bodyLeadingValue,
      headlineWeight: story.headlineWeight,
      subheadlineWeight: story.subheadlineWeight,
      autoFitHeadline: story.autoFitHeadline,
      autoBalanceHeadline: story.autoBalanceHeadline,
      enableHyphenation: story.enableHyphenation,
      forceFullWidthHeadlines: story.forceFullWidthHeadlines,
      headlineLayoutMode: story.headlineLayoutMode,
    },
    articleData: stripRichTextPaint(story.articleData),
    compositionSettings: createCompositionSettings(
      story,
      productionView,
      hierarchyStyle,
      storyDecorationIndex,
      storyDecorationCount,
    ),
  });

  storyCompositionKeyCache.set(story, {
    productionView,
    priority: story.priority,
    storyDecorationIndex,
    storyDecorationCount,
    key,
  });

  return key;
};

export const composeStoriesIncrementally = ({
  stories,
  productionView,
  cache,
  previousRenderTimeMs = 0,
  fps = 0,
  profiler,
}: {
  stories: StoryFrame[];
  productionView: boolean;
  cache: StoryCompositionCache;
  previousRenderTimeMs?: number;
  fps?: number;
  profiler?: PerformanceProfiler;
}): IncrementalCompositionResult => {
  const startedAt = performanceNow();
  let cacheHits = 0;
  let cacheMisses = 0;

  const activeIds = new Set(stories.map((story) => story.id));

  for (const cachedId of cache.keys()) {
    if (!activeIds.has(cachedId)) {
      cache.delete(cachedId);
    }
  }

  const storyLayouts = stories.map((story, storyIndex) => {
    const hierarchyStyle = getStoryHierarchyStyle(story.priority);
    const key = getStoryCompositionKey(story, productionView, hierarchyStyle, storyIndex, stories.length);
    const cached = profiler
      ? profiler.timeOperation("cache-lookup", () => cache.get(story.id), { storyId: story.id })
      : cache.get(story.id);

    if (cached?.key === key) {
      cacheHits += 1;
      const paintKey = getStoryPaintKey(story);
      const layout =
        cached.paintKey === paintKey
          ? cached.layout
          : applyPaintStylesToLayout(cached.baseLayout, story);

      if (cached.paintKey !== paintKey) {
        cache.set(story.id, {
          ...cached,
          paintKey,
          layout,
        });
      }

      return {
        story,
        hierarchyStyle: cached.hierarchyStyle,
        layout,
        cacheHit: true,
      };
    }

    cacheMisses += 1;

    const layout = profiler
      ? profiler.timeOperation(
          "story-compose",
          () =>
            composeArticleBox(
              story,
              story.articleData,
              createCompositionSettings(story, productionView, hierarchyStyle, storyIndex, stories.length),
            ),
          { storyId: story.id },
        )
      : composeArticleBox(
          story,
          story.articleData,
          createCompositionSettings(story, productionView, hierarchyStyle, storyIndex, stories.length),
        );
    cache.set(story.id, {
      key,
      paintKey: getStoryPaintKey(story),
      hierarchyStyle,
      baseLayout: layout,
      layout,
    });

    return {
      story,
      hierarchyStyle,
      layout,
      cacheHit: false,
    };
  });

  const totalLookups = Math.max(1, cacheHits + cacheMisses);
  const compositionTimeMs = Math.round((performanceNow() - startedAt) * 100) / 100;
  profiler?.recordOperation("composition", compositionTimeMs, {
    stories: stories.length,
    recomposed: cacheMisses,
  });
  profiler?.updateCacheAudit({
    cacheSize: cache.size,
    hitPercent: Math.round((cacheHits / totalLookups) * 1000) / 10,
    missPercent: Math.round((cacheMisses / totalLookups) * 1000) / 10,
    largestCache: "story-composition",
  });
  const snapshot = profiler?.getSnapshot();
  const getLatestDuration = (name: string) =>
    snapshot?.samples
      .filter((sample) => sample.name === name)
      .slice(-8)
      .reduce((sum, sample) => sum + sample.durationMs, 0) ?? 0;
  const storyComposeSamples = snapshot?.samples.filter((sample) => sample.name === "story-compose") ?? [];
  const recentStoryComposeSamples = storyComposeSamples.slice(-Math.max(1, cacheMisses || 1));
  const averageStoryComposeMs =
    recentStoryComposeSamples.length > 0
      ? Math.round(
          (recentStoryComposeSamples.reduce((sum, sample) => sum + sample.durationMs, 0) /
            recentStoryComposeSamples.length) *
            100,
        ) / 100
      : 0;
  const slowestStoryMs =
    recentStoryComposeSamples.length > 0
      ? Math.max(...recentStoryComposeSamples.map((sample) => sample.durationMs))
      : 0;

  return {
    storyLayouts,
    diagnostics: {
      compositionTimeMs,
      renderTimeMs: previousRenderTimeMs,
      fps,
      dirtyStories: cacheMisses,
      cacheHitPercent: Math.round((cacheHits / totalLookups) * 1000) / 10,
      cacheMissPercent: Math.round((cacheMisses / totalLookups) * 1000) / 10,
      storiesRecomposed: cacheMisses,
      storiesRepainted: cacheMisses,
      storyComposeTimeMs: getLatestDuration("story-compose"),
      paragraphComposeTimeMs: getLatestDuration("paragraph-compose"),
      headlineComposeTimeMs: getLatestDuration("headline-compose"),
      imagePlacementTimeMs: getLatestDuration("image-placement"),
      richTextTimeMs: getLatestDuration("rich-text"),
      opticalTypographyTimeMs: getLatestDuration("optical-typography"),
      konvaDrawTimeMs: getLatestDuration("konva-draw"),
      storeUpdateTimeMs: getLatestDuration("store-update"),
      inspectorUpdateTimeMs: getLatestDuration("inspector-update"),
      cacheLookupTimeMs: getLatestDuration("cache-lookup"),
      dirtyRegionCount: cacheMisses,
      averageFrameTimeMs: snapshot?.averageFrameTimeMs ?? 0,
      worstFrameTimeMs: snapshot?.worstFrameTimeMs ?? 0,
      averageFps: snapshot?.averageFps ?? fps,
      minimumFps: snapshot?.minimumFps ?? fps,
      maximumFps: snapshot?.maximumFps ?? fps,
      memoryUsageMb: 0,
      konvaNodes: 0,
      visibleStories: stories.length,
      averageStoryComposeMs,
      slowestStoryMs,
      storiesCached: cacheHits,
      cacheSize: cache.size,
      cacheEvictions: 0,
      largestCache: "story-composition",
      mostRecomposedStoryId: snapshot?.cacheAudit.mostRecomposedStoryId ?? "-",
      hotPathOperations: snapshot?.hotPathOperations ?? [],
      slowReactComponents: snapshot?.slowReactComponents ?? [],
      slowStories: snapshot?.slowStories ?? [],
      renderStageBreakdown: snapshot?.renderStageBreakdown ?? [],
      editorCanvasRenderTimeMs: 0,
      canvasLayerRenderTimeMs: 0,
      storyRenderTimeMs: 0,
      articleBoxRenderTimeMs: 0,
      headlineRenderTimeMs: 0,
      subheadlineRenderTimeMs: 0,
      bodyRenderTimeMs: 0,
      imageRenderTimeMs: 0,
      captionRenderTimeMs: 0,
      factBoxRenderTimeMs: 0,
      pullQuoteRenderTimeMs: 0,
      selectionRenderTimeMs: 0,
      guidesRenderTimeMs: 0,
      gridRenderTimeMs: 0,
      reactRenderTimeMs: getLatestDuration("react-render"),
      reactCommitTimeMs: getLatestDuration("react-commit"),
      konvaBatchDrawTimeMs: getLatestDuration("konva-batch-draw"),
      stageCount: 0,
      layerCount: 0,
      fastLayerCount: 0,
      groupCount: 0,
      textNodeCount: 0,
      rectCount: 0,
      imageNodeCount: 0,
      lineCount: 0,
      guideCount: 0,
      transformerCount: 0,
      selectionNodeCount: 0,
      totalNodes: 0,
      visibleNodes: 0,
      hiddenNodes: 0,
      destroyedNodes: 0,
      createdNodes: 0,
      renderCacheHitPercent: Math.round((cacheHits / totalLookups) * 1000) / 10,
      renderCacheMissPercent: Math.round((cacheMisses / totalLookups) * 1000) / 10,
      timeline: snapshot?.timeline ?? [],
    },
  };
};
