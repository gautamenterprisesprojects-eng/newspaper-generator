/**
 * DynamicImageBalancer
 *
 * Post-layout, per-article image-height optimiser.
 *
 * After the initial article composition is complete, this balancer evaluates
 * the remaining bottom whitespace and determines whether the image can be
 * safely enlarged to consume unused vertical space.
 *
 * Design rules:
 * - Never invoked from inside composeArticleBoxPass (no recursion).
 * - Works on a single article; never regenerates the whole page.
 * - The baseline layout is treated as immutable.
 * - All candidates are validated strictly; any failure rolls back to baseline.
 * - Deterministic: identical inputs always produce identical output.
 */

import type {
  ArticleBoxModel,
  ArticleCompositionSettings,
  ArticleData,
  ArticleLayout,
  StoryImageHeightPreset,
  StoryImageSettings,
  StoryPriority,
  StoryTypographySettings,
} from "@/types/editor";

// ── Configuration ──────────────────────────────────────────────────────────────

export type DynamicImageBalancingConfig = {
  enabled: boolean;
  /** Maximum relative increase from the baseline image height (e.g. 0.15 = 15%) as an initial preferred step. */
  maxHeightIncreaseRatio: number;
  /** Maximum proportional upscale from source resolution (e.g. 1.15 = 115%). */
  maxUpscaleRatio: number;
  /** Minimum number of body-text lines of whitespace before balancing triggers. */
  minimumWhitespaceLines: number;
  /** Hard cap on candidate-height iterations. */
  maximumIterations: number;
};

export const DEFAULT_DYNAMIC_IMAGE_BALANCING_CONFIG: DynamicImageBalancingConfig = {
  enabled: true,
  maxHeightIncreaseRatio: 0.35,
  maxUpscaleRatio: 1.35,
  minimumWhitespaceLines: 1,
  maximumIterations: 8,
};

// ── Diagnostics ────────────────────────────────────────────────────────────────

export type DynamicImageBalancingDiagnostics = {
  attempted: boolean;
  applied: boolean;
  baselineHeight?: number;
  finalHeight?: number;
  baselineWhitespace?: number;
  finalWhitespace?: number;
  iterations?: number;
  rejectionReason?: string;
  sourceWidth?: number;
  sourceHeight?: number;
  imageSpanLeft?: number;
  imageSpanRight?: number;
  imageContentBottom?: number;
  articleInnerBottom?: number;
  nearestOccupiedTopBelowImage?: number;
  maximumGeometryHeight?: number;
  maximumResolutionSafeHeight?: number;
  testedCandidateHeights?: number[];
};

const isImageBalancerDebugEnabled = (settings: ArticleCompositionSettings & { debugImageBalancer?: boolean }): boolean => {
  return (
    process.env.NODE_ENV !== "production" &&
    (settings.debugImageBalancer === true || process.env.NEXT_PUBLIC_DEBUG_IMAGE_BALANCER === "true")
  );
};

// ── Types ──────────────────────────────────────────────────────────────────────

type ArticleFitOverrides = {
  bodyFontSize?: number;
  bodyLineHeight?: number;
  captionSpacingAdjustment?: number;
  imageHeight?: number;
  imageHeightPreset?: StoryImageHeightPreset;
  imageHeightMode?: "auto" | "fixed";
  pullQuoteHeightAdjustment?: number;
  factBoxHeightAdjustment?: number;
};

export type BalanceArticleImageInput = {
  /** The composition result from the initial (stable) pass. */
  baselineLayout: ArticleLayout;
  /** The article box model. */
  articleBox: ArticleBoxModel &
    Partial<StoryImageSettings> &
    Partial<StoryTypographySettings> & { priority?: StoryPriority, id?: string };
  /** Article editorial data. */
  articleData: ArticleData;
  /** Current composition settings. */
  compositionSettings: ArticleCompositionSettings & { debugImageBalancer?: boolean };
  /**
   * Callback that recomposes a single article pass.
   * Must NOT recursively invoke the balancer.
   */
  composePass: (
    box: ArticleBoxModel &
      Partial<StoryImageSettings> &
      Partial<StoryTypographySettings> & { priority?: StoryPriority },
    data: ArticleData,
    settings: ArticleCompositionSettings,
    fitOverrides?: ArticleFitOverrides,
  ) => ArticleLayout;
  /** Source image pixel width (if available). */
  sourceImageWidth?: number;
  /** Source image pixel height (if available). */
  sourceImageHeight?: number;
};

export type BalanceArticleImageResult = {
  layout: ArticleLayout;
  diagnostics: DynamicImageBalancingDiagnostics;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Get the approximate body line height in layout units.
 */
function getBodyLineHeight(layout: ArticleLayout): number {
  const firstColumn = layout.body.columns[0];
  if (!firstColumn || firstColumn.lines.length < 2) {
    return 14; 
  }
  return Math.max(1, firstColumn.lines[1].y - firstColumn.lines[0].y);
}

function getOccupiedIntervalsInHorizontalSpan(
  layout: ArticleLayout,
  spanLeft: number,
  spanRight: number
): { top: number; bottom: number }[] {
  const intervals: { top: number; bottom: number }[] = [];

  const intersects = (x: number, width: number) => {
    return x < spanRight && (x + width) > spanLeft;
  };

  // Body text - use actual rendered lines!
  for (const column of layout.body.columns) {
    if (intersects(column.x, column.width)) {
      for (const line of column.lines) {
        intervals.push({ top: line.y, bottom: line.y + line.height });
      }
    }
  }

  if (layout.image && intersects(layout.image.x, layout.image.width)) {
    intervals.push({ top: layout.image.y, bottom: layout.image.y + layout.image.height });
  }

  if (layout.caption && intersects(layout.caption.x, layout.caption.width)) {
    intervals.push({ top: layout.caption.y, bottom: layout.caption.y + layout.caption.height });
  }

  if (layout.headline && intersects(layout.headline.x, layout.headline.width)) {
    intervals.push({ top: layout.headline.y, bottom: layout.headline.y + layout.headline.height });
  }

  if (layout.subheadline && intersects(layout.subheadline.x, layout.subheadline.width)) {
    intervals.push({ top: layout.subheadline.y, bottom: layout.subheadline.y + layout.subheadline.height });
  }

  if (layout.byline && intersects(layout.byline.x, layout.byline.width)) {
    intervals.push({ top: layout.byline.y, bottom: layout.byline.y + layout.byline.height });
  }

  if (layout.factBox && intersects(layout.factBox.x, layout.factBox.width)) {
    intervals.push({ top: layout.factBox.y, bottom: layout.factBox.y + layout.factBox.height });
  }

  if (layout.pullQuote && intersects(layout.pullQuote.x, layout.pullQuote.width)) {
    intervals.push({ top: layout.pullQuote.y, bottom: layout.pullQuote.y + layout.pullQuote.height });
  }

  return intervals;
}

function getLocalSpanBottom(layout: ArticleLayout, spanLeft: number, spanRight: number): number {
  const intervals = getOccupiedIntervalsInHorizontalSpan(layout, spanLeft, spanRight);
  return intervals.reduce((max, interval) => Math.max(max, interval.bottom), 0);
}

function isValidCandidate(
  candidate: ArticleLayout,
  articleBox: { width: number; height: number },
  spanLeft: number,
  spanRight: number,
  localAvailableBottom: number,
): boolean {
  // 1. No body overflow
  if (candidate.body.overflow) return false;

  // 2. No headline overflow
  if (candidate.headline.overflow) return false;

  // 3. Check remaining line count is < 1 (sentence-end fit check)
  if (candidate.body.remainingLineCount >= 1) return false;

  // 4. Body must have visible lines
  if (candidate.body.lineCount <= 0) return false;

  // 5. Verify bottom geometry locally
  const candidateBottom = getLocalSpanBottom(candidate, spanLeft, spanRight);
  if (candidateBottom > localAvailableBottom + 1 && candidateBottom > articleBox.height + 1) {
    return false;
  }

  // 6. Global bound check just in case
  if (candidate.image && candidate.image.y + candidate.image.height > articleBox.height + 1) {
    return false;
  }

  return true;
}

// ── Scoring ────────────────────────────────────────────────────────────────────

type CandidateScore = {
  residualWhitespace: number;
  heightIncrease: number;
  totalScore: number;
};

function scoreCandidate(
  candidate: ArticleLayout,
  spanLeft: number,
  spanRight: number,
  localAvailableBottom: number,
  baselineImageHeight: number,
): CandidateScore {
  const candidateVisibleBottom = getLocalSpanBottom(candidate, spanLeft, spanRight);
  const candidateWhitespace = Math.max(0, localAvailableBottom - candidateVisibleBottom);
  const heightIncrease = (candidate.image?.height ?? 0) - baselineImageHeight;

  // Lower score = better
  const residualWhitespacePenalty = candidateWhitespace / Math.max(1, localAvailableBottom);
  const heightIncreasePenalty = Math.abs(heightIncrease) / Math.max(1, localAvailableBottom) * 0.3;

  return {
    residualWhitespace: candidateWhitespace,
    heightIncrease,
    totalScore: residualWhitespacePenalty + heightIncreasePenalty,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function balanceArticleImage(
  input: BalanceArticleImageInput,
): BalanceArticleImageResult {
  const {
    baselineLayout,
    articleBox,
    articleData,
    compositionSettings,
    composePass,
    sourceImageWidth,
    sourceImageHeight,
  } = input;

  const config: DynamicImageBalancingConfig = {
    ...DEFAULT_DYNAMIC_IMAGE_BALANCING_CONFIG,
    ...compositionSettings.dynamicImageBalancing,
  };

  const diagnostics: DynamicImageBalancingDiagnostics = {
    attempted: false,
    applied: false,
  };
  const debug = isImageBalancerDebugEnabled(compositionSettings);

  const logDiagnostics = (message: string, data?: any) => {
    if (debug) {
      console.log(`[DynamicImageBalancer] ${message}`, data || "");
    }
  };

  // ── Eligibility checks ─────────────────────────────────────────────────────

  if (!config.enabled) {
    diagnostics.rejectionReason = "feature-disabled";
    return { layout: baselineLayout, diagnostics };
  }

  if (!baselineLayout.image) {
    diagnostics.rejectionReason = "no-image";
    return { layout: baselineLayout, diagnostics };
  }

  // Respect manual lock
  if (articleBox.imageSizeLocked) {
    diagnostics.rejectionReason = "image-locked";
    return { layout: baselineLayout, diagnostics };
  }

  // Already overflowing
  if (baselineLayout.body.overflow || baselineLayout.headline.overflow) {
    diagnostics.rejectionReason = "body-overflow";
    return { layout: baselineLayout, diagnostics };
  }
  
  // ── Source resolution check ────────────────────────────────────────────────
  if (!sourceImageWidth || !sourceImageHeight) {
    diagnostics.rejectionReason = "source-dimensions-unavailable";
    logDiagnostics("Rejected: source-dimensions-unavailable");
    return { layout: baselineLayout, diagnostics };
  }

  const baselineImageHeight = baselineLayout.image.height;
  const articleBoxHeight = articleBox.height;

  // Find local bounds
  const imageSpanLeft = baselineLayout.image.x;
  const imageSpanRight = baselineLayout.image.x + baselineLayout.image.width;
  
  const imageContentBottom = baselineLayout.caption
    ? baselineLayout.caption.y + baselineLayout.caption.height
    : baselineLayout.image.y + baselineLayout.image.height;

  const intervals = getOccupiedIntervalsInHorizontalSpan(baselineLayout, imageSpanLeft, imageSpanRight);
  
  let nearestOccupiedTopBelowImage = Infinity;
  for (const interval of intervals) {
    // Only care about elements that begin roughly below the image content
    if (interval.top >= imageContentBottom - 1) {
      nearestOccupiedTopBelowImage = Math.min(nearestOccupiedTopBelowImage, interval.top);
    }
  }

  const requiredSeparationGap = 12; 
  const requiredBottomPadding = 0; 

  const articleInnerBottom = articleBoxHeight;
  
  let localAvailableBottom: number;
  if (nearestOccupiedTopBelowImage !== Infinity) {
    localAvailableBottom = nearestOccupiedTopBelowImage - requiredSeparationGap;
  } else {
    localAvailableBottom = articleInnerBottom - requiredBottomPadding;
  }

  // Measure actual removable bottom whitespace LOCALLY
  const removableWhitespace = Math.max(0, localAvailableBottom - imageContentBottom);
  const bodyLineHeight = getBodyLineHeight(baselineLayout);
  const minimumThreshold = bodyLineHeight * config.minimumWhitespaceLines;

  diagnostics.sourceWidth = sourceImageWidth;
  diagnostics.sourceHeight = sourceImageHeight;
  diagnostics.imageSpanLeft = imageSpanLeft;
  diagnostics.imageSpanRight = imageSpanRight;
  diagnostics.imageContentBottom = imageContentBottom;
  diagnostics.articleInnerBottom = articleInnerBottom;
  diagnostics.nearestOccupiedTopBelowImage = nearestOccupiedTopBelowImage === Infinity ? undefined : nearestOccupiedTopBelowImage;
  diagnostics.baselineWhitespace = removableWhitespace;

  logDiagnostics(`Article ID: ${articleBox.id || 'unknown'}`);
  logDiagnostics(`Local Whitespace: ${removableWhitespace}px`);

  if (removableWhitespace < minimumThreshold) {
    diagnostics.rejectionReason = "insufficient-whitespace";
    logDiagnostics("Rejected: insufficient-whitespace");
    return { layout: baselineLayout, diagnostics };
  }

  const currentFrameWidth = baselineLayout.image.width;
  const sourceAspectRatio = sourceImageWidth / sourceImageHeight;
  const proportionalSourceHeight = currentFrameWidth / sourceAspectRatio;
  const maxSourceSafeHeight = proportionalSourceHeight * config.maxUpscaleRatio;

  diagnostics.attempted = true;
  diagnostics.baselineHeight = baselineImageHeight;

  const maximumGeometryHeight = baselineImageHeight + removableWhitespace;
  const maxConfiguredHeight = baselineImageHeight * (1 + Math.max(0, config.maxHeightIncreaseRatio));
  const maximumSafeImageHeight = Math.min(
    maximumGeometryHeight,
    maxSourceSafeHeight,
    maxConfiguredHeight,
  );

  diagnostics.maximumGeometryHeight = maximumGeometryHeight;
  diagnostics.maximumResolutionSafeHeight = maxSourceSafeHeight;

  if (maximumSafeImageHeight <= baselineImageHeight + 1) {
    diagnostics.rejectionReason = "resolution-too-low";
    logDiagnostics("Rejected: resolution-too-low", { maxSourceSafeHeight });
    return { layout: baselineLayout, diagnostics };
  }

  // ── Bounded candidate stepping ─────────────────────────────────────────────

  const heightRange = maximumSafeImageHeight - baselineImageHeight;
  const candidateFractions = [0.2, 0.35, 0.5, 0.65, 0.8, 0.9, 1.0].slice(
    0,
    Math.max(1, config.maximumIterations),
  );
  
  let bestCandidate: ArticleLayout | null = null;
  let bestScore: CandidateScore | null = null;
  let iterationCount = 0;
  diagnostics.testedCandidateHeights = [];

  for (const fraction of candidateFractions) {
    iterationCount++;
    const candidateHeight = Math.round(baselineImageHeight + heightRange * fraction);

    if (candidateHeight <= baselineImageHeight) continue;

    diagnostics.testedCandidateHeights.push(candidateHeight);

    // Recompose with overridden image height
    // The compose pass must NOT invoke the balancer (skipDynamicImageBalancing)
    const candidateLayout = composePass(
      articleBox,
      articleData,
      {
        ...compositionSettings,
        _skipDynamicImageBalancing: true,
      } as ArticleCompositionSettings,
      { 
        imageHeight: candidateHeight,
        imageHeightMode: "fixed", 
        imageHeightPreset: "custom",
      },
    );

    // Validate
    if (!isValidCandidate(candidateLayout, articleBox, imageSpanLeft, imageSpanRight, localAvailableBottom)) {
      logDiagnostics(`Candidate ${candidateHeight} rejected: invalid bounds or text fit.`);
      continue;
    }

    // Score
    const score = scoreCandidate(
      candidateLayout,
      imageSpanLeft,
      imageSpanRight,
      localAvailableBottom,
      baselineImageHeight,
    );

    // Must actually reduce whitespace
    if (score.residualWhitespace >= removableWhitespace) {
      logDiagnostics(`Candidate ${candidateHeight} rejected: did not reduce whitespace (${score.residualWhitespace} >= ${removableWhitespace}).`);
      continue;
    }

    logDiagnostics(`Candidate ${candidateHeight} scored ${score.totalScore.toFixed(3)} (residual: ${score.residualWhitespace}px)`);

    if (!bestScore || score.totalScore < bestScore.totalScore) {
      bestCandidate = candidateLayout;
      bestScore = score;
    }
  }

  diagnostics.iterations = iterationCount;

  // ── Accept or reject ───────────────────────────────────────────────────────

  if (bestCandidate && bestScore && bestScore.residualWhitespace < removableWhitespace) {
    diagnostics.applied = true;
    diagnostics.finalHeight = bestCandidate.image?.height ?? baselineImageHeight;
    diagnostics.finalWhitespace = bestScore.residualWhitespace;
    logDiagnostics(`Applied candidate height ${diagnostics.finalHeight}`);
    return { layout: bestCandidate, diagnostics };
  }

  diagnostics.rejectionReason = "no-improvement";
  logDiagnostics("Rejected: no-improvement");
  return { layout: baselineLayout, diagnostics };
}
