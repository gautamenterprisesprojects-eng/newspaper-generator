import {
  createBaselineGrid,
  createBaselineTextMetrics,
  getBaselineLineAdvance,
  getPageAlignedPhase,
  snapMeasurementToBaseline,
  snapRegionToBaseline,
  snapToBaseline,
} from "@/engines/BaselineGridEngine/BaselineGridEngine";
import { BYLINE_SEPARATOR, formatByline } from "@/engines/BylineEngine/BylineEngine";
import { SentenceEndFittingEngine } from "@/engines/TypographyEngine/SentenceEndFittingEngine";
import { applyContainerStyleToTextBlock, defaultContainerStyles, normalizeContainerStyles } from "@/engines/ContainerBackground/ContainerBackgroundEngine";
import { composeDropCap } from "@/engines/DropCapEngine/DropCapEngine";
import { measureWordBasedBodyParagraph } from "@/engines/DevanagariLineBreak/DevanagariLineBreakEngine";
import { calculateEditorialDensity } from "@/engines/EditorialDensity/EditorialDensityEngine";
import {
  createEditorialFitMetrics,
  getEditorialFitStatus,
  optimizeEditorialFit,
  type EditorialFitCandidateSettings,
  type EditorialFitResult,
} from "@/engines/EditorialFitEngine/EditorialFitEngine";
import { createEditorialStyles, ENGLISH_NEWSPAPER_BODY_FONT_FAMILY } from "@/engines/EditorialStyle/EditorialStyleEngine";
import { createEditorialSpacing } from "@/engines/EditorialSpacing/EditorialSpacingEngine";
import { getDefaultStoryTypographySettings } from "@/engines/StoryHierarchy/StoryHierarchyEngine";
import {
  getBodyWhitespaceRatio,
  optimizeImageForEditorialQuality,
} from "@/engines/EditorialLayoutQuality/EditorialLayoutQualityEngine";
import { composeFactBox } from "@/engines/FactBoxEngine/FactBoxEngine";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import { getHyphenationJustificationSettings } from "@/engines/HyphenationJustification/HyphenationJustificationTypes";
import { placeImage } from "@/engines/ImagePlacement/ImagePlacementEngine";
import { computeImageCoverCrop } from "@/engines/ImagePlacement/computeImageCoverCrop";
import { balanceArticleImage } from "@/engines/ImagePlacement/DynamicImageBalancer";
import {
  justifyNewspaperLine,
} from "@/engines/NewspaperJustification/NewspaperJustificationEngine";
import { applyOpticalTypography } from "@/engines/OpticalTypography/OpticalTypographyEngine";
import { createParagraphLayoutBounds, splitBodyParagraphs } from "@/engines/ParagraphTypography/ParagraphTypographyEngine";
import { composePullQuote } from "@/engines/PullQuoteEngine/PullQuoteEngine";

import { createStyledHeadlineRichText, type EditorialHeadlineColor } from "@/engines/EditorialDesignEngine/EditorialHeadlineStylingEngine";
import { composeStoryBody } from "@/engines/StoryComposer/StoryComposerEngine";
import { generateTextRegions } from "@/engines/RegionEngine/RegionEngine";
// Editorial-page-only. Read solely inside `settings.editorialPageStyle` branches,
// so no front-page or inside-page composition can reach it.
import { EDITORIAL_COLUMN_GAP } from "@/engines/MasterPage/EditorialPageStyle";
import { AUTHOR_RAIL_GUTTER, getAuthorBlock } from "@/engines/MasterPage/AuthorBlockGeometry";
import {
  createRichLinesFromWrappedLines,
  measureRichTextParagraph,
  type RichTextTypographyLine,
} from "@/engines/RichText/RichTextTypographyEngine";
import { hasRichTextStyling, normalizeRichText, normalizeRunBoundaries, richTextToPlainText } from "@/engines/RichText/RichTextUtils";
import {
  flowLinesThroughRegions,
  partitionRegionsByUsability,
} from "@/engines/RegionFlowEngine/RegionFlowEngine";
import type { RegionUsabilityRules } from "@/engines/RegionFlowEngine/RegionFlowTypes";
import { balanceHeadline, createHeadlineFitResult, fitHeadline, measureParagraph } from "@/engines/TypographyEngine/TypographyEngine";
import { bodyTypographySafety, resolveTypographyAdjustments } from "@/engines/TypographyEngine/TypographyLimits";
import {
  calculateHeadlineImportanceScore,
  determineHeadlineHierarchyLevel,
  interpolateHeadlineFontSize,
  HEADLINE_HIERARCHY_LEVELS,
} from "@/engines/TypographyEngine/HeadlineHierarchyEngine";
import { createCanvasFontString, measureTextInkMetrics, measureTextWidth } from "@/engines/TypographyEngine/TextMeasure";
import type { TypographyResult } from "@/engines/TypographyEngine/TypographyTypes";
import { normalizeUniversalTypographyControls } from "@/engines/UniversalTypography/UniversalTypographyEngine";
import { justifyColumnsVertically } from "@/engines/VerticalJustificationEngine/VerticalJustificationEngine";
import {
  ensureTextEndsWithFullStop,
  findCutoffIndexInFullText,
  findNearbyPreviousClauseBoundary,
  findNextSentenceBoundary,
  findPreviousSentenceBoundary,
  isAlreadyAtSentenceEnd,
} from "@/engines/TypographyEngine/SentenceBoundaryEngine";

import type {
  ArticleBoxModel,
  ArticleCompositionSettings,
  ArticleData,
  ArticleDecorativeDivider,
  ArticleLayout,
  ArticleLayoutBodyColumn,
  ArticleLayoutRegion,
  BylineLayout,
  CaptionLayout,
  EditorialLabelLayout,
  ArticleLayoutTextBlock,
  ArticleLayoutTextLine,
  ArticleTextStyle,
  EditorialJustifyEngineMode,
  EditorialJustifyMode,
  StoryPriority,
  StoryImageSettings,
  StoryTypographySettings,
} from "@/types/editor";
import type { RichTextContent } from "@/types/RichText";
import { DEFAULT_PAGE_MASTER } from "@/types/page";

// The page's total content width, used to size the kicker (secondary
// heading) word budget against how much of the page an article actually
// spans — derived from the story's real rendered width rather than a
// column-count value that may be stale by the time this box is composed.
const PAGE_CONTENT_WIDTH_PT = DEFAULT_PAGE_MASTER.contentWidth * 72;
// True single newspaper column width, computed the same way the real page
// grid (ColumnGridEngine) does — content width minus every gutter between
// columns, divided by the column count — not the "130pt" rough approximation
// storyColumnSpan uses elsewhere in this file for kicker/badge eligibility.
// That looser constant is ~11% narrower than an actual column (130 vs this
// value, ~145pt on the standard 6-column page), which was letting genuinely
// sub-column-width images (~130-140pt) through the caption eligibility gate
// below even though they read as visibly too small for one on a real page.
const PAGE_COLUMN_WIDTH_PT =
  (PAGE_CONTENT_WIDTH_PT - (DEFAULT_PAGE_MASTER.columns - 1) * DEFAULT_PAGE_MASTER.gutter * 72) /
  DEFAULT_PAGE_MASTER.columns;
// Inside-image caption panel tints — pastel newspaper "info strip" tones
// (warm cream, cool blue, sage, lavender, blush, sand), kept deliberately
// close to white so the panel still reads as a light tint on newsprint
// rather than a colour block competing with the photo. One is picked per
// caption (see captionTintSeed below), not fixed, so a page with several
// inside-image captions doesn't repeat the same chip colour on every photo.
const CAPTION_TINT_PALETTE = [
  "#f2efe6", // warm cream
  "#e9f1fb", // light blue
  "#eaf5ec", // light sage green
  "#f1ecf9", // light lavender
  "#faeeef", // light blush/rose
  "#faf3e1", // light sand
  "#eef2f4", // light steel grey-blue
];
// Kicker's preferred/base size. The headline is boosted up to this size
// when it would otherwise be smaller (see the kicker-floor boost below),
// and the kicker itself is always capped at the headline's final size.
const KICKER_BASE_FONT_SIZE = 17;
/**
 * Narrow (1-2 col) badge boxes draw their outline this far below the story's
 * top edge, and the kicker pill is centred on that lowered line. Without the
 * offset the pill's upper half — which sits above the outline by design —
 * would collide with whatever article sits directly above. Shared with the
 * canvas renderer so the outline and the pill stay on the same line.
 */
export const NARROW_KICKER_BOX_TOP_MARGIN = 7;

const ARTICLE_PADDING = {
  // Trimmed alongside the row gap: the space between two stacked articles is
  // this box's bottom padding + the row gap + the next box's top padding, so
  // all three had to come down together to visibly close the gap. Cut ~30%
  // from 4/8/4/8 per an explicit request to tighten spacing further; still
  // enough clearance to keep text off the tinted/badge box outlines.
  top: 3,
  right: 6,
  bottom: 3,
  left: 6,
};
/**
 * Headlines and subheadlines are set as labels rather than sentences, so they
 * carry no terminal punctuation — this strips a trailing Devanagari danda or
 * Latin full stop (source copy supplies both). Body text, captions and bullets
 * keep theirs.
 */
const HEADING_TERMINATOR = /[।|.]+[\s]*$/u;

const stripHeadingTerminator = (text: string) => text.replace(HEADING_TERMINATOR, "").trimEnd();

/**
 * Single-column boxes are the narrowest headline slot on the page. A long
 * headline forced into that width only fits within its 2-line cap by
 * shrinking the font — so instead of shrinking, cut the headline down to a
 * word count that reads comfortably at full size. Trailing punctuation left
 * dangling by the cut is stripped too.
 */
const SINGLE_COLUMN_HEADLINE_MAX_WORDS = 8;
const TRAILING_HEADLINE_PUNCTUATION = /[,:;।\-–—]+\s*$/u;

const truncateHeadlineWords = (text: string, maxWords: number) => {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length <= maxWords) {
    return text;
  }

  return words.slice(0, maxWords).join(" ").replace(TRAILING_HEADLINE_PUNCTUATION, "").trim();
};

const stripHeadingTerminatorFromRichText = (content: RichTextContent): RichTextContent => {
  if (typeof content === "string") {
    return stripHeadingTerminator(content);
  }

  if (!content?.spans?.length) {
    return content;
  }

  const spans = [...content.spans];
  // Trailing punctuation lives on the last span that actually has text.
  for (let index = spans.length - 1; index >= 0; index -= 1) {
    const spanText = spans[index].text ?? "";
    if (!spanText.trim()) {
      continue;
    }
    const stripped = stripHeadingTerminator(spanText);
    if (stripped !== spanText) {
      spans[index] = { ...spans[index], text: stripped };
    }
    break;
  }

  return { ...content, spans };
};

const MIN_BODY_HEIGHT = 42;
// Gap between an article's own internal body text columns. Cut ~30% from
// 8.64pt (which matched the page's column gutter) per an explicit request to
// tighten spacing inside article boxes, horizontally as well as vertically.
const COLUMN_GAP = 6.05;
const EIGHT_COLUMN_BODY_COLUMN_GAP = 9.05;
const MIN_BODY_COLUMN_WIDTH = 120;
const EIGHT_COLUMN_MIN_BODY_COLUMN_WIDTH = 95;
const HEADLINE_MEASUREMENT_SAFETY_RATIO = 1;
const MM_TO_POINTS = 72 / 25.4;
const DEFAULT_ARTICLE_END_BREATHING_SPACE_MM = 2;
const DEFAULT_SELECTIVE_DIVIDER_RATIO = 1 / 3;
const BYLINE_DOT_COLOR = "#b42318";
const BYLINE_DIVIDER_GAP = 1.5;
const BYLINE_DIVIDER_TO_BODY = 5;

type ArticleFitOverrides = Partial<EditorialFitCandidateSettings> & {
  imageHeightMode?: "auto" | "fixed";
  // Forces the inline-subheadline bullet block off entirely, regardless of
  // whether it would otherwise fit — used by composeArticleBox's
  // retry-without-bullets pass when a first attempt (bullets shown) still
  // overflows its body.
  suppressInlineSubheadline?: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const LEADING_BODY_SEPARATOR_REGEX = /^[\s|¦:;.,!?\-\u2013\u2014\u0964\u0965\uFF1A]+/u;

const stripLeadingBodySeparatorsFromRichText = (content: RichTextContent): RichTextContent => {
  const normalized = normalizeRichText(content);
  let isStillLeading = true;
  const spans = normalized.spans.flatMap((span) => {
    if (!isStillLeading || typeof span.text !== "string") {
      return [span];
    }

    const text = span.text.replace(LEADING_BODY_SEPARATOR_REGEX, "");
    if (text.length === 0) {
      return [];
    }

    isStillLeading = false;
    return [{ ...span, text }];
  });

  return { spans };
};

const applyOpticalTypographyToLayout = (
  layout: ArticleLayout,
  compositionSettings: ArticleCompositionSettings,
) => {
  const optical = applyOpticalTypography(layout, compositionSettings.opticalTypography ?? true).layout;

  if (!compositionSettings.suppressBodySegments) {
    return optical;
  }

  /**
   * Optical margins hang punctuation by splitting a line into segments, and
   * for a line that arrives with none it synthesises one to hang
   * (applyOpticalMarginToLine's `[createLineSegment(line)]`). That quietly
   * undoes `suppressBodySegments`: the column asked to be drawn as whole
   * lines and got handed back one- or two-segment lines instead.
   *
   * It matters because BOTH renderers justify a body line only when it has no
   * segments — Konva's drawBodyLine guards on `!line.segments ||
   * line.segments.length === 0`, and the PDF canvas takes its segment branch
   * first and spreads gaps between segments, of which a synthesised line has
   * none. So the synthesised segment left every column of this body ragged
   * while the composer believed it was justified. Body copy goes back to
   * whole lines here; headlines and the rest keep their optical hanging.
   */
  return {
    ...optical,
    body: {
      ...optical.body,
      columns: optical.body.columns.map((column) => ({
        ...column,
        lines: column.lines.map((line) => ({ ...line, segments: undefined })),
      })),
    },
  };
};

const getLineHeightPx = (style: ArticleTextStyle) => style.fontSize * style.lineHeight;
const getTrackingPx = (tracking: number | undefined, fontSize: number) =>
  ((tracking ?? 0) / 1000) * fontSize;
const resolveCharacterSpacing = ({
  tracking,
  letterSpacing,
  fontSize,
}: {
  tracking?: number;
  letterSpacing?: number;
  fontSize: number;
}) => getTrackingPx(tracking, fontSize) + (letterSpacing ?? 0);

const measureRenderedTextWidth = (text: string, style: ArticleTextStyle) =>
  measureTextWidth({
    text,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontStyle: style.fontStyle,
  });

const getAlignedX = (
  x: number,
  width: number,
  contentWidth: number,
  align: ArticleTextStyle["align"],
) => {
  if (align === "center") {
    return x + Math.max(0, width - contentWidth) / 2;
  }

  if (align === "right") {
    return x + Math.max(0, width - contentWidth);
  }

  return x;
};

const expandLineForNewspaperJustification = ({
  text,
  targetWidth,
  style,
  justify,
  engineMode = "newspaper",
}: {
  text: string;
  targetWidth: number;
  style: ArticleTextStyle;
  justify: boolean;
  engineMode?: EditorialJustifyEngineMode;
}) => {
  return justifyNewspaperLine({
    text,
    targetWidth,
    style,
    justify,
    engineMode,
  }).text;
};

const shouldJustifyLine = (
  align: ArticleTextStyle["align"],
  lineIndex: number,
  lineCount: number,
  justifyMode?: EditorialJustifyMode,
) =>
  align === "justify" &&
  (justifyMode === "justify-all-lines" || lineIndex < lineCount - 1);

const snapMinMeasurementToBaseline = (
  value: number,
  minimum: number,
  baselineGrid: ReturnType<typeof createBaselineGrid>,
  mode: "floor" | "ceil" | "round" = "ceil",
) => Math.max(minimum, snapMeasurementToBaseline(value, baselineGrid, mode));

const defaultCompositionSettings: ArticleCompositionSettings = {
  showRegionDebug: false,
  bodyRendererMode: "line",
  headlineScale: 0.8,
  baselineGridSize: 6,
  articleEndBreathingSpaceEnabled: true,
  articleEndBreathingSpaceMm: DEFAULT_ARTICLE_END_BREATHING_SPACE_MM,
  selectiveDividerLinesEnabled: true,
  selectiveDividerLineRatio: DEFAULT_SELECTIVE_DIVIDER_RATIO,
  enableDropCap: false,
  enableFactBox: false,
  enablePullQuote: false,
  opticalTypography: true,
  productionView: false,
};

const withBackgroundColor = <Style extends { containerBackgroundColor: string; frameBackgroundColor?: string }>(
  style: Style,
  backgroundColor: string | undefined,
) => ({
  ...style,
  containerBackgroundColor: backgroundColor ?? style.containerBackgroundColor,
  frameBackgroundColor: backgroundColor ?? style.frameBackgroundColor ?? style.containerBackgroundColor,
});

const defaultStoryImageSettings: StoryImageSettings = {
  imageEnabled: true,
  imageAlignment: "right",
  imageColumnSpan: 2,
  imageHeight: 144,
  imageHeightMode: "auto",
  imageHeightPreset: "medium",
  imageHeightProtection: true,
  autoSizeImage: true,
  imageWrapMode: "newspaper",
  imageShapeType: "rectangle",
  imageShapePoints: [],
  imageCrop: {
    x: 0,
    y: 0,
    zoom: 1,
    rotation: 0,
    opacity: 0.45,
  },
  wrapContourPoints: [],
  wrapTextOffset: 1,
};

const intersectRegion = (
  region: ReturnType<typeof generateTextRegions>["regions"][number],
  bounds: { x: number; y: number; width: number; height: number },
) => {
  const x = Math.max(region.x, bounds.x);
  const y = Math.max(region.y, bounds.y);
  const right = Math.min(region.x + region.width, bounds.x + bounds.width);
  const bottom = Math.min(region.y + region.height, bounds.y + bounds.height);
  const width = right - x;
  const height = bottom - y;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    ...region,
    x,
    y,
    width,
    height,
    area: width * height,
  };
};

export const composeArticleBox = (
  articleBox: ArticleBoxModel &
    Partial<StoryImageSettings> &
    Partial<StoryTypographySettings> & { priority?: StoryPriority; contentLanguage?: "hindi" | "english" },
  articleData: ArticleData,
  compositionSettings: ArticleCompositionSettings = defaultCompositionSettings,
): ArticleLayout => {
  let activeArticleData = articleData;
  if (activeArticleData.location && activeArticleData.body) {
    const location = activeArticleData.location.trim();
    if (location) {
      const escapedLocation = location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const locationRegex = new RegExp(`^${escapedLocation}\\s*[.,\\-:]?\\s*`, "i");
      const normalizedBody = normalizeRichText(activeArticleData.body);
      if (normalizedBody.spans.length > 0) {
        const firstSegment = normalizedBody.spans[0];
        if (firstSegment && typeof firstSegment.text === "string") {
          const strippedText = firstSegment.text.replace(locationRegex, "");
          if (strippedText !== firstSegment.text) {
            activeArticleData = {
              ...activeArticleData,
              body: { spans: [{ ...firstSegment, text: strippedText }, ...normalizedBody.spans.slice(1)] },
            };
          }
        }
      }
    }
  }
  if (activeArticleData.body) {
    activeArticleData = {
      ...activeArticleData,
      body: stripLeadingBodySeparatorsFromRichText(activeArticleData.body),
    };
  }

  const isPureAd =
    (articleBox as any).role === "advertisement" ||
    (!richTextToPlainText(activeArticleData.headline).trim() &&
      !richTextToPlainText(activeArticleData.body).trim() &&
      Boolean((activeArticleData as any).imageUrl));

  if (isPureAd) {
    return composeArticleBoxPass(articleBox, activeArticleData, compositionSettings);
  }

  // Fit article text to reach the last line of the box, ending cleanly at the closest full stop / sentence boundary
  let fittedLayout = SentenceEndFittingEngine.adjustArticleSentenceEnd({
    articleBox,
    articleData: activeArticleData,
    compositionSettings,
    composePass: (box, data, settings, fitOverrides) =>
      composeArticleBoxPass(box, data, settings, fitOverrides),
  });

  // A box can show its inline-subheadline bullets (they only need to clear a
  // thin body-reserve check to be included) and still end up with its body
  // text overflowing the box overall — that check guarantees a sliver of
  // body room, not that the whole story actually fits. Retry the full fit
  // pass with bullets suppressed and keep whichever result is actually
  // better, rather than guessing a stricter reserve threshold that would
  // either still allow overflow in some cases or needlessly drop bullets on
  // boxes that were genuinely fine.
  if (
    fittedLayout.body.overflow &&
    fittedLayout.inlineSubheadline &&
    fittedLayout.inlineSubheadline.length > 0
  ) {
    const withoutBulletsLayout = SentenceEndFittingEngine.adjustArticleSentenceEnd({
      articleBox,
      articleData,
      compositionSettings,
      composePass: (box, data, settings, fitOverrides) =>
        composeArticleBoxPass(box, data, settings, { ...fitOverrides, suppressInlineSubheadline: true }),
    });
    if (
      !withoutBulletsLayout.body.overflow ||
      withoutBulletsLayout.metrics.hiddenLines < fittedLayout.metrics.hiddenLines
    ) {
      fittedLayout = withoutBulletsLayout;
    }
  }

  // Dynamic Image Balancer post-layout pass (skipped if _skipDynamicImageBalancing is true)
  if (compositionSettings._skipDynamicImageBalancing) {
    return applyOpticalTypographyToLayout(fittedLayout, compositionSettings);
  }

  const balancedResult = balanceArticleImage({
    baselineLayout: fittedLayout,
    articleBox,
    articleData,
    compositionSettings,
    composePass: (box, data, settings, fitOverrides) =>
      composeArticleBoxPass(box, data, settings, fitOverrides),
    sourceImageWidth: articleBox.sourceWidth,
    sourceImageHeight: articleBox.sourceHeight,
  });

  return applyOpticalTypographyToLayout(balancedResult.layout, compositionSettings);
};


const buildJustifiedRichSegments = (
  renderText: string,
  richLine: RichTextTypographyLine | undefined,
  lineX: number,
  lineY: number,
  lineAdvance: number,
): ArticleLayoutTextLine["segments"] => {
  if (!richLine || !richLine.segments || richLine.segments.length === 0) {
    return undefined;
  }

  // Single segment line gets full renderText with expanded spaces
  if (richLine.segments.length === 1) {
    const seg = richLine.segments[0];
    const segWidth = measureRenderedTextWidth(renderText, seg.style);
    return [
      {
        x: lineX,
        y: lineY,
        width: segWidth,
        height: lineAdvance,
        text: renderText,
        style: {
          ...seg.style,
          wrap: "none",
          // x is a pre-computed LEFT edge (from getAlignedX); the canvas
          // draw must use left-anchored text or it re-centers/re-rights
          // around that coordinate and renders in the wrong place.
          align: "left",
        },
      },
    ];
  }

  const origWords = richLine.text.split(/(\s+)/u);
  const renderWords = renderText.split(/(\s+)/u);

  let currentX = lineX;
  let previousVisibleText = "";
  let previousRelativeEnd = 0;

  return richLine.segments.map((seg) => {
    const segStart = Math.max(0, seg.start - richLine.start);
    const segEnd = Math.max(segStart, seg.end - richLine.start);

    let segRenderText = seg.text;
    if (origWords.length === renderWords.length) {
      let charCount = 0;
      let mappedText = "";
      for (let i = 0; i < origWords.length; i++) {
        const oWord = origWords[i];
        const rWord = renderWords[i];
        const wordStart = charCount;
        const wordEnd = charCount + oWord.length;
        charCount = wordEnd;

        if (wordEnd > segStart && wordStart < segEnd) {
          if (!/^\s+$/u.test(rWord) && (wordStart < segStart || wordEnd > segEnd)) {
            const startOffset = Math.max(0, segStart - wordStart);
            const endOffset = Math.min(rWord.length, segEnd - wordStart);
            mappedText += rWord.slice(startOffset, endOffset);
          } else {
            mappedText += rWord;
          }
        }
      }
      if (mappedText) {
        segRenderText = mappedText;
      }
    }

    const hasVisiblePrevious = /\S/u.test(previousVisibleText);
    const hasVisibleCurrent = /\S/u.test(segRenderText);
    const originalBoundaryText = richLine.text.slice(previousRelativeEnd, segStart);
    const currentStartsWithSpace = /^\s/u.test(segRenderText);
    const needsProtectedBoundarySpace =
      hasVisiblePrevious &&
      hasVisibleCurrent &&
      (/\s/u.test(originalBoundaryText) || currentStartsWithSpace);
    const boundarySpaceWidth = needsProtectedBoundarySpace
      ? Math.max(
          measureRenderedTextWidth(" ", seg.style),
          Math.round(seg.style.fontSize * 0.2 * 10) / 10,
        )
      : 0;
    const visibleText = segRenderText.replace(/^\s+/u, "");
    const drawableText = needsProtectedBoundarySpace ? visibleText : segRenderText;
    const segWidth = measureRenderedTextWidth(drawableText, seg.style);
    const segX = currentX + boundarySpaceWidth;
    currentX = segX + segWidth;
    previousVisibleText = drawableText;
    previousRelativeEnd = segEnd;

    return {
      x: segX,
      y: lineY,
      width: segWidth,
      height: lineAdvance,
      text: drawableText,
      style: {
        ...seg.style,
        wrap: "none",
        // segX values are sequential LEFT edges (currentX accumulates by
        // segWidth per segment) — each segment MUST draw left-anchored, or
        // a "center"/"right" aligned style makes canvas re-center/re-right
        // the glyphs around segX, overlapping this segment back over the
        // previous one instead of continuing the line left-to-right.
        align: "left",
      },
    };
  });
};

const createLineBoxes = (
  x: number,
  width: number,
  wrappedLines: string[],
  style: ArticleTextStyle,
  linePositions: number[],
  lineAdvance: number,
  richLines?: RichTextTypographyLine[],
  justifyMode?: EditorialJustifyMode,
  justifyEngineMode?: EditorialJustifyEngineMode,
): ArticleLayoutTextLine[] => {
  return wrappedLines.map((line, index) => {
    const richLine = richLines?.[index];
    const justify = shouldJustifyLine(style.align, index, wrappedLines.length, justifyMode);
    const renderText = expandLineForNewspaperJustification({
      text: line,
      targetWidth: width,
      style,
      justify,
      engineMode: justifyEngineMode,
    });
    const contentWidth = richLine?.width ?? measureRenderedTextWidth(renderText, style);
    const lineX = getAlignedX(x, width, contentWidth, style.align);
    const lineY = linePositions[index];
    const measuredFontStyle = style.fontStyle ?? "normal";
    const measuredFontString = createCanvasFontString(style.fontFamily, style.fontSize, measuredFontStyle);

    return {
      x,
      y: lineY,
      width,
      height: lineAdvance,
      text: renderText,
      style: {
        ...style,
        wrap: "none",
      },
      measuredWidth: contentWidth,
      renderedWidth: contentWidth,
      measuredFontFamily: style.fontFamily,
      measuredFontSize: style.fontSize,
      measuredFontStyle,
      measuredFontWeight: measuredFontStyle,
      measuredFontString,
      segments: buildJustifiedRichSegments(renderText, richLine, lineX, lineY, lineAdvance),
    };
  });
};

const createTextBlock = (
  x: number,
  y: number,
  width: number,
  text: string,
  style: ArticleTextStyle,
  metrics: TypographyResult,
  baselineGrid: ReturnType<typeof createBaselineGrid>,
  richLines?: RichTextTypographyLine[],
  justifyMode?: EditorialJustifyMode,
  justifyEngineMode?: EditorialJustifyEngineMode,
): ArticleLayoutTextBlock => {
  const baselineMetrics = createBaselineTextMetrics({
    y,
    lineCount: metrics.wrappedLines.length,
    lineHeight: getLineHeightPx(style),
    baselineGrid,
  });

  return {
    x,
    y: baselineMetrics.startY,
    width,
    text,
    wrappedLines: metrics.wrappedLines,
    lineCount: metrics.lineCount,
    height: baselineMetrics.height,
    overflow: metrics.overflow,
    style,
    layoutBounds: {
      x,
      y: baselineMetrics.startY,
      width,
      height: baselineMetrics.height,
    },
    lineBoxes: createLineBoxes(
      x,
      width,
      metrics.wrappedLines,
      style,
      baselineMetrics.linePositions,
      baselineMetrics.lineAdvance,
      richLines,
      justifyMode,
      justifyEngineMode,
    ),
  };
};

const createRichTextBlock = (
  x: number,
  y: number,
  width: number,
  content: RichTextContent,
  fallbackText: string,
  style: ArticleTextStyle,
  metrics: TypographyResult,
  baselineGrid: ReturnType<typeof createBaselineGrid>,
  justifyMode?: EditorialJustifyMode,
  justifyEngineMode?: EditorialJustifyEngineMode,
): ArticleLayoutTextBlock => {
  const richLines = hasRichTextStyling(content)
    ? createRichLinesFromWrappedLines(content, metrics.wrappedLines, style)
    : undefined;

  return createTextBlock(x, y, width, fallbackText, style, metrics, baselineGrid, richLines, justifyMode, justifyEngineMode);
};

const fillHeadlineLineEdges = (block: ArticleLayoutTextBlock, sourceLineWidths: number[]): ArticleLayoutTextBlock => {
  const filledLineBoxes = block.lineBoxes.map((line, lineIndex) => {
    const targetWidth = block.width * 0.99;
    const currentWidth = sourceLineWidths[lineIndex] ?? line.measuredWidth ?? line.renderedWidth ?? line.width;

    if (!line.text.trim() || currentWidth >= targetWidth) {
      return line;
    }

    const scaleX = Math.min(1.35, targetWidth / Math.max(1, currentWidth));

    if (scaleX <= 1.005) {
      return line;
    }

    if (line.segments?.length) {
      const renderedWidth = currentWidth * scaleX;

      return {
        ...line,
        width: currentWidth,
        measuredWidth: renderedWidth,
        renderedWidth,
        scaleX,
      };
    }

    const renderedWidth = currentWidth * scaleX;

    return {
      ...line,
      width: currentWidth,
      measuredWidth: renderedWidth,
      renderedWidth,
      scaleX,
    };
  });

  return {
    ...block,
    lineBoxes: filledLineBoxes,
  };
};

const applyNewspaperBylineSegments = (
  block: ArticleLayoutTextBlock,
  style: ArticleTextStyle,
): ArticleLayoutTextBlock => {
  if (!block.text.includes(BYLINE_SEPARATOR) || block.lineBoxes.length === 0) {
    return block;
  }

  let fittedStyle = style;
  const measuredWidth = measureRenderedTextWidth(block.text, fittedStyle);
  if (measuredWidth > block.width) {
    const scale = Math.max(0.72, Math.min(1, (block.width - 2) / Math.max(1, measuredWidth)));
    fittedStyle = {
      ...style,
      fontSize: style.fontSize * scale,
      lineHeight: style.lineHeight,
    };
  }
  const [creditText = "", placeText = ""] = block.text.split(BYLINE_SEPARATOR).map((part) => part.trim());
  const separatorGap = Math.max(1.4, fittedStyle.fontSize * 0.18);
  const dotStyle: ArticleTextStyle = {
    ...fittedStyle,
    fill: BYLINE_DOT_COLOR,
    fontSize: fittedStyle.fontSize * 0.92,
    lineHeight: fittedStyle.lineHeight,
    wrap: "none",
  };
  const creditWidth = measureRenderedTextWidth(creditText, fittedStyle);
  const dotWidth = Math.max(3.2, fittedStyle.fontSize * 0.42);
  const placeWidth = measureRenderedTextWidth(placeText, fittedStyle);
  const segmentedWidth = creditWidth + dotWidth + placeWidth + separatorGap * 2;
  const finalWidth = Math.min(block.width, segmentedWidth);
  const groupX = block.x + Math.max(0, (block.width - finalWidth) / 2);

  return {
    ...block,
    style: fittedStyle,
    lineBoxes: block.lineBoxes.map((line, lineIndex) => {
      if (lineIndex !== 0) {
        return line;
      }
      return {
        ...line,
        style: fittedStyle,
        x: groupX,
        width: finalWidth,
        segments: [
          {
            x: groupX,
            y: line.y,
            width: creditWidth,
            height: line.height,
            text: creditText,
            style: { ...fittedStyle, wrap: "none" as const },
            measuredWidth: creditWidth,
            renderedWidth: creditWidth,
            measuredFontFamily: fittedStyle.fontFamily,
            measuredFontSize: fittedStyle.fontSize,
            measuredFontStyle: fittedStyle.fontStyle ?? "normal",
            measuredFontWeight: fittedStyle.fontStyle ?? "normal",
          },
          {
            x: groupX + creditWidth + separatorGap,
            y: line.y,
            width: dotWidth,
            height: line.height,
            text: "\u2022",
            role: "byline-dot" as const,
            style: dotStyle,
          },
          {
            x: groupX + creditWidth + separatorGap + dotWidth + separatorGap,
            y: line.y,
            width: placeWidth,
            height: line.height,
            text: placeText,
            style: { ...fittedStyle, wrap: "none" as const },
            measuredWidth: placeWidth,
            renderedWidth: placeWidth,
            measuredFontFamily: fittedStyle.fontFamily,
            measuredFontSize: fittedStyle.fontSize,
            measuredFontStyle: fittedStyle.fontStyle ?? "normal",
            measuredFontWeight: fittedStyle.fontStyle ?? "normal",
          },
        ],
      };
    }),
  };
};

const applyInlineBulletSegments = (
  block: ArticleLayoutTextBlock,
  style: ArticleTextStyle,
): ArticleLayoutTextBlock => {
  if (block.lineBoxes.length === 0) return block;
  const firstLine = block.lineBoxes[0];
  if (!firstLine || !firstLine.text.trim().startsWith("•")) return block;

  const textWithoutBullet = firstLine.text.replace(/^[•\u2022]\s*/u, "").trim();
  const dotWidth = Math.max(3.5, style.fontSize * 0.45);
  const gap = Math.max(2.5, style.fontSize * 0.3);
  const textWidth = measureRenderedTextWidth(textWithoutBullet, style);

  const dotSegment = {
    x: firstLine.x,
    y: firstLine.y,
    width: dotWidth,
    height: firstLine.height,
    text: "\u2022",
    role: "byline-dot" as const,
    style: {
      ...style,
      fill: style.fill || "#b42318",
      wrap: "none" as const,
    },
  };

  const textSegment = {
    x: firstLine.x + dotWidth + gap,
    y: firstLine.y,
    width: textWidth,
    height: firstLine.height,
    text: textWithoutBullet,
    style: {
      ...style,
      wrap: "none" as const,
    },
  };

  return {
    ...block,
    lineBoxes: [
      {
        ...firstLine,
        segments: [dotSegment, textSegment],
      },
      ...block.lineBoxes.slice(1),
    ],
  };
};

const createEditorialLabelLayout = (
  x: number,
  y: number,
  width: number,
  label: ArticleData["kicker"],
  baselineGrid: ReturnType<typeof createBaselineGrid>,
  maxLines: number = 1,
): EditorialLabelLayout | null => {
  const text = richTextToPlainText(label.text).trim();

  if (!label.enabled || !text) {
    return null;
  }

  const padding = Math.max(0, label.style.padding);
  // Longer kicker text (multi-word secondary heading) wraps across multiple
  // lines and reads as a full-width band; short single-line labels (strap
  // tags like a place name) keep the original tight auto-width pill look.
  const allowWrap = maxLines > 1;
  const textStyle: ArticleTextStyle = {
    align: label.style.alignment,
    fill: label.style.color,
    fontFamily: getNewspaperFontStack("sans"),
    fontSize: label.style.fontSize,
    fontStyle: String(label.style.fontWeight),
    letterSpacing: 0,
    lineHeight: allowWrap ? 1.18 : 1.16,
    wrap: allowWrap ? "word" : "none",
  };
  const metrics = measureArticleParagraph({
    content: label.text,
    text,
    width: Math.max(1, width - padding * 2),
    style: textStyle,
    maxLines,
  });
  const desiredWidth = allowWrap
    ? width
    : Math.min(width, Math.max(1, metrics.consumedWidth + padding * 2));
  const labelX =
    label.style.alignment === "center"
      ? x + (width - desiredWidth) / 2
      : label.style.alignment === "right"
        ? x + width - desiredWidth
        : x;
  const textBlock = createRichTextBlock(
    labelX + padding,
    y + padding,
    Math.max(1, desiredWidth - padding * 2),
    label.text,
    text,
    textStyle,
    metrics,
    baselineGrid,
  );

  return {
    x: labelX,
    y,
    width: desiredWidth,
    height: textBlock.height + padding * 2,
    textBlock,
    fill: label.style.backgroundColor,
    cornerRadius: label.style.borderRadius,
    padding,
  };
};

const createCaptionRichContent = (
  label: string,
  content: RichTextContent,
  style: ArticleData["caption"]["labelStyle"],
): RichTextContent => {
  const prefix = label.trim();

  if (!prefix) {
    return content;
  }

  const labelText = prefix.endsWith(" ") ? prefix : `${prefix} `;

  if (typeof content === "string") {
    return {
      spans: [
        {
          text: labelText,
          color: style.color,
          backgroundColor:
            style.backgroundColor === "transparent" ? undefined : style.backgroundColor,
          fontWeight: style.fontWeight,
          bold: style.fontWeight >= 700,
        },
        {
          text: content,
        },
      ],
    };
  }

  return {
    spans: [
      {
        text: labelText,
        color: style.color,
        backgroundColor:
          style.backgroundColor === "transparent" ? undefined : style.backgroundColor,
        fontWeight: style.fontWeight,
        bold: style.fontWeight >= 700,
      },
      ...content.spans,
    ],
  };
};

const getCaptionCreditText = (caption: ArticleData["caption"]) => {
  const explicitCredit = richTextToPlainText(caption.creditText).trim();

  if (explicitCredit) {
    return explicitCredit;
  }

  return [caption.photographer, caption.agency].filter(Boolean).join(" | ");
};

const createCaptionLayout = ({
  caption,
  image,
  fallbackY,
  width,
  style,
  baselineGrid,
  typographyControls,
  containerStyles,
  boxOverride,
}: {
  caption: ArticleData["caption"];
  image: { x: number; y: number; width: number; height: number } | null;
  fallbackY: number;
  width: number;
  style: ArticleTextStyle;
  baselineGrid: ReturnType<typeof createBaselineGrid>;
  typographyControls: ArticleData["typography"];
  containerStyles: ReturnType<typeof normalizeContainerStyles>;
  // When set (inside-image captions), the caption occupies exactly this
  // pre-carved, non-overlapping region of the image box instead of floating
  // on top of the full photo.
  boxOverride?: { x: number; y: number; width: number; height: number } | null;
}): CaptionLayout | null => {
  const captionText = richTextToPlainText(caption.text).trim();

  if (!caption.enabled || !captionText) {
    return null;
  }

  const imageX = image?.x ?? 0;
  const imageY = image?.y ?? fallbackY;
  const imageWidth = image?.width ?? width;
  const imageHeight = image?.height ?? 0;
  const isOverlayPosition = caption.position.startsWith("overlay");
  const isSideOverlayPosition = caption.position === "overlay-left" || caption.position === "overlay-right";
  const isBottomOverlayPosition =
    caption.position === "overlay-bottom" || caption.position === "overlay-bottom-gradient";
  const hasCustomCaptionBackground =
    Boolean(caption.captionStyle.backgroundColor) && caption.captionStyle.backgroundColor !== "transparent";
  // Inside-image captions get their own dedicated light panel next to the
  // photo, not text laid over the photo, so default to a light chip unless
  // the user picked their own colors. Which tint is picked is deterministic
  // (hashed off the caption's own text — image.x/y turned out NOT to vary
  // between same-shaped boxes, since a box's image sits at a position
  // relative to the box's own layout, not the page, so two similarly-shaped
  // story boxes elsewhere on the page were landing on identical coordinates
  // and always picking the same tint) rather than random-per-render, so a
  // given document keeps the same look across regenerations.
  const captionTintSeed = Array.from(captionText).reduce(
    (hash, char) => (hash * 31 + char.codePointAt(0)!) >>> 0,
    7,
  );
  const overlayBackgroundColor = hasCustomCaptionBackground
    ? caption.captionStyle.backgroundColor
    : CAPTION_TINT_PALETTE[captionTintSeed % CAPTION_TINT_PALETTE.length];
  const overlayTextColor = hasCustomCaptionBackground ? caption.captionStyle.color : "#2a2620";
  const captionContainerStyle = withBackgroundColor(
    containerStyles.caption,
    caption.captionStyle.backgroundColor === "transparent" ? undefined : caption.captionStyle.backgroundColor,
  );
  const verticalPadding = isOverlayPosition ? 4 : 0.5;
  const horizontalPadding = isOverlayPosition ? 6 : 0;

  captionContainerStyle.framePaddingTop = verticalPadding;
  captionContainerStyle.framePaddingBottom = verticalPadding;
  captionContainerStyle.framePaddingLeft = horizontalPadding;
  captionContainerStyle.framePaddingRight = horizontalPadding;

  // Side overlays get a narrow strip along one edge of the image instead of
  // the full image width, so the photo stays mostly visible. When the caller
  // has already carved out an exact strip (boxOverride), use that instead.
  const sideStripWidth = Math.min(170, Math.max(60, imageWidth * 0.4));
  const boxWidth = boxOverride?.width ?? (isSideOverlayPosition ? sideStripWidth : imageWidth);
  const bottomOverlayHeight = isBottomOverlayPosition ? Math.max(18, imageHeight * 0.2) : null;
  const boxHeight = boxOverride?.height ?? bottomOverlayHeight;
  const boxX = boxOverride?.x ?? (!image
    ? 0
    : caption.position === "overlay-right"
      ? imageX + imageWidth - boxWidth
      : imageX);
  const captionX = boxX;
  const contentX = captionX + horizontalPadding;
  const contentWidth = Math.max(1, boxWidth - horizontalPadding * 2);

  // Overlay captions read as small compact chips on the photo rather than a
  // full editorial caption line, so trim the font size a little.
  const overlayFontScale = isSideOverlayPosition ? 0.85 : isOverlayPosition ? 0.93 : 1;
  const captionBaseStyle: ArticleTextStyle = {
    ...style,
    align: isOverlayPosition ? "center" : "left",
    fill: isOverlayPosition ? overlayTextColor : caption.captionStyle.color,
    fontSize: Math.max(7, caption.captionStyle.fontSize * overlayFontScale),
    fontStyle: `italic ${caption.captionStyle.fontWeight}`,
    letterSpacing: resolveCharacterSpacing({
      tracking: typographyControls.captionTracking,
      letterSpacing: typographyControls.captionLetterSpacing,
      fontSize: caption.captionStyle.fontSize,
    }),
    lineHeight: 1.15,
  };

  // Side strips are narrow but tall, and bottom/top strips are short but
  // wide — let the caption wrap across as many lines as the reserved box can
  // actually hold instead of a flat cap. Non-overlay captions are capped at
  // 2 lines -- publisher request. This was raised to 3 once before because
  // long real captions were hitting the word-by-word ellipsis fallback
  // below at 2 lines, but that traded a subtler problem (font shrinking
  // more) for a more visible one (an extra caption row, inconsistent with
  // every 2-line caption elsewhere on the page). fitCaptionToTwoLines
  // already shrinks the font in ten steps down to 6.8pt before it ever
  // reaches the word-truncating fallback, so a 2-line cap should only rely
  // on that fallback for a genuinely extreme caption.
  const availableHeightForLines = boxHeight ?? imageHeight;
  const maxCaptionLines = isOverlayPosition
    ? clamp(
        Math.floor(
          Math.max(0, availableHeightForLines - verticalPadding * 2) /
            Math.ceil((isBottomOverlayPosition ? 4.6 : captionBaseStyle.fontSize) * 1.08),
        ),
        1,
        isSideOverlayPosition ? 7 : 3,
      )
    : 2;

  const fullText = captionText;

  const isEllipsisSupported = (testStyle: ArticleTextStyle) => {
    const widthEllipsis = measureTextWidth({ text: "…", fontFamily: testStyle.fontFamily, fontSize: testStyle.fontSize, fontStyle: testStyle.fontStyle });
    const widthMissing = measureTextWidth({ text: "\uFFFF", fontFamily: testStyle.fontFamily, fontSize: testStyle.fontSize, fontStyle: testStyle.fontStyle });
    return widthEllipsis > 0 && widthEllipsis !== widthMissing;
  };
  
  const fitCaptionToTwoLines = (
    contentStr: string,
    widthLimit: number,
    baseStyle: ArticleTextStyle,
    maxLines: number = 2,
  ) => {
    const makePlainItalicContent = (text: string, styleForText: ArticleTextStyle): RichTextContent => ({
      spans: [
        {
          text,
          color: styleForText.fill,
          fontSize: styleForText.fontSize,
          fontWeight: caption.captionStyle.fontWeight,
          italic: true,
        },
      ],
    });
    const measure = (t: string, style: ArticleTextStyle) => measureArticleParagraph({
      content: makePlainItalicContent(t, style),
      text: t,
      width: widthLimit,
      style,
    });

    let currentStyle = { ...baseStyle };
    let metrics = measure(contentStr, currentStyle);
    if (metrics.lines.length <= 1) {
      return {
        metrics,
        text: contentStr,
        content: makePlainItalicContent(contentStr, currentStyle),
        style: currentStyle,
      };
    }

    for (const scale of [0.96, 0.93, 0.9, 0.87, 0.84, 0.8, 0.76]) {
      const oneLineStyle = {
        ...baseStyle,
        fontSize: Math.max(baseStyle.fontSize * scale, 6.8),
      };
      const oneLineMetrics = measure(contentStr, oneLineStyle);

      if (oneLineMetrics.lines.length <= 1) {
        return {
          metrics: oneLineMetrics,
          text: contentStr,
          content: makePlainItalicContent(contentStr, oneLineStyle),
          style: oneLineStyle,
        };
      }
    }

    if (metrics.lines.length <= maxLines) {
      return {
        metrics,
        text: contentStr,
        content: makePlainItalicContent(contentStr, currentStyle),
        style: currentStyle,
      };
    }

    for (const scale of [0.95, 0.9, 0.85, 0.8, 0.76, 0.72, 0.66, 0.6, 0.54, 0.48]) {
      currentStyle = {
        ...baseStyle,
        fontSize: Math.max(baseStyle.fontSize * scale, isOverlayPosition ? 4.6 : 6.8),
        lineHeight: isOverlayPosition ? 1.02 : 1.08,
      };
      metrics = measure(contentStr, currentStyle);

      if (metrics.lines.length <= maxLines) {
        return {
          metrics,
          text: contentStr,
          content: makePlainItalicContent(contentStr, currentStyle),
          style: currentStyle,
        };
      }
    }

    currentStyle = {
      ...baseStyle,
      fontSize: isOverlayPosition ? 4.6 : 6.8,
      lineHeight: isOverlayPosition ? 1 : 1.04,
    };
    metrics = measure(contentStr, currentStyle);
    if (metrics.lines.length <= maxLines) {
      return {
        metrics,
        text: contentStr,
        content: makePlainItalicContent(contentStr, currentStyle),
        style: currentStyle,
      };
    }

    if (isOverlayPosition) {
      return {
        metrics,
        text: contentStr,
        content: makePlainItalicContent(contentStr, currentStyle),
        style: currentStyle,
      };
    }

    // Word by word shortening
    const words = contentStr.split(/\s+/);
    const ellipsis = isEllipsisSupported(currentStyle) ? "…" : "...";
    
    // First try punctuation/phrase boundary loosely (we'll just iteratively pop words)
    while (words.length > 1) {
      words.pop();
      const testText = words.join(" ") + ellipsis;
      
      const mockRichText = { spans: [{ text: testText, color: currentStyle.fill, fontSize: currentStyle.fontSize }] };
      
      const testMetrics = measureArticleParagraph({
        content: mockRichText,
        text: testText,
        width: widthLimit,
        style: currentStyle,
      });
      if (testMetrics.lines.length <= maxLines) {
        return {
          metrics: testMetrics,
          text: testText,
          content: makePlainItalicContent(testText, currentStyle),
          style: currentStyle,
        };
      }
    }

    // Fallback if even 1 word + ellipsis doesn't fit
    const testText = words[0] || ellipsis;
    return {
      metrics: measure(testText, currentStyle),
      text: testText,
      content: makePlainItalicContent(testText, currentStyle),
      style: currentStyle,
    };
  };

  const fittedCaption = fitCaptionToTwoLines(fullText, contentWidth, captionBaseStyle, maxCaptionLines);
  const captionMetrics = {
    ...fittedCaption.metrics,
    lines: fittedCaption.metrics.lines.slice(0, maxCaptionLines),
    wrappedLines: fittedCaption.metrics.wrappedLines.slice(0, maxCaptionLines),
    lineCount: Math.min(maxCaptionLines, fittedCaption.metrics.lineCount),
    overflow: false,
  };
  const captionLineAdvance = Math.ceil(fittedCaption.style.fontSize * Math.max(1.28, fittedCaption.style.lineHeight));
  captionMetrics.consumedHeight = Math.ceil(captionMetrics.lineCount * captionLineAdvance);
  // Inside a boxOverride, the text is vertically centered within the full
  // reserved panel rather than hugging one edge of the whole photo.
  const initialY = boxOverride
    ? boxOverride.y + Math.max(0, (boxOverride.height - (captionMetrics.consumedHeight + verticalPadding * 2)) / 2)
    : caption.position === "above-image"
      ? Math.max(0, imageY - captionMetrics.consumedHeight - verticalPadding * 2 - 10) // gap before the image starts right below it
      : caption.position === "overlay-top"
        ? imageY + 14 // clearance so the badge doesn't sit flush against the photo's top edge
        : isBottomOverlayPosition
          ? Math.max(
              imageY,
              imageY + imageHeight - (boxHeight ?? 0) + Math.max(0, ((boxHeight ?? 0) - (captionMetrics.consumedHeight + verticalPadding * 2)) / 2),
            )
          : Math.max(imageY + imageHeight + 10, fallbackY); // below-image (the common case) — gap raised 6->10, still sitting close after 3 rounds of "still sticking" reports
  // The panel itself always fills the full reserved box (so the light
  // background covers the whole strip and stays put at the box's top-left),
  // even though the text inside is vertically centered and may be shorter.
  const panelY = boxOverride
    ? boxOverride.y
    : bottomOverlayHeight
      ? Math.max(imageY, imageY + imageHeight - bottomOverlayHeight)
      : initialY;
  // Devanagari matras and descenders (ी, ृ, ड़) paint below the nominal line
  // advance. The renderer hard-clips the caption to this frame, so without a
  // descender allowance the bottom of the last line gets shaved off.
  const captionDescenderAllowance = Math.ceil(fittedCaption.style.fontSize * 0.3);
  const captionFrameHeight = boxOverride
    ? boxOverride.height
    : bottomOverlayHeight
      ? bottomOverlayHeight
    : Math.ceil(
        captionMetrics.consumedHeight +
          captionContainerStyle.framePaddingTop +
          captionContainerStyle.framePaddingBottom +
          captionDescenderAllowance,
      );
  const captionBlock = createRichTextBlock(
    contentX,
    initialY + verticalPadding,
    contentWidth,
    fittedCaption.content,
    fittedCaption.text,
    fittedCaption.style,
    captionMetrics,
    { gridSize: 1 },
    typographyControls.captionJustifyMode,
    typographyControls.captionJustifyEngineMode,
  );
  const captionTextHeight = Math.max(1, captionFrameHeight - verticalPadding * 2);
  captionBlock.height = captionTextHeight;
  captionBlock.layoutBounds = {
    x: captionBlock.x,
    y: captionBlock.y,
    width: captionBlock.width,
    height: captionTextHeight,
  };
  captionBlock.lineCount = Math.min(maxCaptionLines, captionBlock.lineBoxes.length);
  captionBlock.wrappedLines = captionBlock.wrappedLines.slice(0, maxCaptionLines);
  const captionItalicStyle = {
    ...fittedCaption.style,
    fontStyle: `italic ${caption.captionStyle.fontWeight}`,
  };
  captionBlock.style = captionItalicStyle;
  captionBlock.lineBoxes = captionBlock.lineBoxes.slice(0, maxCaptionLines).map((line) => ({
    ...line,
    style: {
      ...line.style,
      fontStyle: `italic ${caption.captionStyle.fontWeight}`,
    },
    height: Math.min(Math.max(line.height, captionLineAdvance), captionTextHeight),
    segments: line.segments?.map((segment) => ({
      ...segment,
      style: {
        ...segment.style,
        fontStyle: `italic ${caption.captionStyle.fontWeight}`,
      },
      height: Math.min(Math.max(segment.height, captionLineAdvance), captionTextHeight),
    })),
  }));
  const creditBlock = null;
  const sourceBlock = null;
  const layoutY = panelY;
  const layoutHeight = captionFrameHeight;

  return {
    x: captionX,
    y: layoutY,
    width: boxWidth,
    height: layoutHeight,
    textBlock: captionBlock,
    creditBlock,
    sourceBlock,
    fill: isOverlayPosition ? overlayBackgroundColor : undefined,
    stroke: undefined,
    strokeWidth: 0,
    cornerRadius: isOverlayPosition ? 2 : 1,
    position: caption.position,
    creditPosition: caption.creditPosition,
  };
};

const measureArticleParagraph = ({
  content,
  text,
  width,
  style,
  maxLines,
  script = "mixed",
  enableEnglishHyphenation = false,
}: {
  content: RichTextContent;
  text: string;
  width: number;
  style: ArticleTextStyle;
  maxLines?: number;
  script?: "unicode" | "kruti-dev" | "chanakya" | "4c-gandhi" | "english" | "mixed";
  enableEnglishHyphenation?: boolean;
}): TypographyResult => {
  if (hasRichTextStyling(content)) {
    const richMetrics = measureRichTextParagraph({
      content,
      width,
      baseStyle: style,
      maxLines,
    });

    return {
      lines: richMetrics.lines.map((line) => ({
        text: line.text,
        start: line.start,
        end: line.end,
        width: line.width,
      })),
      wrappedLines: richMetrics.wrappedLines,
      lineCount: richMetrics.lineCount,
      consumedHeight: richMetrics.consumedHeight,
      consumedWidth: richMetrics.consumedWidth,
      paragraphWidth: richMetrics.paragraphWidth,
      paragraphHeight: richMetrics.paragraphHeight,
      overflow: richMetrics.overflow,
      fullLineCount: richMetrics.fullLineCount,
    };
  }

  return measureParagraph({
    text,
    width,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontStyle: style.fontStyle,
    lineHeight: style.lineHeight,
    maxLines,
    script,
    enableEnglishHyphenation,
    // Without these the wrap engine measures untracked text, so the copyfitter's
    // horizontal adjustments could never move a word onto another line — the
    // reason gap-closing previously had to fall back to stretching leading.
    letterSpacing: style.letterSpacing,
    wordSpacing: style.wordSpacing,
  });
};


const createBodyColumns = (
  text: string,
  content: RichTextContent,
  regions: ReturnType<typeof generateTextRegions>["regions"],
  usabilityRules: RegionUsabilityRules,
  baselineGrid: ReturnType<typeof createBaselineGrid>,
  resolvedBodyStyle: ArticleTextStyle,
  typographyControls: ArticleData["typography"],
  verticalJustificationMaxAdjustmentRatio = 1,
  wrapPerRegion = false,
  suppressBodySegments = false,
  enableEnglishBodyHyphenation = false,
  constrainBodySegments = false,
  bodyColumnEdgeInsetPt = 0,
  nativeBodyJustifyText = false,
) => {
  const enableEnglishHyphenation =
    enableEnglishBodyHyphenation &&
    typographyControls.bodyAlignment === "justify" &&
    typographyControls.bodyJustifyEngineMode === "browser";
  const normContent = normalizeRunBoundaries(content);
  const baseLineHeightPx = getBaselineLineAdvance(getLineHeightPx(resolvedBodyStyle), baselineGrid);
  const { usableRegions } = partitionRegionsByUsability({
    regions,
    lineHeight: baseLineHeightPx,
    usabilityRules,
  });
  const measurementRegions = usableRegions.length > 0 ? usableRegions : regions;
  const textMeasureWidth = Math.max(
    1,
    measurementRegions.reduce(
      (minWidth, region) => Math.min(minWidth, region.width),
      measurementRegions[0]?.width ?? 1,
    ),
  );

  /**
   * Wraps body copy to the measure each line will actually be set in.
   *
   * The default path wraps ONCE, at the narrowest region's width, and
   * `flowLinesThroughRegions` then slices those lines into the regions by
   * capacity — it never re-wraps. That is right whenever every region is the
   * same width, which is every column layout on the news pages, and it is the
   * behaviour they keep: `wrapPerRegion` is false for all of them.
   *
   * It is wrong when the regions differ. The editorial leader wraps its copy
   * around a passport portrait, so the region beside the picture is about a
   * third of the column and the region below it is the whole column. Wrapping
   * everything to the narrow one left the copy under the picture broken to a
   * third of the measure — short lines with a white gutter down the right, or,
   * with justification on, the same short lines stretched across the full width
   * into scattered words.
   *
   * So here each region re-wraps the text that is left, at its own width. The
   * flat list is built to the same per-region capacities `flowLinesThroughRegions`
   * will slice by, so the two agree line for line.
   */
  const wrapBodyText = (
    paragraphText: string,
    style: ArticleTextStyle,
    lineHeight: number,
    hyphenateEnglish = enableEnglishHyphenation,
  ) => {
    const singleWidth = measureWordBasedBodyParagraph({
      text: paragraphText,
      width: textMeasureWidth,
    style,
    enableEnglishHyphenation: hyphenateEnglish,
  });

    if (!wrapPerRegion) {
      return singleWidth;
    }

    const { usableRegions: flowRegions } = partitionRegionsByUsability({
      regions,
      lineHeight,
      usabilityRules,
    });
    const wrappedLines: string[] = [];
    let remaining = paragraphText;

    for (const region of flowRegions) {
      if (!remaining) {
        break;
      }

      // Same formula flowLinesThroughRegions uses, so the slicing lines up.
      const maxLines = lineHeight > 0 ? Math.floor(region.height / lineHeight) : 0;

      if (maxLines <= 0) {
        continue;
      }

      const measured = measureWordBasedBodyParagraph({
        text: remaining,
        width: region.width,
        style,
        enableEnglishHyphenation: hyphenateEnglish,
      });
      wrappedLines.push(...measured.wrappedLines.slice(0, maxLines));
      remaining = measured.wrappedLines.slice(maxLines).join(" ");
    }

    // Anything still left has to be reported, or the overflow handling above
    // would believe the story fits and stop refitting it.
    if (remaining) {
      wrappedLines.push(
        ...measureWordBasedBodyParagraph({ text: remaining, width: textMeasureWidth, style, enableEnglishHyphenation: hyphenateEnglish })
          .wrappedLines,
      );
    }

    return { ...singleWidth, wrappedLines };
  };

  let activeBodyStyle = { ...resolvedBodyStyle };
  let activeLineHeightPx = baseLineHeightPx;
  let activeText = text;

  let metrics = wrapBodyText(activeText, activeBodyStyle, baseLineHeightPx);
  let flow = flowLinesThroughRegions({
    wrappedLines: metrics.wrappedLines,
    lineHeight: activeLineHeightPx,
    regions,
    usabilityRules,
  });

  // Body Fitting Engine v2 — overflow section
  // Step 3: If article overflows, locate next sentence boundary and try to fit it with 7-pass compression.
  if (flow.overflow) {
    const fullText = activeText.trim();
    const visibleLines = flow.visibleLines;
    const cutoffIndex = findCutoffIndexInFullText(visibleLines, fullText);

    if (cutoffIndex >= 0 && !isAlreadyAtSentenceEnd(fullText, cutoffIndex, visibleLines)) {
      const nextBoundary = findNextSentenceBoundary(fullText, cutoffIndex);
      let fittedLayout = false;

      if (nextBoundary !== -1) {
        const nextSentenceText = fullText.slice(0, nextBoundary + 1).trim();

        // Step 4: 7-Pass micro-typography compression (in strict order, full reflow after each pass)
        // Pass 1: Tracking -1%
        // Pass 2: Tracking -2%
        // Pass 3: Tracking -2%, Word spacing -1%
        // Pass 4: Tracking -2%, Word spacing -2%, Line height -1%
        // Pass 5: Tracking -2%, Word spacing -2%, Line height -2%
        // Pass 6: Letter spacing -1%
        // Pass 7: Letter spacing -2%
        const baseLh = resolvedBodyStyle.lineHeight;
        const baseLetterSpacing = resolvedBodyStyle.letterSpacing ?? 0;
        const baseWordSpacing = resolvedBodyStyle.wordSpacing ?? 0;
        const baseFontSize = resolvedBodyStyle.fontSize;

        const pass1Spacing = resolveTypographyAdjustments({ trackingEm: -0.01, fontSize: baseFontSize, renderer: "composition" });
        const pass2Spacing = resolveTypographyAdjustments({ trackingEm: -0.015, fontSize: baseFontSize, renderer: "composition" });
        const passWordSpacing1 = resolveTypographyAdjustments({ wordSpacingEm: 0.02, fontSize: baseFontSize, renderer: "composition" });
        const passWordSpacing2 = resolveTypographyAdjustments({ wordSpacingEm: 0.03, fontSize: baseFontSize, renderer: "composition" });

        const compressionPasses: ArticleTextStyle[] = [
          // Pass 1: Safe Tracking 1
          { ...resolvedBodyStyle, letterSpacing: baseLetterSpacing + pass1Spacing.letterSpacingPx, wordSpacing: baseWordSpacing },
          // Pass 2: Safe Tracking 2
          { ...resolvedBodyStyle, letterSpacing: baseLetterSpacing + pass2Spacing.letterSpacingPx, wordSpacing: baseWordSpacing },
          // Pass 3: Safe Tracking 2, Word spacing compensation 1
          { ...resolvedBodyStyle, letterSpacing: baseLetterSpacing + pass2Spacing.letterSpacingPx, wordSpacing: baseWordSpacing + passWordSpacing1.wordSpacingPx },
          // Pass 4: Safe Tracking 2, Word spacing compensation 2, Line height -1%
          { ...resolvedBodyStyle, letterSpacing: baseLetterSpacing + pass2Spacing.letterSpacingPx, wordSpacing: baseWordSpacing + passWordSpacing2.wordSpacingPx, lineHeight: baseLh * 0.99 },
          // Pass 5: Safe Tracking 2, Word spacing compensation 2, Line height -3% (safe minimum limit)
          { ...resolvedBodyStyle, letterSpacing: baseLetterSpacing + pass2Spacing.letterSpacingPx, wordSpacing: baseWordSpacing + passWordSpacing2.wordSpacingPx, lineHeight: baseLh * Math.max(0.97, bodyTypographySafety.minLineHeightScale) },
          // Pass 6: Letter spacing 1 (standalone)
          { ...resolvedBodyStyle, letterSpacing: baseLetterSpacing + pass1Spacing.letterSpacingPx },
          // Pass 7: Letter spacing 2 (standalone)
          { ...resolvedBodyStyle, letterSpacing: baseLetterSpacing + pass2Spacing.letterSpacingPx },
        ];


        for (const passStyle of compressionPasses) {
          const passLineHeightPx = getBaselineLineAdvance(getLineHeightPx(passStyle), baselineGrid);
          const passMetrics = wrapBodyText(nextSentenceText, passStyle, passLineHeightPx);
          const passFlow = flowLinesThroughRegions({
            wrappedLines: passMetrics.wrappedLines,
            lineHeight: passLineHeightPx,
            regions,
            usabilityRules,
          });

          if (!passFlow.overflow) {
            activeBodyStyle = passStyle;
            activeLineHeightPx = passLineHeightPx;
            activeText = nextSentenceText;
            metrics = passMetrics;
            flow = passFlow;
            fittedLayout = true;
            break;
          }
        }
      }

      if (!fittedLayout) {
        // Step 8: Cannot fit the next full sentence even after compression, so end the
        // story at the last COMPLETE sentence that fits.
        //
        // Earlier revisions trimmed at a clause boundary or, failing that, at whatever word
        // happened to fit. Both cut mid-sentence, and because the text is afterwards passed
        // through ensureTextEndsWithFullStop, a full stop was appended to that fragment —
        // printing a sentence that simply stops early yet looks finished. A newspaper never
        // does that. Rolling back to a real sentence boundary is now unconditional; the
        // blank space it leaves is closed afterwards by the copyfitter (which reflows real
        // text by adjusting tracking) rather than by inventing an ending here.
        const prevSentenceBoundary = findPreviousSentenceBoundary(fullText, cutoffIndex - 1);

        if (prevSentenceBoundary !== -1) {
          const prevSentenceText = fullText.slice(0, prevSentenceBoundary + 1).trim();
          const prevMetrics = wrapBodyText(prevSentenceText, resolvedBodyStyle, baseLineHeightPx);
          const prevFlow = flowLinesThroughRegions({
            wrappedLines: prevMetrics.wrappedLines,
            lineHeight: baseLineHeightPx,
            regions,
            usabilityRules,
          });

          if (!prevFlow.overflow) {
            activeText = prevSentenceText;
            metrics = prevMetrics;
            flow = prevFlow;
          }
        }
      }
    }
  }


  // Ensure active text ends cleanly at a sentence boundary
  if (!flow.overflow) {
    const fullStopText = ensureTextEndsWithFullStop(activeText);
    if (fullStopText !== activeText) {
      const fsMetrics = wrapBodyText(fullStopText, activeBodyStyle, activeLineHeightPx);
      const fsFlow = flowLinesThroughRegions({
        wrappedLines: fsMetrics.wrappedLines,
        lineHeight: activeLineHeightPx,
        regions,
        usabilityRules,
      });
      if (!fsFlow.overflow) {
        activeText = fullStopText;
        metrics = fsMetrics;
        flow = fsFlow;
      }
    }
  }

  /**
   * Youth UPDATE English copyfit — "fill to the last row, end on a full stop".
   *
   * This template is read across: row N of column 1 has to sit on the same
   * rung as row N of column 2. That rules out every VERTICAL lever the
   * generic copyfitter is free to use — leading and body size both move where
   * the rows land — so the only adjustments made here are horizontal
   * (tracking and word spacing, i.e. condensing the copy), and the line
   * advance is pinned to the page grid's own value throughout.
   *
   * The rule, per the desk's own instruction:
   *   - short of the bottom by 1-2 rows -> just pull the next sentence in;
   *     a gap that small usually closes on the text alone.
   *   - short by more than 2 rows -> pull the next sentence in AND condense
   *     horizontally, because the extra copy will not fit at natural width.
   * Either way the box ends on a real sentence, never mid-thought.
   */
  if (nativeBodyJustifyText && !flow.overflow) {
    const fullSourceText = text.trim();
    // Pinned to the grid: whatever the passes above may have done to leading
    // to make the story fit, the rows of this template are set on the page's
    // own rhythm and every candidate below is measured against that one
    // advance. A candidate that would need a different advance is simply not
    // considered, so no box can drift out of step with the column beside it.
    const gridBodyStyle: ArticleTextStyle = {
      ...activeBodyStyle,
      fontSize: resolvedBodyStyle.fontSize,
      lineHeight: resolvedBodyStyle.lineHeight,
    };
    const gridLineHeightPx = getBaselineLineAdvance(getLineHeightPx(gridBodyStyle), baselineGrid);
    const blankRowsOf = (candidate: typeof flow) =>
      Math.max(0, candidate.totalCapacity - candidate.visibleLineCount);

    let bestBlankRows = blankRowsOf(flow);

    if (bestBlankRows >= 1 && fullSourceText) {
      // More than two empty rows is the desk's threshold for condensing; at
      // or under it the copy is pulled in at its natural width first and only
      // tightened if that alone overruns.
      const needsCondensing = bestBlankRows > 2;
      const baseFontSize = gridBodyStyle.fontSize;
      const baseLetterSpacing = gridBodyStyle.letterSpacing ?? 0;
      const baseWordSpacing = gridBodyStyle.wordSpacing ?? 0;
      const trackingPx = (em: number) =>
        resolveTypographyAdjustments({ trackingEm: em, fontSize: baseFontSize, renderer: "composition" })
          .letterSpacingPx;
      const wordSpacingPx = (em: number) =>
        resolveTypographyAdjustments({ wordSpacingEm: em, fontSize: baseFontSize, renderer: "composition" })
          .wordSpacingPx;
      // Natural width first, then progressively condensed. The widest step
      // stays inside the same safe tracking range the generic compression
      // passes use, so the copy reads as condensed type rather than crushed.
      const trackingSteps = needsCondensing
        ? [0, -0.005, -0.01, -0.015, -0.02, -0.025]
        : [0, -0.005, -0.01];
      const wordSteps = needsCondensing ? [0, -0.01, -0.02, -0.03, -0.045] : [0, -0.01, -0.02];
      const condensePasses: ArticleTextStyle[] = [];
      for (const track of trackingSteps) {
        for (const word of wordSteps) {
          condensePasses.push({
            ...gridBodyStyle,
            letterSpacing: baseLetterSpacing + trackingPx(track),
            wordSpacing: baseWordSpacing + wordSpacingPx(word),
          });
        }
      }

      let bestText = activeText;
      let bestStyle = activeBodyStyle;
      let bestMetrics = metrics;
      let bestFlow = flow;

      // Walk forward one sentence at a time. Each candidate is a prefix of
      // the real story ending on a real full stop, so whichever one wins the
      // box still reads as a finished piece of copy.
      let cursor = activeText.trim().length;
      for (let appended = 0; appended < 12 && cursor < fullSourceText.length; appended += 1) {
        const boundary = findNextSentenceBoundary(fullSourceText, cursor);
        if (boundary === -1) {
          break;
        }

        const candidateText = fullSourceText.slice(0, boundary + 1).trim();
        if (candidateText.length <= cursor) {
          break;
        }
        cursor = candidateText.length;

        for (const passStyle of condensePasses) {
          const passLineHeightPx = getBaselineLineAdvance(getLineHeightPx(passStyle), baselineGrid);
          if (Math.abs(passLineHeightPx - gridLineHeightPx) > 0.01) {
            continue;
          }

          const passMetrics = wrapBodyText(candidateText, passStyle, passLineHeightPx);
          const passFlow = flowLinesThroughRegions({
            wrappedLines: passMetrics.wrappedLines,
            lineHeight: passLineHeightPx,
            regions,
            usabilityRules,
          });

          if (passFlow.overflow) {
            continue;
          }

          const passBlankRows = blankRowsOf(passFlow);
          if (passBlankRows < bestBlankRows) {
            bestBlankRows = passBlankRows;
            bestText = candidateText;
            bestStyle = passStyle;
            bestMetrics = passMetrics;
            bestFlow = passFlow;
            // First pass to reach the bottom wins: the list is ordered from
            // natural width outwards, so this is always the least-condensed
            // setting that fills the box.
            if (passBlankRows === 0) {
              break;
            }
          }
        }

        if (bestBlankRows === 0) {
          break;
        }
      }

      if (bestFlow !== flow) {
        activeText = bestText;
        activeBodyStyle = bestStyle;
        activeLineHeightPx = gridLineHeightPx;
        metrics = bestMetrics;
        flow = bestFlow;
      }
    }
  }

  // Final polish pass: use leftover height before accepting visible blank space.
  if (!flow.overflow) {
    const remainingBlankLines = Math.max(0, flow.totalCapacity - flow.visibleLineCount);

    // No upper bound. Any ceiling here means the boxes that need help most get none: once
    // the story is rolled back to its last complete sentence, the discarded tail can easily
    // exceed a dozen rows, and a cap silently skipped this pass for exactly those cases and
    // left the gap on the page. Every shortfall now gets a reflow attempt; the search simply
    // returns the base style unchanged when nothing improves.
    if (remainingBlankLines >= 1) {
      const lastColIndex = flow.regions.findLastIndex((r) => r.assignedLineCount > 0);
      const lastCol = lastColIndex !== -1 ? flow.regions[lastColIndex] : flow.regions[0];
      const remainingHeight = Math.max(0, lastCol.region.height - lastCol.consumedHeight);
      const renderedLineCount = Math.max(1, flow.visibleLineCount);

      const adaptiveRatio = remainingHeight / (renderedLineCount * activeLineHeightPx);

      // Horizontal copyfitting is the primary lever now that measurement is tracking-aware
      // (see measureWordBasedBodyParagraph). Widening tracking reflows real text down into
      // the empty rows at UNCHANGED leading, so the block still matches every other story on
      // the page; stretching leading instead visibly desynchronises one box from its
      // neighbours. Leading is therefore kept as a small last resort and priced accordingly
      // in the score below.
      //
      // These ceilings are expressed in px and are deliberately small. The previous values
      // (tracking up to 30) were dead numbers — measurement ignored tracking entirely, so
      // nothing they produced ever reached the layout. Now that they take effect, 30px of
      // tracking would shatter the text, so they are recalibrated against font size: a
      // 12px body tops out near 0.6px of tracking, roughly 5%, which is invisible per
      // character yet enough to pull a line or two of copy down.
      const fontSizePx = Math.max(1, resolvedBodyStyle.fontSize);
      // Scaled by how much is missing: a one-row shortfall needs a nudge, a whole rolled-back
      // sentence needs real expansion. The wide tier is what lets a box recover the rows lost
      // to ending on a complete sentence instead of mid-thought.
      const wideGap = remainingBlankLines > 5;
      const maxLineHeightBoost = remainingBlankLines <= 2 ? 0.02 : remainingBlankLines <= 5 ? 0.04 : 0.06;
      const maxTrackBoost = fontSizePx * (remainingBlankLines <= 2 ? 0.05 : remainingBlankLines <= 5 ? 0.12 : 0.3);
      const maxWordBoost = fontSizePx * (remainingBlankLines <= 2 ? 0.1 : remainingBlankLines <= 5 ? 0.25 : 0.6);
      const targetLhBoost = Math.min(maxLineHeightBoost, Math.max(0, adaptiveRatio));

      let bestExpandStyle = activeBodyStyle;
      let bestExpandLineHeightPx = activeLineHeightPx;
      let bestExpandMetrics = metrics;
      let bestExpandFlow = flow;
      let bestScore = Infinity;

      const stepsFrom = (max: number, steps = 6) =>
        Array.from(new Set(Array.from({ length: steps + 1 }, (_, i) => (max * i) / steps))).sort((x, y) => y - x);

      // Leading is held at its grid value for the Youth UPDATE English pages:
      // their columns are read across, so a box that opened its leading to
      // close its own gap would drop every row out of line with the column
      // beside it. Those pages close gaps with the horizontal levers below
      // (and with the sentence-appending copyfit above) instead.
      const lineBoosts = nativeBodyJustifyText
        ? [0]
        : Array.from(new Set([...stepsFrom(maxLineHeightBoost, 4), targetLhBoost, 0])).sort((x, y) => y - x);
      const wordBoosts = stepsFrom(maxWordBoost, wideGap ? 10 : 6);
      const trackBoosts = stepsFrom(maxTrackBoost, wideGap ? 10 : 6);

      for (const lhBoost of lineBoosts) {
        for (const wordBoost of wordBoosts) {
          for (const trackBoost of trackBoosts) {
            const candLineHeight = resolvedBodyStyle.lineHeight * (1 + lhBoost);
            const candStyle: ArticleTextStyle = {
              ...activeBodyStyle,
              lineHeight: candLineHeight,
              wordSpacing: (activeBodyStyle.wordSpacing ?? 0) + wordBoost,
              letterSpacing: (activeBodyStyle.letterSpacing ?? 0) + trackBoost,
            };
            const candLineHeightPx = getBaselineLineAdvance(getLineHeightPx(candStyle), baselineGrid);

            const candMetrics = wrapBodyText(activeText, candStyle, candLineHeightPx);
            const candFlow = flowLinesThroughRegions({
              wrappedLines: candMetrics.wrappedLines,
              lineHeight: candLineHeightPx,
              regions,
              usabilityRules,
            });

            if (!candFlow.overflow) {
              const candRemaining = Math.max(0, candFlow.totalCapacity - candFlow.visibleLineCount);
              // Leading changes are priced an order of magnitude above horizontal ones so a
              // solution that closes the gap by reflowing text always beats an equivalent one
              // that spaces lines further apart. Previously all three were weighted equally,
              // which let leading win and left one box's line rhythm out of step with the page.
              const normCost =
                (lhBoost / Math.max(1e-6, maxLineHeightBoost)) * 10 +
                (wordBoost / Math.max(1e-6, maxWordBoost)) +
                (trackBoost / Math.max(1e-6, maxTrackBoost));
              // Filling the box is worth far more than the cost of the adjustment that got
              // there, so leftover rows dominate the score.
              const score = candRemaining * 1000 + normCost;

              if (score < bestScore) {
                bestScore = score;
                bestExpandStyle = candStyle;
                bestExpandLineHeightPx = candLineHeightPx;
                bestExpandMetrics = candMetrics;
                bestExpandFlow = candFlow;
              }
            }
          }
        }
      }

      activeBodyStyle = bestExpandStyle;
      activeLineHeightPx = bestExpandLineHeightPx;
      metrics = bestExpandMetrics;
      flow = bestExpandFlow;
    }
  }

  if (enableEnglishHyphenation && /-\s*$/u.test(flow.visibleLines.at(-1) ?? "")) {
    const cleanEndMetrics = wrapBodyText(activeText, activeBodyStyle, activeLineHeightPx, false);
    const cleanEndFlow = flowLinesThroughRegions({
      wrappedLines: cleanEndMetrics.wrappedLines,
      lineHeight: activeLineHeightPx,
      regions,
      usabilityRules,
    });

    if (!cleanEndFlow.overflow) {
      metrics = cleanEndMetrics;
      flow = cleanEndFlow;
    }
  }

  if (nativeBodyJustifyText && !/[.!?।॥]\s*$/u.test(activeText.trim())) {
    const previousBoundary = findPreviousSentenceBoundary(activeText);
    const candidateText =
      previousBoundary !== -1
        ? activeText.slice(0, previousBoundary + 1).trim()
        : ensureTextEndsWithFullStop(activeText);
    const candidateMetrics = wrapBodyText(candidateText, activeBodyStyle, activeLineHeightPx);
    const candidateFlow = flowLinesThroughRegions({
      wrappedLines: candidateMetrics.wrappedLines,
      lineHeight: activeLineHeightPx,
      regions,
      usabilityRules,
    });

    if (!candidateFlow.overflow) {
      activeText = candidateText;
      metrics = candidateMetrics;
      flow = candidateFlow;
    }
  }


  const bodyWrappedLines = metrics.wrappedLines;
  const bodyParagraphs = splitBodyParagraphs(normContent);
  const paragraphLineStarts = bodyParagraphs.reduce<number[]>((starts, paragraph, paragraphIndex) => {
    if (paragraphIndex === 0) {
      return [0];
    }

    const previousStart = starts[paragraphIndex - 1] ?? 0;
    const previousParagraph = bodyParagraphs[paragraphIndex - 1];
    const previousLineCount = previousParagraph
      ? wrapBodyText(previousParagraph.text, activeBodyStyle, activeLineHeightPx).wrappedLines.length
      : 0;

    return [...starts, previousStart + previousLineCount];
  }, []);
  const getParagraphIndexForSourceLine = (sourceIndex: number) => {
    let paragraphIndex = 0;

    for (let index = 0; index < paragraphLineStarts.length; index += 1) {
      if (sourceIndex >= paragraphLineStarts[index]) {
        paragraphIndex = index;
      }
    }

    return paragraphIndex;
  };
  const getBodyLineIndent = (sourceIndex: number, width: number) => {
    const requestedIndent =
      typographyControls.paragraphIndent +
      (sourceIndex === 0 ? typographyControls.firstLineIndent : 0);

    return Math.min(requestedIndent, Math.max(0, width - 1));
  };
  const linearLineInputs = flow.regions.flatMap((column) =>
    column.lines.map((line) => {
      const edgeInset = Math.min(Math.max(0, bodyColumnEdgeInsetPt), Math.max(0, line.width / 2 - 1));
      const indent = getBodyLineIndent(line.sourceIndex, line.width);
      const nextParagraphStart = paragraphLineStarts.find((start) => start > line.sourceIndex) ?? bodyWrappedLines.length;
      const isParagraphLastLine = line.sourceIndex >= nextParagraphStart - 1;
      const isProfessionalJustification = typographyControls.bodyJustifyEngineMode === "newspaper";

      return {
        text: line.text,
        width: Math.max(1, line.width - edgeInset * 2 - indent),
        justify:
          activeBodyStyle.align === "justify" &&
          (isProfessionalJustification
            ? !isParagraphLastLine
            : typographyControls.bodyJustifyMode === "justify-all-lines" || !isParagraphLastLine),
      };
    }),
  );
  const bodyComposition = composeStoryBody({
    lines: linearLineInputs,
    style: activeBodyStyle,
    justifyMode: typographyControls.bodyJustifyMode,
    engineMode: typographyControls.bodyJustifyEngineMode,
    totalCapacity: flow.totalCapacity,
    visibleLineCount: flow.visibleLineCount,
    remainingLineCount: flow.remainingLineCount,
    lineHeight: activeLineHeightPx,
    hyphenationJustificationSettings: getHyphenationJustificationSettings(typographyControls),
  });
  let bodyCompositionLineIndex = 0;
  const columns: ArticleLayoutBodyColumn[] = flow.regions.map((column) => ({
    id: column.id,
    x: column.region.x,
    y: column.region.y,
    width: column.region.width,
    height: column.region.height,
    columnIndex: column.region.columnIndex,
    capacity: column.maxLines,
    assignedLineCount: column.assignedLineCount,
    remainingCapacity: column.remainingCapacity,
    lines: column.lines.map((line) => {
      const edgeInset = Math.min(Math.max(0, bodyColumnEdgeInsetPt), Math.max(0, line.width / 2 - 1));
      const indent =
        typographyControls.paragraphIndent +
        (line.sourceIndex === 0 ? typographyControls.firstLineIndent : 0);
      const clampedIndent = Math.min(indent, Math.max(0, line.width - edgeInset * 2 - 1));
      const lineTextX = line.x + edgeInset + clampedIndent;
      const lineTextWidth = Math.max(1, line.width - edgeInset * 2 - clampedIndent);
      const composedLine = bodyComposition.lines[bodyCompositionLineIndex++];
      const renderText = composedLine?.text ?? line.text;
      const contentWidth = composedLine?.renderedWidth ?? measureRenderedTextWidth(renderText, activeBodyStyle);
      const lineX = getAlignedX(lineTextX, lineTextWidth, contentWidth, activeBodyStyle.align);
      const bodyMeasuredFontStyle = activeBodyStyle.fontStyle ?? "normal";
      const bodyMeasuredFontString = createCanvasFontString(
        activeBodyStyle.fontFamily,
        activeBodyStyle.fontSize,
        bodyMeasuredFontStyle,
      );

      return {
        x: lineTextX,
        y: line.y,
        width: lineTextWidth,
        height: line.height,
        text: renderText,
        // `composedLine.justified` is the hyphenation/justification engine's
        // report of whether IT spread the gaps itself. On the Youth UPDATE
        // English pages it comes back false (that engine only spreads gaps in
        // "newspaper" mode), and this field is what BOTH renderers gate their
        // justified drawing on -- so taking it at face value there set the
        // whole page ragged. What those pages want is simply the rule the line
        // input already carries: justify every line except the one that ends a
        // paragraph, and let the renderer spread the gaps to the measure.
        justify: (bodyCompositionLineIndex === flow.visibleLineCount)
          ? false
          : nativeBodyJustifyText
            ? (linearLineInputs[bodyCompositionLineIndex - 1]?.justify ?? false)
            : (composedLine?.justified ?? linearLineInputs[bodyCompositionLineIndex - 1]?.justify),
        paragraphIndex: getParagraphIndexForSourceLine(line.sourceIndex),
        style: {
          ...activeBodyStyle,
          wrap: "none",
        },
        segments: suppressBodySegments
          ? undefined
          : composedLine?.words.map((word) => ({
            x: lineX + word.x,
            y: line.y,
            width: word.width,
            height: line.height,
          text: word.text,
          style: {
            ...activeBodyStyle,
            letterSpacing: 0,
            wrap: "none",
          },
          measuredWidth: word.width,
          renderedWidth: word.width,
          scaleX: 1,
          constrainWidth: !constrainBodySegments ? false : true,
          measuredFontFamily: activeBodyStyle.fontFamily,
          measuredFontSize: activeBodyStyle.fontSize,
          measuredFontStyle: bodyMeasuredFontStyle,
          measuredFontWeight: bodyMeasuredFontStyle,
          measuredFontString: bodyMeasuredFontString,
          renderedFontFamily: activeBodyStyle.fontFamily,
          renderedFontSize: activeBodyStyle.fontSize,
          renderedFontStyle: bodyMeasuredFontStyle,
          renderedFontWeight: bodyMeasuredFontStyle,
          renderedFontVariant: "normal",
        })),
      };
    }),
    nativeJustifyText: nativeBodyJustifyText,
    lineCount: column.lines.length,
    overflow: flow.overflow && column.id === flow.regions[flow.regions.length - 1]?.id,
  }));

  // Stretches line spacing to close leftover whitespace when a story's real
  // content runs shorter than its box's capacity (real papers "feather" a
  // short story's leading rather than leave a visible gap at the bottom).
  // This used to skip single-column (narrow) boxes on the assumption that
  // they're always supplied with enough real body text (1200-1300 words) to
  // fill naturally — but that assumption doesn't always hold (API articles
  // can be shorter, or the sentence-fitting fallback above can legitimately
  // trim a long sentence back), and when it doesn't, single-column boxes had
  // zero rescue mechanism and rendered with a bare gap at the bottom. The
  // engine itself (justifyColumn) already no-ops safely on a single line, so
  // there's no special case needed here — every box, regardless of column
  // count, gets the same chance to close its own leftover space.
  //
  // baselineGridSize was missing here — without it, justifyColumnsVertically
  // stretches each story's line advance independently to whatever value
  // closes ITS OWN gap, with no shared grid to snap to. Two side-by-side
  // stories with different amounts of leftover whitespace ended up with
  // different (unsnapped) line advances, so their body text rows drifted
  // out of horizontal alignment row by row — the page-wide baseline grid
  // that's supposed to keep every column's text lining up was only being
  // honored for the ORIGINAL (unstretched) layout, not the justified one.
  // Passing it restores that: the engine now only accepts a stretched
  // advance that's still a whole multiple of the shared grid unit, so
  // adjacent stories keep lining up row-for-row exactly as before, while
  // still closing bottom whitespace within that constraint.
  //
  // Deliberately a narrow safety net, not the main mechanism. Gap closing is done above by
  // the copyfitter, which reflows real text horizontally and leaves leading untouched so
  // every story on the page keeps the same line rhythm. This pass previously ran at 0.6,
  // wide enough to feather one column's leading far out of step with its neighbours — the
  // visible inconsistency that trades one defect for another. At 0.08 it only absorbs the
  // sub-line remainder the copyfitter cannot reach, which stays imperceptible.
  const justifiedColumns = justifyColumnsVertically({
    columns,
    maxAdjustmentRatio: verticalJustificationMaxAdjustmentRatio,
    baselineGridSize: baselineGrid.gridSize,
  }).columns;


  return {
    columns: justifiedColumns,
    flow,
    compositionDiagnostics: bodyComposition.diagnostics,
  };
};


const getColumnStartX = (columnIndex: number, columnWidth: number, columnGap: number) =>
  columnIndex * (columnWidth + columnGap);

const getReadableColumnCount = (
  requestedColumnCount: number,
  contentWidth: number,
  columnGap: number,
  minColumnWidth = MIN_BODY_COLUMN_WIDTH,
) => {
  for (let columnCount = requestedColumnCount; columnCount > 1; columnCount -= 1) {
    const columnWidth = (contentWidth - columnGap * Math.max(0, columnCount - 1)) / columnCount;

    if (columnWidth >= minColumnWidth) {
      return columnCount;
    }
  }

  return 1;
};

const getReadableImageColumnSpan = (
  requestedSpan: number,
  columnCount: number,
  columnWidth: number,
  minColumnWidth = MIN_BODY_COLUMN_WIDTH,
) => {
  if (columnCount <= 1 || columnWidth >= minColumnWidth) {
    return requestedSpan;
  }

  const readableColumnCount = Math.floor(columnCount * columnWidth / minColumnWidth);
  const maxImageSpan = Math.max(1, columnCount - Math.max(1, readableColumnCount));

  return clamp(requestedSpan, 1, maxImageSpan);
};

const shiftRegionX = (
  region: ReturnType<typeof generateTextRegions>["regions"][number],
  offsetX: number,
) => ({
  ...region,
  x: region.x + offsetX,
});

const rangesOverlap = (startA: number, endA: number, startB: number, endB: number) =>
  Math.max(startA, startB) < Math.min(endA, endB);

const rectsOverlap = (
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
) =>
  rangesOverlap(first.x, first.x + first.width, second.x, second.x + second.width) &&
  rangesOverlap(first.y, first.y + first.height, second.y, second.y + second.height);

const isTopSideImageAlignment = (alignment: StoryImageSettings["imageAlignment"]) =>
  alignment === "top-left" ||
  alignment === "top-right" ||
  alignment === "left" ||
  alignment === "right";

const getFitSettingsKey = (settings: EditorialFitCandidateSettings) =>
  JSON.stringify(settings);

const getTextArea = (columns: ArticleLayoutBodyColumn[]) =>
  columns.reduce(
    (area, column) =>
      area + column.lines.reduce((lineArea, line) => lineArea + line.width * line.height, 0),
    0,
  );

const createFitMetricsFromComposition = ({
  articleBox,
  density,
  textArea,
  imageArea,
  remainingLineCount,
  totalLineCount,
  overflow,
}: {
  articleBox: ArticleBoxModel;
  density: ReturnType<typeof calculateEditorialDensity>;
  textArea: number;
  imageArea: number;
  remainingLineCount: number;
  totalLineCount: number;
  overflow: boolean;
}) =>
  createEditorialFitMetrics({
    storyArea: Math.max(1, articleBox.width * articleBox.height),
    usedArea: Math.max(1, articleBox.width * articleBox.height) * (density.storyDensityPercent / 100),
    textArea,
    imageArea,
    overflow,
    overflowPercentage:
      totalLineCount > 0 ? Math.min(100, (remainingLineCount / totalLineCount) * 100) : overflow ? 100 : 0,
  });

const applyEditorialFitResult = (layout: ArticleLayout, fitResult: EditorialFitResult): ArticleLayout => ({
  ...layout,
  metrics: {
    ...layout.metrics,
    editorialFitScore: fitResult.editorialFitScore,
    fillPercentage: fitResult.fillPercentage,
    whitespacePercentage: fitResult.whitespacePercentage,
    overflowPercentage: fitResult.overflowPercentage,
    fitStatus: fitResult.fitStatus,
  },
});

function composeArticleBoxPass(
  articleBox: ArticleBoxModel &
    Partial<StoryImageSettings> &
    Partial<StoryTypographySettings> & { priority?: StoryPriority; contentLanguage?: "hindi" | "english" },
  articleData: ArticleData,
  compositionSettings: ArticleCompositionSettings = defaultCompositionSettings,
  fitOverrides: ArticleFitOverrides = {},
): ArticleLayout {
  const settings = {
    ...defaultCompositionSettings,
    ...compositionSettings,
  };
  const typographyControls = normalizeUniversalTypographyControls(articleData.typography);
  const containerStyles = normalizeContainerStyles(articleData.containerStyles);
  /**
   * The house style this page carries, for the rules front and inside pages
   * share — headline budget, box padding, body type, baseline alignment, the
   * trimmed leading, the narrow-box title.
   *
   * Deliberately NOT used for the bare `settings.frontPageStyle` presence
   * checks further down: those switch on geometry measured for the front page's
   * own bands, and an inside page must not inherit it.
   */
  const houseStyle = settings.frontPageStyle ?? settings.insidePageStyle;
  const isSingleColumnHeadlineBox = articleBox.width / PAGE_CONTENT_WIDTH_PT < 0.22;
  // A one-column measure cannot hold a full headline in two lines, so a narrow
  // box used to trim its headline to a word budget. That cuts mid-phrase — the
  // headline reads as unfinished — and the words it dropped leave their space
  // empty underneath. The record already carries a shorter line written to
  // stand on its own: the subheadline. On a front page a narrow box titles
  // itself with that instead, and takes no truncation at all.
  const narrowTitleRule = houseStyle?.narrowBoxTitle;
  const narrowTitleText =
    isSingleColumnHeadlineBox && narrowTitleRule?.useSubheadline
      ? stripHeadingTerminator(richTextToPlainText(articleData.subheadline)).trim()
      : "";
  const usesNarrowTitle = narrowTitleText.length > 0;
  // The headline block renders from rich text and falls back to this source, so
  // it has to move with the plain text or the box would print its old headline.
  const headlineRichSource = usesNarrowTitle ? articleData.subheadline : articleData.headline;
  const headlineText = usesNarrowTitle
    ? narrowTitleText
    : isSingleColumnHeadlineBox
      ? truncateHeadlineWords(
          stripHeadingTerminator(richTextToPlainText(articleData.headline)),
          SINGLE_COLUMN_HEADLINE_MAX_WORDS,
        )
      : stripHeadingTerminator(richTextToPlainText(articleData.headline));
  // Promoted to the title, it must not also print as a subheadline underneath.
  const subheadlineText = usesNarrowTitle
    ? ""
    : stripHeadingTerminator(richTextToPlainText(articleData.subheadline));
  const captionText = richTextToPlainText(articleData.caption.text);
  const bodyRichContent = stripLeadingBodySeparatorsFromRichText(articleData.body);
  const bodyText = richTextToPlainText(bodyRichContent);

  const isPureAd =
    (articleBox as any).role === "advertisement" ||
    (!headlineText.trim() && !bodyText.trim() && Boolean((articleData as any).imageUrl));

  if (isPureAd) {
    const sourceWidth = articleBox.sourceWidth ?? (articleData as any).sourceWidth ?? articleBox.width;
    const sourceHeight = articleBox.sourceHeight ?? (articleData as any).sourceHeight ?? articleBox.height;

    const adImage: ArticleLayoutRegion = {
      x: 0,
      y: 0,
      width: articleBox.width,
      height: articleBox.height,
      fill: "transparent",
      shapeType: "rectangle",
      shapePoints: [],
      crop: defaultStoryImageSettings.imageCrop,
      coverCropX: 0,
      coverCropY: 0,
      coverCropWidth: sourceWidth > 0 ? sourceWidth : articleBox.width,
      coverCropHeight: sourceHeight > 0 ? sourceHeight : articleBox.height,
      sourceAspectRatio: sourceWidth > 0 && sourceHeight > 0 ? sourceWidth / sourceHeight : undefined,
      lines: [],
    };

    const emptyTextBlock: ArticleLayoutTextBlock = {
      x: 0,
      y: 0,
      width: articleBox.width,
      height: 0,
      text: "",
      wrappedLines: [],
      lineCount: 0,
      overflow: false,
      lineBoxes: [],
      style: {
        fontFamily: "Arial",
        fontSize: 10,
        lineHeight: 1,
        fill: "#000000",
      },
    };

    const emptyByline: BylineLayout = {
      x: 0,
      y: 0,
      width: articleBox.width,
      height: 0,
      text: "",
      wrappedLines: [],
      lineCount: 0,
      overflow: false,
      lineBoxes: [],
      style: {
        fontFamily: "Arial",
        fontSize: 8,
        lineHeight: 1,
        fill: "#000000",
      },
    };

    return {
      kicker: null,
      strap: null,
      headline: emptyTextBlock,
      subheadlineBackground: null,
      subheadline: emptyTextBlock,
      byline: emptyByline,
      image: adImage,
      factBox: null,
      pullQuote: null,
      caption: null,
      body: {
        x: 0,
        y: 0,
        width: articleBox.width,
        height: articleBox.height,
        text: "",
        wrappedLines: [],
        lineCount: 0,
        remainingLineCount: 0,
        overflow: false,
        dropCap: null,
        columns: [],
      },
      debugTextRegions: [],
      containerStyles,
      metrics: {
        headlineLines: 0,
        bodyLines: 0,
        visibleLines: 0,
        hiddenLines: 0,
        overflow: false,
        editorialFitScore: 100,
        fillPercentage: 100,
        whitespacePercentage: 0,
        overflowPercentage: 0,
        fitStatus: "PERFECT",
        storyDensityPercent: 100,
        internalWhitespacePercent: 0,
        bodyFillPercent: 100,
        unusedVerticalSpace: 0,
        bodyWhitespacePercent: 0,
        averageSpacing: 0,
        minimumSpacing: 0,
        maximumSpacing: 0,
        spacingVariance: 0,
        compositionPasses: 1,
        wordsMoved: 0,
        bodyCompositionBadnessScore: 0,
        bodyFinalLineWidths: [],
        paragraphCandidatesTested: 0,
        selectedParagraphCandidate: 0 as any,
        riverScore: 0,
        widowScore: 0,
        orphanScore: 0,
        paragraphQuality: 100,
        hjParagraphQuality: 100,
        hjGrayValue: 0,
        hjGrayBalanceScore: 100,
        hjAverageTracking: 0,
        hjTrackingVariance: 0,
        hjGapVariance: 0,
        hjHyphenCount: 0,
        hjOptimizationPasses: 0,
        hjRejectedCandidates: 0,
        hjAcceptedCandidates: 1,
        hjParagraphCandidates: 1,
        hjBeamWidth: 1,
        hjCacheHit: false,
        hjOptimizationTimeMs: 0,
        hjCompositionTimeMs: 0,
        hjFinalBadness: 0,
        storyScore: 100,
        paragraphScores: [],
        storyFillPercent: 100,
        bottomWhitespace: 0,
        storyCompositionIterations: 1,
        storyOptimizationPasses: 1,
        averageParagraphScore: 100,
        bestCandidateScore: 100,
        rejectedCandidates: 0,
        finalStoryQuality: 100,
        opticalGlyphCount: 0,
        leftHangingCount: 0,
        rightHangingCount: 0,
        averageHangPercent: 0,
        storyWidth: articleBox.width,
        headlineMeasureWidth: articleBox.width,
        renderedHeadlineWidth: 0,
        headlineFillPercent: 0,
        headlineFillLine1Percent: 0,
        headlineFillLine2Percent: 0,
        selectedHeadlineCandidateScore: 100 as any,
        selectedHeadlineCandidateType: "exact-match" as any,
        selectedHeadlineCandidateReason: "Ad artwork",
        headlineTopCandidateScores: [100 as any],
        headlineOriginal: "",
        headlineGeneratedCandidates: [],
        headlineChosenCandidate: undefined as any,
        headlineRenderedLines: [],
        headlineRenderedLine1: "",
        headlineRenderedLine2: "",
        headlineRenderedLine3: "",
        headlineLineWidths: [],
        headlineLineAvailableWidth: articleBox.width,
        headlineLineOverflowPx: [],
        headlineMaxOverflowPx: 0,
        headlineAverageFillPercent: 0,
        headlineUnusedPixels: 0,
        imageHeight: articleBox.height,
        imageCoveragePercent: 100,
        textCoveragePercent: 0,
        generatedRegions: 0,
        consumedRegions: 0,
        remainingText: 0,
        usedColumns: 0,
        unusedColumns: 0,
        regionCount: 0,
        usableRegions: 0,
        discardedRegions: 0,
        columnCount: 1,
      },
    };
  }

  const hierarchyStyle = settings.storyHierarchyStyle;
  const priority = articleBox.priority ?? "secondary";
  const typographyDefaults = getDefaultStoryTypographySettings(priority);
  const typographySettings: StoryTypographySettings = {
    headlineFontSize: articleBox.headlineFontSize ?? typographyDefaults.headlineFontSize,
    subheadlineFontSize: articleBox.subheadlineFontSize ?? typographyDefaults.subheadlineFontSize,
    bodyFontSize: fitOverrides.bodyFontSize ?? articleBox.bodyFontSize ?? typographyDefaults.bodyFontSize,
    headlineLineHeight: articleBox.headlineLineHeight ?? typographyDefaults.headlineLineHeight,
    subheadlineLineHeight:
      articleBox.subheadlineLineHeight ?? typographyDefaults.subheadlineLineHeight,
    bodyLineHeight: fitOverrides.bodyLineHeight ?? articleBox.bodyLineHeight ?? typographyDefaults.bodyLineHeight,
    headlineLineHeightMode: articleBox.headlineLineHeightMode ?? typographyDefaults.headlineLineHeightMode,
    subheadlineLineHeightMode:
      articleBox.subheadlineLineHeightMode ?? typographyDefaults.subheadlineLineHeightMode,
    bodyLineHeightMode: articleBox.bodyLineHeightMode ?? typographyDefaults.bodyLineHeightMode,
    headlineLeadingValue: articleBox.headlineLeadingValue ?? typographyDefaults.headlineLeadingValue,
    subheadlineLeadingValue: articleBox.subheadlineLeadingValue ?? typographyDefaults.subheadlineLeadingValue,
    bodyLeadingValue: articleBox.bodyLeadingValue ?? typographyDefaults.bodyLeadingValue,
    headlineWeight: articleBox.headlineWeight ?? typographyDefaults.headlineWeight,
    subheadlineWeight: articleBox.subheadlineWeight ?? typographyDefaults.subheadlineWeight,
    autoFitHeadline: articleBox.autoFitHeadline ?? typographyDefaults.autoFitHeadline,
    autoBalanceHeadline: articleBox.autoBalanceHeadline ?? typographyDefaults.autoBalanceHeadline,
    enableHyphenation: articleBox.enableHyphenation ?? typographyDefaults.enableHyphenation,
    forceFullWidthHeadlines:
      articleBox.forceFullWidthHeadlines ?? typographyDefaults.forceFullWidthHeadlines,
    headlineLayoutMode: articleBox.headlineLayoutMode ?? typographyDefaults.headlineLayoutMode,
  };
  const imageSettings: StoryImageSettings = {
    imageEnabled: articleBox.imageEnabled ?? defaultStoryImageSettings.imageEnabled,
    imageAlignment: articleBox.imageAlignment ?? defaultStoryImageSettings.imageAlignment,
    imageColumnSpan: articleBox.imageColumnSpan ?? defaultStoryImageSettings.imageColumnSpan,
    imageHeight: fitOverrides.imageHeight ?? articleBox.imageHeight ?? defaultStoryImageSettings.imageHeight,
    imageHeightMode: fitOverrides.imageHeightMode ?? articleBox.imageHeightMode ?? defaultStoryImageSettings.imageHeightMode,
    imageHeightPreset:
      fitOverrides.imageHeightPreset ?? articleBox.imageHeightPreset ?? defaultStoryImageSettings.imageHeightPreset,
    imageHeightProtection:
      articleBox.imageHeightProtection ?? defaultStoryImageSettings.imageHeightProtection,
    autoSizeImage: articleBox.autoSizeImage ?? defaultStoryImageSettings.autoSizeImage,
    imageWrapMode: articleBox.imageWrapMode ?? defaultStoryImageSettings.imageWrapMode,
    imageShapeType: articleBox.imageShapeType ?? defaultStoryImageSettings.imageShapeType,
    imageShapePoints: articleBox.imageShapePoints ?? defaultStoryImageSettings.imageShapePoints,
    imageCrop: articleBox.imageCrop ?? defaultStoryImageSettings.imageCrop,
    wrapContourPoints: articleBox.wrapContourPoints ?? defaultStoryImageSettings.wrapContourPoints,
    wrapTextOffset: articleBox.wrapTextOffset ?? defaultStoryImageSettings.wrapTextOffset,
  };
  const isEightColumnTemplate = settings.editorialTemplateId?.includes("EightColumn") ?? false;
  const isCliffInsideSixColumnTemplate = settings.editorialTemplateId?.includes("CliffInsideSixColumn") ?? false;
  const usesCompactInsideImageRules = isEightColumnTemplate || isCliffInsideSixColumnTemplate;
  const frameColumnSpan = Number((articleBox as { columnSpan?: number }).columnSpan);
  if (usesCompactInsideImageRules && imageSettings.imageEnabled) {
    imageSettings.imageColumnSpan = Math.max(1, Math.min(2, imageSettings.imageColumnSpan));
    imageSettings.imageHeight = Math.max(
      imageSettings.imageHeight,
      articleBox.priority === "lead" ? 156 : articleBox.priority === "major" ? 132 : 112,
    );
    imageSettings.imageHeightMode = "fixed";
    imageSettings.autoSizeImage = false;
    if (isCliffInsideSixColumnTemplate) {
      imageSettings.imageAlignment = "top-right";
      imageSettings.imageWrapMode = "newspaper";
    }
  }

  // If the article box is too short, disable the image to prevent the first column from being entirely consumed by the headline and image.
  if (articleBox.height < 220) {
    imageSettings.imageEnabled = false;
  }

  const hasImage = imageSettings.imageEnabled;
  const showSubheadline = hierarchyStyle?.showSubheadline ?? true;
  // An article composes in box-local coordinates. Phasing its grid by the box's
  // own offset within the page grid is what makes body lines in adjacent columns
  // land on the same rungs; without it each box starts a fresh grid at its own
  // top edge and neighbouring columns drift apart. Front-page-only — see
// `FrontPageArticleStyle.alignBodyToPageBaselineGrid`.
  const baselineGrid = createBaselineGrid(
    settings.baselineGridSize,
    houseStyle?.alignBodyToPageBaselineGrid
      ? getPageAlignedPhase(articleBox.y, settings.baselineGridSize)
      : 0,
  );

  const templateStoryNumber = (articleBox as any).templateStoryNumber;
  const editorialStoryNumber = Number(templateStoryNumber);
  const editorialTemplateId = settings.editorialTemplateId;
  const usesLegacyEditorialFurniture =
    Boolean(settings.editorialPageStyle) &&
    (!editorialTemplateId ||
      editorialTemplateId === "CliffEditorial8A" ||
      editorialTemplateId === "CliffEditorial9A");

  const isLeaderRail = usesLegacyEditorialFurniture && editorialStoryNumber === 1 && ((articleBox as any).columnCount ?? 1) <= 1;
  if (isLeaderRail) {
    articleData.kicker = {
      ...articleData.kicker,
      enabled: true,
      text: { spans: [{ text: "सम्पादकीय", style: { fontWeight: "bold", fontStyle: "italic" } }] } as any,
    };
  }
  // Vichar-Manthan's two right-rail/left-column boxes each print under a
  // fixed, recurring section name -- "सुनी सुनाई" and "बात मुद्दे की" -- the
  // same kind of fixed masthead label isLeaderRail sets above for "सम्पादकीय",
  // not text derived from whatever the story's own headline happens to be.
  const isVicharManthanBandKicker =
    editorialTemplateId === "AkhandVicharManthan6A" && (editorialStoryNumber === 3 || editorialStoryNumber === 4);
  if (isVicharManthanBandKicker) {
    articleData.kicker = {
      ...articleData.kicker,
      enabled: true,
      text: {
        spans: [{ text: editorialStoryNumber === 3 ? "सुनी सुनाई" : "बात मुद्दे की", style: { fontWeight: "bold" } }],
      } as any,
    };
  }

  const kickerWidthRatio = clamp(articleBox.width / PAGE_CONTENT_WIDTH_PT, 0, 1);
  // The badge treatment (pill straddling a rounded outline) is limited to one
  // story per page, so it is opted in during page generation rather than being
  // inferred from geometry alone — every narrow box qualifying on width put
  // several competing badges on the same page. Geometry is still required, so
  // a flagged story that later gets resized out of the narrow range drops it.
  // The editorial page's Health Desk box (story slot 6) reuses this badge
  // system's green-bordered look but must read as a full-width section
  // banner, not a compact pill -- excluded from isNarrowKicker entirely so
  // it flows through the same dynamic-size/full-width/wrap path every
  // regular (non-badge) kicker uses below. Patching size/width onto an
  // already-built badge layout post hoc (an earlier version of this) left
  // the text's own pre-measured segment widths out of sync with its new
  // font size, silently dropping words instead of just rendering bigger.
  const isHealthDeskKicker = Boolean(usesLegacyEditorialFurniture && editorialStoryNumber === 6);
  const isNarrowKicker =
    !isLeaderRail &&
    !isHealthDeskKicker &&
    !isVicharManthanBandKicker &&
    ((articleData.badgeKickerEnabled ?? false) && kickerWidthRatio < 0.45 && articleBox.height < 800);
  // Extra inset on top of ARTICLE_PADDING.left/right for narrow badge boxes.
  // Kept so their total inset stays 12pt (8 + 4) — unchanged from before the
  // base horizontal padding existed, so the badge layout is unaffected.
  const horizontalPadding = isNarrowKicker ? 4 : 0;
  // A front page composes on its own padding — small, but enough that no line of
  // text lands on a box edge or a tint outline.
  const boxPadding = houseStyle?.padding ?? ARTICLE_PADDING;
  const inset = boxPadding.left + horizontalPadding;
  const topInset = boxPadding.top;
  const bottomInset = boxPadding.bottom;
  const requestedEndBreathingSpace =
    settings.articleEndBreathingSpaceEnabled === false
      ? 0
      : Math.max(0, settings.articleEndBreathingSpaceMm ?? DEFAULT_ARTICLE_END_BREATHING_SPACE_MM) * MM_TO_POINTS;
  const allowEndBreathingSpace =
    requestedEndBreathingSpace > 0 &&
    priority !== "brief" &&
    priority !== "filler" &&
    articleBox.height >= 180;
  const contentWidth = Math.max(1, articleBox.width - boxPadding.left - boxPadding.right - horizontalPadding * 2);
  const headlineMeasureWidth = Math.max(1, contentWidth * HEADLINE_MEASUREMENT_SAFETY_RATIO);
  const storyColumnSpan = articleData.columnCount ?? Math.max(1, Math.round(articleBox.width / 130));
  const isWideBottomFrontPackage =
    Boolean(settings.frontPageStyle) &&
    priority === "major" &&
    articleBox.width / PAGE_CONTENT_WIDTH_PT >= 0.72 &&
    articleBox.y > DEFAULT_PAGE_MASTER.height * 72 * 0.55;
  const isFrontPageTwoColumnBox =
    Boolean(settings.frontPageStyle) && storyColumnSpan === 2 && !isWideBottomFrontPackage;
  const roundedFrameColumnSpan = Number.isFinite(frameColumnSpan)
    ? Math.max(1, Math.round(frameColumnSpan))
    : storyColumnSpan;
  const tightTwoColumnBylineToBodyGap =
    Boolean(settings.tightTwoColumnBylineToBodyGap) &&
    isEightColumnTemplate &&
    roundedFrameColumnSpan <= 2;
  const tightWideEightColumnBylineToBodyGap =
    isEightColumnTemplate && roundedFrameColumnSpan >= 6;
  const isFullWidthEightColumnBox =
    isEightColumnTemplate && roundedFrameColumnSpan >= 8;
  const isFrontPageThreeColumnBox =
    Boolean(settings.frontPageStyle) && storyColumnSpan === 3 && !isWideBottomFrontPackage;
  const isLowerFrontPagePackage =
    Boolean(settings.frontPageStyle) && articleBox.y > DEFAULT_PAGE_MASTER.height * 72 * 0.38;
  const isBottomFrontThreeColumnPackage =
    isFrontPageThreeColumnBox && articleBox.y > DEFAULT_PAGE_MASTER.height * 72 * 0.6;
  const importanceScore = calculateHeadlineImportanceScore({
    priority,
    width: articleBox.width,
    height: articleBox.height,
    columnSpan: storyColumnSpan,
    hasImage,
    imageArea: imageSettings.imageEnabled ? articleBox.width * (imageSettings.imageHeight ?? 100) : 0,
    positionX: articleBox.x,
    positionY: articleBox.y,
  });
  const hierarchyLevel = determineHeadlineHierarchyLevel(importanceScore, priority, storyColumnSpan);
  const hierarchyConfig = HEADLINE_HIERARCHY_LEVELS[hierarchyLevel];
  const targetHeadlineFontSize = interpolateHeadlineFontSize(
    hierarchyConfig,
    headlineText,
    headlineMeasureWidth,
    storyColumnSpan,
  );

  // Single-column boxes are the tightest case: a headline used to shrink
  // toward the 8pt floor just to fit ~143pt of width, reading far too small
  // next to its own body text. Raising the font floor to 12pt fixed that, but
  // letting it wrap up to 5 lines to accommodate the bigger floor produced a
  // 4-row headline that reads as unprofessional at this width. Capped back to
  // 2 lines — same limit as a brief — so it stays a proper headline shape; the
  // hard geometry validation below still scales down anything that genuinely
  // cannot fit at the 12pt floor within 2 lines, so this can't cause overflow.
  // Reuses the same width check the headline text truncation above already
  // made, so the two can never drift out of sync with each other.
  const isSingleColumnBox = isSingleColumnHeadlineBox;
  const hasExplicitHeadlineMaxLines =
    settings.headlineMaxLines !== undefined || houseStyle?.headlineMaxLines !== undefined;
  const isShortEightColumnNarrowBox =
    isEightColumnTemplate &&
    roundedFrameColumnSpan >= 2 &&
    roundedFrameColumnSpan <= 3 &&
    articleBox.height < 260;
  const headlineMaxLines =
    settings.headlineMaxLines ??
    (isFullWidthEightColumnBox
      ? 1
      : isWideBottomFrontPackage
      ? 2
      : isShortEightColumnNarrowBox
      ? 2
      : priority === "brief" || priority === "filler" || isSingleColumnBox || isFrontPageTwoColumnBox
      ? 2
      // A page may state its own ceiling. Only the inside page does: the branch
      // below gives a "secondary" story three lines, and on an inside page's
      // deeper boxes that is exactly what produced three-line headlines where
      // the front page — which caps its two-column boxes above — shows two.
      : (houseStyle?.headlineMaxLines ?? (priority === "secondary" ? 3 : 4)));
  // Single-column boxes land in the narrowest hierarchy tiers (brief/small,
  // capped at 16-22pt) purely because their importance score is starved by
  // width — not because the story deserves a small headline. Boosting the
  // tier's own ceiling (and target) here, rather than just raising the floor,
  // is what actually lets the headline grow instead of hitting the same low
  // cap the floor was quietly bumping against. Started at 25%, then bumped a
  // further 20% on top (1.25 x 1.2 = 1.5) per explicit follow-up feedback.
  const singleColumnHeadlineBoost = isSingleColumnBox ? 1.5 : 1;
  // A tall narrow box (e.g. a digest column spanning several rows) can trip
  // the documented importance-score bug where height/image area alone pushes
  // it into "hero" tier (max 72pt) regardless of its actual column width —
  // multiplying THAT by the single-column boost produced a 100pt+ runaway.
  // A single-column box is never wide enough to justify hero-scale display
  // type no matter what tier it lands in, so its boosted ceiling is hard-capped
  // here rather than trusting the (separately, deliberately unfixed) tier math.
  const SINGLE_COLUMN_HEADLINE_ABSOLUTE_CAP = 34;
  // Mutable: when a front-page headline budget is in force the ceiling is lowered
  // after the first fit (below), so every later growth pass clamps to the budget
  // instead of undoing it.
  // A one-column title has to set edge to edge on every line — a short line in
  // so narrow a measure leaves an obvious notch of white at the right, and the
  // space the type does not use collects as the gap under the headline. Setting
  // it full width closes the notch; letting it grow past the tier's normal
  // ceiling is what lets the width-fill pass below actually reach the edge, and
  // the extra depth it takes is depth that was sitting empty anyway.
  const narrowTitleFill = Boolean(
    usesNarrowTitle && houseStyle?.narrowBoxTitle.fillMeasure,
  );
  const headlineForceFullWidth =
    typographySettings.forceFullWidthHeadlines || narrowTitleFill || isWideBottomFrontPackage;
  let headlineMaxFontSize = clamp(
    targetHeadlineFontSize * singleColumnHeadlineBoost,
    hierarchyConfig.minFontSize,
    isSingleColumnBox
      ? Math.min(hierarchyConfig.maxFontSize * singleColumnHeadlineBoost, SINGLE_COLUMN_HEADLINE_ABSOLUTE_CAP)
      : isFrontPageThreeColumnBox
        ? Math.min(hierarchyConfig.maxFontSize, 25)
        : isFrontPageTwoColumnBox
          ? Math.min(hierarchyConfig.maxFontSize, 22)
          : hierarchyConfig.maxFontSize,
  );
  const headlineMinFontSize = isShortEightColumnNarrowBox || isFullWidthEightColumnBox ? 6.5 : isSingleColumnBox ? 12 : 8;
  const subheadlineFontSize = clamp(
    Math.round(headlineMaxFontSize * hierarchyConfig.subheadlineSizeRatio),
    10,
    30,
  );
  const bodySize = clamp(typographySettings.bodyFontSize, 8, 16);
  // English body copy justifies with visibly wide, uneven word-gaps in the
  // Devanagari-tuned default sans (no hyphenation, wide Latin metrics) --
  // swap to a proper English newspaper serif instead. Gated strictly on
  // contentLanguage being "english" (set only by the newswire import path
  // for stories actually fetched in English), so Hindi/Devanagari body copy
  // -- on Youth UPDATE's own front page included -- is completely unaffected.
  const bodyFontFamily =
    articleBox.contentLanguage === "english"
      ? settings.youthUpdateEnglishBodyFontFamily ?? ENGLISH_NEWSPAPER_BODY_FONT_FAMILY
      : undefined;
  const editorialStyles = createEditorialStyles({
    priority,
    headlineSize: headlineMaxFontSize,
    subheadlineSize: subheadlineFontSize,
    bodySize,
    headlineLineHeight: hierarchyConfig.lineHeight,
    subheadlineLineHeight: clamp(typographySettings.subheadlineLineHeight, 0.8, 1.4),
    bodyLineHeight: clamp(typographySettings.bodyLineHeight, 1.25, 1.6),
    headlineWeight: hierarchyConfig.headlineWeight,
    subheadlineWeight: typographySettings.subheadlineWeight,
    bodyFontFamily,
  });
  const isEditorialBox2 =
    usesLegacyEditorialFurniture && editorialStoryNumber === 2;
  const headlineStyle = {
    ...editorialStyles.headline,
    ...(isWideBottomFrontPackage
      ? { lineHeight: 1.12 }
      : isFrontPageTwoColumnBox
        ? { lineHeight: 1.2 }
        : isFrontPageThreeColumnBox
          ? { lineHeight: 1.14 }
          : {}),
    ...(isEditorialBox2
      ? {
          fontFamily: getNewspaperFontStack("editorialHeadline"),
          fontStyle: "400",
          lineHeight: Math.min(editorialStyles.headline.lineHeight, 1.02),
        }
      : {}),
    // Left, not centred, and deliberately so despite centring being what closes
    // the ragged notch on a one-column title.
    //
    // Centring renders correctly on canvas and wrong in the PDF. The export
    // recomputes the centring offset in `PrintPDFEngine.getTextX` as
    // `line.width - font.widthOfTextAtSize(line.text, size)`, and pdf-lib
    // measures Devanagari by summing individual glyph advances with no conjunct
    // substitution — so shaped text measures WIDER than it prints, the offset
    // clamps to zero, and the headline sets flush left. In the leftmost column
    // that runs it off the page.
    //
    // Fixing this properly means not re-measuring in the PDF at all: carry the
    // composer's canvas-measured text width on `ArticleLayoutTextLine` and have
    // `getTextX` use it. Until then left is the only alignment both renderers
    // agree on.
    align: typographyControls.headlineAlignment,
    letterSpacing: resolveCharacterSpacing({
      tracking: typographyControls.headlineTracking,
      letterSpacing: hierarchyConfig.letterSpacing,
      fontSize: editorialStyles.headline.fontSize,
    }),
  };
  // A front page sets every column of body copy in one size and one leading, so
  // that snapping to the shared grid actually lands the baselines together —
  // see `FrontPageArticleStyle.bodyType`. Inside pages keep the per-priority
  // body sizes the hierarchy hands out.
  const pinnedBodyType = houseStyle?.bodyType;
  const bodyFontSize = pinnedBodyType?.fontSizePt ?? editorialStyles.body.fontSize;
  const resolvedBodyStyle = {
    ...editorialStyles.body,
    ...(pinnedBodyType
      ? {
          fontSize: pinnedBodyType.fontSizePt,
          lineHeight: isLowerFrontPagePackage ? 11 / pinnedBodyType.fontSizePt : pinnedBodyType.lineHeight,
        }
      : {}),
    align: typographyControls.bodyAlignment,
    letterSpacing: resolveCharacterSpacing({
      tracking: typographyControls.bodyTracking,
      letterSpacing: typographyControls.bodyLetterSpacing,
      fontSize: bodyFontSize,
    }),
    wordSpacing: typographyControls.wordSpacing,
  };
  let headlineMetrics = fitHeadline({
    text: headlineText,
    width: headlineMeasureWidth,
    maxLines: headlineMaxLines,
    fontFamily: headlineStyle.fontFamily,
    fontStyle: headlineStyle.fontStyle,
    minFontSize: headlineMinFontSize,
    maxFontSize: headlineMaxFontSize,
    lineHeight: headlineStyle.lineHeight,
    script: "mixed",
    autoBalance: typographySettings.autoBalanceHeadline,
    enableHyphenation: typographySettings.enableHyphenation,
    forceFullWidth: headlineForceFullWidth,
    headlineLayoutMode: typographySettings.headlineLayoutMode,
  });

  // ── Front page: budget the headline block against the box's own height ───────
  // The hierarchy sizes a headline from the box's importance and never asks how
  // much room the body still needs, so a mid-band strip ends up with display type
  // over two lines of copy. Clamp against the *fitted* line count rather than
  // headlineMaxLines, so a short headline is still allowed to run large — only a
  // block that genuinely eats its box gets scaled back.
  const headlineHeightBudget = houseStyle?.headlineHeightBudget;
  if (headlineHeightBudget && headlineHeightBudget > 0) {
    const budgetHeight = articleBox.height * headlineHeightBudget;

    for (let attempt = 0; attempt < 3 && headlineMetrics.consumedHeight > budgetHeight; attempt += 1) {
      const lineCount = Math.max(1, headlineMetrics.lineCount);
      // Half-point steps keep the size on the same grid the rest of the fitter uses.
      const budgetedSize =
        Math.floor((budgetHeight / (lineCount * headlineStyle.lineHeight)) * 2) / 2;
      const nextMaxFontSize = Math.max(headlineMinFontSize, budgetedSize);

      if (nextMaxFontSize >= headlineMetrics.fontSize) {
        // Already at the floor for this line count — a further pass cannot help.
        break;
      }

      // Lower the ceiling too, so the width-fill and short-headline growth passes
      // further down cannot grow the block back out of its budget.
      headlineMaxFontSize = Math.min(headlineMaxFontSize, nextMaxFontSize);
      headlineMetrics = fitHeadline({
        text: headlineText,
        width: headlineMeasureWidth,
        // Allow one extra line: at the smaller size the headline may need it, and
        // a taller-but-smaller block is still inside the budget. A page that
        // states its own ceiling does not get the extra line — the whole point
        // there is that the ceiling is hard.
        maxLines:
          isFrontPageTwoColumnBox || hasExplicitHeadlineMaxLines || isShortEightColumnNarrowBox || isFullWidthEightColumnBox
            ? headlineMaxLines
            : headlineMaxLines + 1,
        fontFamily: headlineStyle.fontFamily,
        fontStyle: headlineStyle.fontStyle,
        minFontSize: headlineMinFontSize,
        maxFontSize: nextMaxFontSize,
        lineHeight: headlineStyle.lineHeight,
        script: "mixed",
        autoBalance: typographySettings.autoBalanceHeadline,
        enableHyphenation: typographySettings.enableHyphenation,
        forceFullWidth: headlineForceFullWidth,
        headlineLayoutMode: typographySettings.headlineLayoutMode,
      });
    }
  }

  // HARD GEOMETRY CONSTRAINT VALIDATION: Guarantee headline is 100% contained within contentWidth
  const maxMeasuredWidth = Math.max(1, ...headlineMetrics.lines.map((l) => l.width));
  if (headlineMetrics.overflow || maxMeasuredWidth > contentWidth + 0.5) {
    // A long headline in a narrow (single-column) box can fail to fit within
    // headlineMaxLines even at the floor size — this used to jump straight to
    // shrinking the font, with an 8pt hard floor that landed the headline at
    // roughly the byline's own 8.2pt size. Try re-wrapping the SAME font size
    // across one extra line first: the text usually just needed more room,
    // not a smaller size, and this keeps the headline legible next to the byline.
    const extraLineFit = balanceHeadline(
      {
        headline: headlineText,
        availableWidth: contentWidth,
        fontFamily: headlineStyle.fontFamily,
        fontSize: headlineMetrics.fontSize,
        fontStyle: headlineStyle.fontStyle,
        maxLines: isFrontPageTwoColumnBox || hasExplicitHeadlineMaxLines || isShortEightColumnNarrowBox || isFullWidthEightColumnBox ? headlineMaxLines : headlineMaxLines + 1,
        autoBalance: typographySettings.autoBalanceHeadline,
        enableHyphenation: typographySettings.enableHyphenation,
        forceFullWidth: headlineForceFullWidth,
        headlineLayoutMode: typographySettings.headlineLayoutMode,
      },
      undefined,
    );
    const extraLineResult = createHeadlineFitResult(extraLineFit, headlineMetrics.fontSize, headlineStyle.lineHeight);
    const extraLineMaxWidth = Math.max(1, ...extraLineResult.lines.map((l) => l.width));

    if (!extraLineResult.overflow && extraLineMaxWidth <= contentWidth + 0.5) {
      headlineMetrics = extraLineResult;
    } else {
      const scaleFactor = Math.min(1.0, (contentWidth - 1) / maxMeasuredWidth);
      // Floor matches headlineMinFontSize (not a flat 8) so even this
      // last-resort shrink stays comfortably above the 8.2pt byline.
      const safeSize = Math.max(headlineMinFontSize, Math.floor(headlineMetrics.fontSize * scaleFactor * 2) / 2);
      const validatedFit = balanceHeadline(
        {
          headline: headlineText,
          availableWidth: contentWidth,
          fontFamily: headlineStyle.fontFamily,
          fontSize: safeSize,
          fontStyle: headlineStyle.fontStyle,
          maxLines: isFrontPageTwoColumnBox || hasExplicitHeadlineMaxLines || isShortEightColumnNarrowBox || isFullWidthEightColumnBox ? headlineMaxLines : headlineMaxLines + 1,
          autoBalance: typographySettings.autoBalanceHeadline,
          enableHyphenation: typographySettings.enableHyphenation,
          forceFullWidth: headlineForceFullWidth,
          headlineLayoutMode: typographySettings.headlineLayoutMode,
        },
        undefined,
      );
      headlineMetrics = createHeadlineFitResult(validatedFit, safeSize, headlineStyle.lineHeight);
    }
  }

  // ── Space-Boosted Headline ──────────────────────────────────────────────────
  // When the article box is vertically generous and the headline fits on just
  // 1 line (or comfortably under headlineMaxLines - 1), attempt a larger font
  // so the headline fills the available visual weight, as in real Indian
  // broadsheets (TOI, Dainik Bhaskar etc.).
  {
    // Estimate rough headline area: top third of article minus body/image space
    const estimatedHeadlineAreaHeight = articleBox.height * 0.35;
    const currentHeadlineHeight = headlineMetrics.consumedHeight;
    // Boost only if there's real spare room (was 60%, now a stricter 45%)
    // and not already close to max — this boost was growing headlines past
    // what their box could actually afford, spilling into the article below.
    const hasRoom = currentHeadlineHeight < estimatedHeadlineAreaHeight * 0.45;
    const belowMax = headlineMetrics.fontSize < headlineMaxFontSize * 0.85;
    const isSmallStory = priority === "brief" || priority === "filler";
    if (hasRoom && belowMax && !isSmallStory && !headlineMetrics.overflow) {
      // Try fitting with a larger max size – up to 1.12× current size but still ≤ max
      const boostedMax = Math.min(
        hierarchyConfig.maxFontSize,
        Math.round(headlineMetrics.fontSize * 1.12),
      );
      const boostedFit = fitHeadline({
        text: headlineText,
        width: headlineMeasureWidth,
        maxLines: headlineMaxLines,
        fontFamily: headlineStyle.fontFamily,
        fontStyle: headlineStyle.fontStyle,
        minFontSize: headlineMetrics.fontSize,
        maxFontSize: boostedMax,
        lineHeight: headlineStyle.lineHeight,
        script: "mixed",
        autoBalance: typographySettings.autoBalanceHeadline,
        enableHyphenation: typographySettings.enableHyphenation,
        forceFullWidth: headlineForceFullWidth,
        headlineLayoutMode: typographySettings.headlineLayoutMode,
      });
      // Accept the boost only if it didn't cause overflow, is genuinely
      // larger, AND still leaves the box enough room for everything below
      // the headline (subheadline/byline/image/body) — a hard ceiling
      // independent of the rough area estimate above, so a boosted
      // headline can never eat so much height that it pushes into the
      // next article box.
      const fitsBoxBudget = boostedFit.consumedHeight <= articleBox.height * 0.4;
      if (!boostedFit.overflow && boostedFit.fontSize > headlineMetrics.fontSize && fitsBoxBudget) {
        headlineMetrics = boostedFit;
      }
    }
  }

  // ── Kicker Minimum Headline Floor ────────────────────────────────────────
  // The kicker (secondary heading) must never render larger than the
  // headline. Rather than force the kicker down to an awkwardly small size
  // on small headlines, grow the headline itself up to the kicker's own
  // base size first — but only when that genuinely fits without overflow.
  // If it doesn't fit, the headline is left alone and the kicker gets
  // capped down to match it instead (handled later, where the kicker is sized).
  {
    const hasKickerText =
      articleData.kicker.enabled && richTextToPlainText(articleData.kicker.text).trim().length > 0;
    if (hasKickerText && headlineMetrics.fontSize < KICKER_BASE_FONT_SIZE) {
      const kickerFloorFit = fitHeadline({
        text: headlineText,
        width: headlineMeasureWidth,
        maxLines: headlineMaxLines,
        fontFamily: headlineStyle.fontFamily,
        fontStyle: headlineStyle.fontStyle,
        minFontSize: KICKER_BASE_FONT_SIZE,
        maxFontSize: KICKER_BASE_FONT_SIZE,
        lineHeight: headlineStyle.lineHeight,
        script: "mixed",
        autoBalance: typographySettings.autoBalanceHeadline,
        enableHyphenation: typographySettings.enableHyphenation,
        forceFullWidth: headlineForceFullWidth,
        headlineLayoutMode: typographySettings.headlineLayoutMode,
      });
      if (!kickerFloorFit.overflow) {
        headlineMetrics = kickerFloorFit;
      }
    }
  }
  const candidateBullets =(articleData.summaryBullets?.length ? articleData.summaryBullets : (subheadlineText ? [subheadlineText] : [])).map(s => s.trim()).filter(Boolean);
  const isCompactStoryOrNoStrip = !showSubheadline || priority !== "lead" || articleBox.height <= 450 || (articleData.columnCount ?? 3) <= 2 || (articleData.subheadlineBanner && articleData.subheadlineBanner.mode === "none");
  const isTooLow = articleBox.height < 220;
  // A box 3-6 columns wide but short in height has no real room for a 2-line
  // bullet summary — image + headline + both bullets + byline alone need
  // roughly 320pt (confirmed by direct measurement: real boxes at ~230-255pt
  // read as visibly cramped with bullets shown, while a ~510pt box of the
  // same width class is comfortably fine). priority ("brief"/"filler" vs
  // "major"/"lead") turned out NOT to track this — real generated boxes this
  // size and this short were priority "major", not "brief"/"filler" — so the
  // box's own geometry is checked directly instead of trusting priority as a
  // proxy. Column span uses PAGE_COLUMN_WIDTH_PT (the real ~145pt page
  // column), not articleData.columnCount, which for real generated stories
  // holds the body's internal text-column count instead — an unrelated
  // number (see the image-caption fix earlier in this file for the same
  // mixup).
  const LOW_HEIGHT_BULLET_THRESHOLD_PT = 320;
  const boxColumnSpan = Math.round(articleBox.width / PAGE_COLUMN_WIDTH_PT);
  const isLowHeightWideBox =
    boxColumnSpan >= 3 && boxColumnSpan <= 6 && articleBox.height < LOW_HEIGHT_BULLET_THRESHOLD_PT;
  const shouldShowInlineSubheadline = !settings.suppressInlineSubheadings && !isTooLow && !isLowHeightWideBox && !fitOverrides.suppressInlineSubheadline && (articleData.inlineSubheadingEnabled ?? false) && isCompactStoryOrNoStrip && candidateBullets.length > 0;
  const hasSubheadlineText = !isTooLow && !shouldShowInlineSubheadline && showSubheadline && subheadlineText.trim().length > 0;

  // ── Headline Trim for Oversized Non-Lead Headlines ────────────────────────
  // calculateHeadlineImportanceScore (HeadlineHierarchyEngine) weights column
  // width + image area heavily enough that a wide (4-6 col) "major"/"secondary"
  // story with a photo can score above the "hero" tier's own threshold on
  // width/image alone — landing it in the same 48-72pt range as the page's
  // actual lead, with or without a subheadline banner underneath. Trimming
  // only the with-banner case (below) missed banner-less wide stories, which
  // is why a headline like this could still render oversized. Generalised
  // here to trim any oversized non-lead headline, protecting only the one
  // legitimate case that deserves full size: the true lead story when it has
  // no banner. (When the true lead *does* have a banner, it's still correctly
  // trimmed — the pairing itself reads as too heavy regardless of priority.)
  // Reduction strengthened from 18% (0.82x) to 30% (0.70x) — the lighter cut
  // still left wide non-lead headlines (e.g. a 4-6 col "major" story) reading
  // as oversized, since they start from the same 48-72pt hero-tier range as
  // the actual lead per the scoring issue described above.
  const HEADLINE_BANNER_TRIM_THRESHOLD = 34;
  const isTrueLeadWithoutBanner = priority === "lead" && !hasSubheadlineText;
  if (!isTrueLeadWithoutBanner && headlineMetrics.fontSize > HEADLINE_BANNER_TRIM_THRESHOLD) {
    const trimmedTarget = Math.max(
      HEADLINE_BANNER_TRIM_THRESHOLD,
      Math.round(headlineMetrics.fontSize * 0.7),
    );
    const trimmedFit = fitHeadline({
      text: headlineText,
      width: headlineMeasureWidth,
      maxLines: headlineMaxLines,
      fontFamily: headlineStyle.fontFamily,
      fontStyle: headlineStyle.fontStyle,
      minFontSize: trimmedTarget,
      maxFontSize: trimmedTarget,
      lineHeight: headlineStyle.lineHeight,
      script: "mixed",
      autoBalance: typographySettings.autoBalanceHeadline,
      enableHyphenation: typographySettings.enableHyphenation,
      forceFullWidth: headlineForceFullWidth,
      headlineLayoutMode: typographySettings.headlineLayoutMode,
    });
    if (!trimmedFit.overflow) {
      headlineMetrics = trimmedFit;
    }
  }

  // ── Headline Width-Fill ─────────────────────────────────────────────────
  // A short 1-2 line headline can end well before the box's right edge,
  // reading as a stray ragged line instead of a proper headline. Checking
  // only the widest line missed the common ragged case where line 1 falls
  // short but line 2 already reaches the edge (the widest-line check saw
  // "already full" and never tried to fix line 1). Scan a range of font
  // sizes up to this tier's own max — never beyond it — and keep whichever
  // one maximizes the SHORTEST line's width (the one that needs help),
  // while still rejecting any candidate that overflows or wraps to an
  // extra line. Only 1-2 line headlines are adjusted; longer ones already
  // use most of the width by the time they wrap that many times.
  if (!headlineMetrics.overflow && headlineMetrics.lines.length > 0 && headlineMetrics.lines.length <= 2) {
    const widthFillTarget = headlineMeasureWidth * 0.96;
    const originalShortestLine = Math.min(...headlineMetrics.lines.map((line) => line.width));

    if (originalShortestLine < widthFillTarget && headlineMetrics.fontSize < headlineMaxFontSize) {
      const originalLineCount = headlineMetrics.lines.length;
      const stepCount = 16;
      const stepSize = (headlineMaxFontSize - headlineMetrics.fontSize) / stepCount;
      let bestResult = headlineMetrics;
      let bestShortestLine = originalShortestLine;

      for (let step = 1; step <= stepCount; step += 1) {
        const candidateSize = headlineMetrics.fontSize + stepSize * step;
        const candidate = fitHeadline({
          text: headlineText,
          width: headlineMeasureWidth,
          maxLines: originalLineCount,
          fontFamily: headlineStyle.fontFamily,
          fontStyle: headlineStyle.fontStyle,
          minFontSize: candidateSize,
          maxFontSize: candidateSize,
          lineHeight: headlineStyle.lineHeight,
          script: "mixed",
          autoBalance: typographySettings.autoBalanceHeadline,
          enableHyphenation: typographySettings.enableHyphenation,
          forceFullWidth: headlineForceFullWidth,
          headlineLayoutMode: typographySettings.headlineLayoutMode,
        });

        if (candidate.overflow || candidate.lines.length > originalLineCount) {
          continue;
        }

        const candidateWidest = Math.max(1, ...candidate.lines.map((line) => line.width));
        if (candidateWidest > headlineMeasureWidth) {
          continue;
        }

        const candidateShortest = Math.min(...candidate.lines.map((line) => line.width));
        if (candidateShortest > bestShortestLine) {
          bestShortestLine = candidateShortest;
          bestResult = candidate;
        }
      }

      headlineMetrics = bestResult;
    }
  }

  if (isWideBottomFrontPackage && headlineMetrics.lines.length > 1) {
    const singleLineFit = fitHeadline({
      text: headlineText,
      width: headlineMeasureWidth,
      maxLines: 1,
      fontFamily: headlineStyle.fontFamily,
      fontStyle: headlineStyle.fontStyle,
      minFontSize: 16,
      maxFontSize: Math.min(headlineMetrics.fontSize, headlineMaxFontSize),
      lineHeight: headlineStyle.lineHeight,
      script: "mixed",
      autoBalance: typographySettings.autoBalanceHeadline,
      enableHyphenation: typographySettings.enableHyphenation,
      forceFullWidth: false,
      headlineLayoutMode: typographySettings.headlineLayoutMode,
    });

    if (!singleLineFit.overflow && singleLineFit.lineCount === 1) {
      headlineMetrics = singleLineFit;
    }
  }

  const baseHeadlineLetterSpacing = resolveCharacterSpacing({
    tracking: typographyControls.headlineTracking,
    letterSpacing: typographyControls.headlineLetterSpacing,
    fontSize: headlineMetrics.fontSize,
  });

  // Whether a 1-column-wide *image* should skip its caption is decided later,
  // once the image's own actual rendered width is known (see hasCaption
  // near the `caption =` assignment below) — articleData.columnCount isn't
  // usable here despite the name: for real generated stories it holds the
  // body copy's internal text-column count (1 or 2), not the box's page
  // width in columns, so a box that's plenty wide but sets its body in a
  // single text column would have wrongly lost its caption if gated here.
  const hasCaptionText = hasImage && articleData.caption.enabled && captionText.trim().length > 0;
  const spacing = createEditorialSpacing({
    priority,
    headlineSize: headlineMetrics.fontSize,
    hasSubheadline: hasSubheadlineText,
    hasImage,
    hasCaption: hasCaptionText,
    productionView: settings.productionView,
  });
  const resolvedHeadlineStyle = {
    ...headlineStyle,
    fontSize: headlineMetrics.fontSize,
    letterSpacing: baseHeadlineLetterSpacing,
  };
  // Kicker word budget is banded by how much of the page width this story
  // actually occupies (its real, final rendered width) — roughly one band
  // per page column. Word count does the width-filling work (no font-size
  // growth-to-fit — that's what caused overflow/clipping earlier); padding
  // and the kicker-to-headline gap are handled separately below, scaled
  // proportionally to the kicker's/headline's own font size so they never
  // look disproportionately large next to a small narrow-column headline.
  // kickerWidthRatio and isNarrowKicker are now calculated near the top of the function
  // 1-2 column boxes (ratio < 0.45) never get a regular kicker — only the
  // single page-designated badge story (isNarrowKicker) is allowed a kicker
  // at that width.
  const kickerAllowedForNonBadge = kickerWidthRatio >= 0.45; // ~3+ columns
  const kickerPlainText = richTextToPlainText(articleData.kicker.text).trim();
  // The live API's kicker text is "लेबल, क्षेत्र : सामग्री" — a space before
  // the colon. Splitting on whitespace turned that colon into its own
  // standalone "word", which previously wasted a fixed word-count budget.
  // That budget is gone now — the kicker always carries the FULL secondary
  // headline (label + everything after the colon); font-size growth/shrink
  // below is what fits it to the target width, not truncating words, so a
  // kicker never reads as an incomplete sentence.
  const kickerColonSplitIndex = kickerPlainText.indexOf(":");
  const kickerLabelWords = kickerColonSplitIndex >= 0 ? kickerPlainText.slice(0, kickerColonSplitIndex + 1).trim() : "";
  const kickerContentAfterLabel = kickerColonSplitIndex >= 0 ? kickerPlainText.slice(kickerColonSplitIndex + 1).trim() : kickerPlainText;
  const kickerContentWords = kickerContentAfterLabel.split(/\s+/u).filter(Boolean);
  // The one badge-styled kicker on the page is a compact pill, not a full
  // kicker with a punchline — by design it shows only the label up to the
  // colon, with the colon itself dropped (a bare ":" hanging at the end of a
  // small pill reads oddly). Every other (non-badge) kicker keeps the full
  // label plus the full content that follows the colon.
  const kickerLabelWithoutColon = kickerColonSplitIndex >= 0
    ? kickerPlainText.slice(0, kickerColonSplitIndex).trim()
    : kickerPlainText;
  // A 1-2 column box gets NO kicker at all (not even the bare label) unless
  // it's the page's one designated badge -- or the Health Desk box, which
  // is excluded from isNarrowKicker (see its definition above) so it can
  // use the wide/full-width kicker layout, but still only ever wants its
  // bare desk label ("हेल्थ डेस्क"), the same simple text the narrow badge
  // itself would show, not a full "label: content" kicker sentence.
  let trimmedKickerWords = isLeaderRail
    ? [kickerPlainText].filter(Boolean)
    : isNarrowKicker || isHealthDeskKicker || isVicharManthanBandKicker
      ? [kickerLabelWithoutColon].filter(Boolean)
      : kickerAllowedForNonBadge
        ? [kickerLabelWords, ...kickerContentWords].filter(Boolean)
        : [];
  // Never let the kicker outgrow the headline — but let it grow all the way
  // up to the headline's own size (not just 80% of it) so a short kicker can
  // actually reach the target width instead of hitting an artificially low
  // ceiling and leaving white space on the right well before it gets there.
  const kickerSizeCeiling = isHealthDeskKicker || isVicharManthanBandKicker
    ? 19
    : isNarrowKicker
      ? 12
      : isWideBottomFrontPackage
        ? Math.min(14, Math.max(8, headlineMetrics.fontSize * 0.7))
        : isFrontPageThreeColumnBox
          ? Math.max(8, headlineMetrics.fontSize * 0.7)
          : Math.max(9, headlineMetrics.fontSize * 0.7);
  const baseKickerFontSize = Math.min(
    isHealthDeskKicker || isVicharManthanBandKicker ? 17 : isNarrowKicker ? 11 : isWideBottomFrontPackage ? 13 : KICKER_BASE_FONT_SIZE,
    kickerSizeCeiling,
  );
  // Only the badge pill carries its own padding — a non-badge kicker has no
  // background to pad and should start flush at the box's left inset (the
  // same x the headline itself starts at) and span the same width, not sit
  // inset from it.
  const kickerPadding = isNarrowKicker
    ? Math.max(0, articleData.kicker.style.padding)
    : isWideBottomFrontPackage
      ? 4
      : 0;
  const kickerMeasureWidth = Math.max(1, contentWidth - kickerPadding * 2);
  // A non-badge kicker targets the headline's own first-line rendered width
  // (headlineMetrics is already final at this point, past the
  // trim/boost/geometry-validation passes above) rather than a fixed
  // fraction of the box's raw content width, so its right edge actually
  // lines up with where the headline's first row ends — not whichever line
  // happens to be widest further down a multi-line headline. That width was
  // already safely fitted within the box, so it only needs a small 5%
  // cushion; the badge uses the box's raw width with the larger 15% cushion
  // instead — Devanagari conjuncts/matras can render a hair wider than the
  // text measurer predicts, and that margin keeps a "fits" verdict from
  // turning into an actual overflow once truly drawn.
  const headlineRenderedWidth = Math.max(1, headlineMetrics.lines[0]?.width ?? headlineMeasureWidth);
  const kickerTargetWidth = isNarrowKicker ? kickerMeasureWidth : kickerMeasureWidth;
  const kickerFitWidth = kickerTargetWidth * (isNarrowKicker ? 0.85 : isFrontPageThreeColumnBox ? 0.98 : 0.95);
  const KICKER_MIN_FONT_SIZE = isFrontPageThreeColumnBox ? 5 : 7;
  let trimmedKickerText = trimmedKickerWords.join(" ");
  // Computed here (not after fitting, where this split used to live) so
  // kickerRichText — and measureKickerWidthAt below, which now measures that
  // exact object — can both be built before fitting runs.
  const kickerColonIndex = trimmedKickerText.indexOf(":");
  const kickerLabelPart =
    kickerColonIndex >= 0
      ? trimmedKickerText.slice(0, kickerColonIndex + 1)
      : trimmedKickerWords.slice(0, Math.min(2, trimmedKickerWords.length)).join(" ");
  const kickerRestPart = trimmedKickerText.slice(kickerLabelPart.length).trim();
  const kickerAccentColor = articleData.headlineColor;
  // The kicker's label — everything up through the colon ("विशेष रिपोर्ट:")
  // — is always this red, on every page, regardless of the story's own
  // headline colour. Only the label gets it; whatever follows the colon
  // stays the standard kicker grey. articleData.kickerLabelColor overrides
  // this per-story — undefined everywhere except stories that opt in (Youth
  // UPDATE's cyan theme), so every other page keeps the red exactly as before.
  const KICKER_LABEL_RED = articleData.kickerLabelColor ?? "#b42318";
  // For narrow columns (1-2 cols), we use a solid pill style ("border").
  // For wider ones, we use the standard two-toned transparent style. Built
  // here (before fitting, not after) so measureKickerWidthAt below can
  // measure this exact object rather than a separately-rebuilt one.
  const kickerRichText = isNarrowKicker
    ? { spans: [{ text: trimmedKickerText, color: "#ffffff" }] }
    : isWideBottomFrontPackage
      ? { spans: [{ text: trimmedKickerText, color: "#ffffff" }] }
      : {
          spans: [
            { text: kickerLabelPart, color: KICKER_LABEL_RED },
            ...(kickerRestPart ? [{ text: ` ${kickerRestPart}`, color: "#555555" }] : []),
          ],
        };
  // measureArticleParagraph takes a materially different code path for
  // coloured rich text (measureRichTextParagraph) than for a single plain
  // span (measureParagraph) — hasRichTextStyling gates between them, and
  // every branch of kickerRichText above sets a colour key, so the render
  // always takes the rich path. Measuring a separately-rebuilt plain string
  // here (as this used to) let the two diverge: a kicker reported as "fits"
  // at its computed size was still clipped mid-sentence once actually
  // drawn — confirmed live against real kicker text, safety margin and all.
  // Measuring this same kickerRichText object removes the mismatch instead
  // of padding around it.
  // measureArticleParagraph routes coloured kickerRichText through
  // measureRichTextParagraph, which always wraps to the given `width`
  // regardless of the `wrap: "none"` style hint below (that field is never
  // read by the rich-text wrapper — it only applies on the plain-text path).
  // Passing kickerMeasureWidth here silently wrapped long kicker sentences
  // and reported only the first wrapped line's width as "consumedWidth" —
  // always <= the target width by construction, so the fit check never
  // failed and the binary search kept climbing toward the size ceiling
  // instead of shrinking. The render step then wrapped the same oversized
  // text and dropped every line past the first (maxLines: 1) — the actual
  // mechanism behind kicker sentences reading as cut off mid-word. Measuring
  // against an effectively unlimited width instead reports the sentence's
  // true single-line size, so the fit check (against kickerFitWidth,
  // separately) means what it says.
  const KICKER_MEASURE_UNWRAPPED_WIDTH = 100000;
  const measureKickerWidthAt = (_text: string, fontSize: number) =>
    measureArticleParagraph({
      content: kickerRichText,
      text: trimmedKickerText,
      width: KICKER_MEASURE_UNWRAPPED_WIDTH,
      style: {
        align: "left",
        fill: "#111111",
        fontFamily: getNewspaperFontStack("sans"),
        fontSize,
        fontStyle: String(articleData.kicker.style.fontWeight),
        letterSpacing: 0,
        lineHeight: 1,
        wrap: "none",
      },
      maxLines: 1,
    }).consumedWidth;

  let kickerFontSize = baseKickerFontSize;
  const fitSingleLineKickerSize = (text: string) => {
    let low = KICKER_MIN_FONT_SIZE;
    while (low > 3.5 && measureKickerWidthAt(text, low) > kickerFitWidth) {
      low = Math.max(3.5, low - 0.5);
    }

    let high = kickerSizeCeiling;
    let best = low;

    for (let pass = 0; pass < 16; pass += 1) {
      const mid = (low + high) / 2;
      if (measureKickerWidthAt(text, mid) <= kickerFitWidth) {
        best = mid;
        low = mid;
      } else {
        high = mid;
      }
    }

    return best;
  };

  if (trimmedKickerText) {
    if (isNarrowKicker) {
      // Badge pill: unchanged — starts at its fixed base size and only ever
      // shrinks (then, as a last resort, drops words) if it doesn't fit.
      kickerFontSize = fitSingleLineKickerSize(trimmedKickerText);
    } else if (isWideBottomFrontPackage) {
      kickerFontSize = fitSingleLineKickerSize(trimmedKickerText);
    } else {
      // Non-badge kicker: dynamically size to fill the same span the
      // headline uses — grow toward kickerSizeCeiling when the text is short
      // of that width, shrink toward the floor when it's too long for one
      // line. Binary search over font size (not a "start big, only shrink"
      // pass) so a short kicker actually grows instead of sitting small.
      // kickerFitWidth already carries a 15% safety margin against
      // Devanagari measurement-vs-render drift, so growth can't reintroduce
      // the overflow this same margin was added to prevent.
      kickerFontSize = fitSingleLineKickerSize(trimmedKickerText);
    }
  }

  // fitSingleLineKickerSize shrinks down to a 3.5pt floor, but a long enough
  // kicker sentence in a narrow box still won't fit even there — it used to
  // just overflow the box (per an earlier "never truncate the text itself"
  // requirement), which in practice reads as the sentence getting visually
  // cut off wherever the frame's own clip rect lands. Horizontal condensing
  // closes that gap: squeeze the whole fitted line via the same per-line
  // scaleX transform the headline's edge-fill already uses (see
  // fillHeadlineLineEdges above, which does the mirror-image stretch), so
  // the complete sentence always lands inside kickerFitWidth instead of
  // running past it. Never condense below 72% — thinner than that reads as
  // visibly squashed rather than a deliberate condensed-type look.
  const KICKER_MIN_SCALE_X = 0.72;
  const kickerFittedWidth = trimmedKickerText ? measureKickerWidthAt(trimmedKickerText, kickerFontSize) : 0;
  const kickerOverflowsAtFloor = trimmedKickerText ? kickerFittedWidth > kickerFitWidth : false;
  const kickerScaleX = kickerOverflowsAtFloor
    ? clamp(kickerFitWidth / kickerFittedWidth, KICKER_MIN_SCALE_X, 1)
    : 1;
  // createEditorialLabelLayout below wraps its text to whatever width it's
  // given and keeps only the first `maxLines` (1) lines — the render-side
  // mirror of the measurement bug just fixed above, and the actual mechanism
  // that drops the tail of an overflowing kicker sentence instead of the
  // scaleX squeeze ever getting a chance to run on it. In the (overwhelming
  // majority) case where the fitted font size already brings the sentence
  // under kickerFitWidth, pass the real box width through unchanged — this
  // measurement was already never going to wrap there. Only widen it in the
  // floor-overflow case, and only enough to fit the sentence's own true
  // width, so it still wraps to exactly one (oversized) line instead of
  // being cut — that line then gets condensed to the real width below via
  // kickerScaleX rather than being cropped.
  const kickerLabelMeasureWidth = kickerOverflowsAtFloor
    ? kickerFittedWidth + kickerPadding * 2 + 2
    : contentWidth;

  // kickerColonIndex/kickerLabelPart/kickerRestPart/kickerAccentColor/
  // kickerRichText are all computed above now (measureKickerWidthAt needs
  // them too) — kickerRichText colours just the kicker's leading label (up
  // to and including its first colon, e.g. "स्वर्णिम सफलता:") with the same
  // accent colour the headline itself uses for that story; the rest of the
  // kicker stays plain grey.
  const storyAccentColor = articleData.inlineSubheadingColor || kickerAccentColor || "#b42318";

  const effectiveKicker = {
    ...articleData.kicker,
    enabled: articleData.kicker.enabled && trimmedKickerWords.length > 0,
    text: isLeaderRail
      ? articleData.kicker.text
      : trimmedKickerWords.length > 0 ? kickerRichText : articleData.kicker.text,
    style: {
      ...articleData.kicker.style,
      fontSize: isLeaderRail ? 13 : kickerFontSize,
      color: isLeaderRail || isNarrowKicker || isWideBottomFrontPackage ? "#ffffff" : "#555555",
      backgroundColor: isLeaderRail ? "#b42318" : (isNarrowKicker || isWideBottomFrontPackage ? storyAccentColor : "transparent"),
      borderRadius: isLeaderRail ? 0 : (isNarrowKicker ? 4 : isWideBottomFrontPackage ? 2 : 0),
      // Badge stays centred on the box's top border (unchanged). A regular
      // kicker now starts flush left — same x as the headline below it —
      // and spans out toward the same right edge, instead of sitting
      // centred with dead space on both sides.
      // Leader rail: full-width centered red box.
      alignment: isLeaderRail || isNarrowKicker || isWideBottomFrontPackage || isHealthDeskKicker ? ("center" as const) : ("left" as const),
      padding: isLeaderRail ? 5 : (isNarrowKicker ? 4 : isWideBottomFrontPackage ? kickerPadding : 0),
    },
  };
  // Narrow (1-2 col) boxes use the pill/badge treatment: the badge is centred
  // ON the box's top border line, so the outline meets it at its middle-left
  // and middle-right edges. The pill is painted after the border stroke, so it
  // masks the line across its own width and the border reads as attached to
  // the badge rather than passing behind it.
  const kickerHeightEst = kickerFontSize + 8; // approx font size + 2*padding
  const kickerTopInset = isLeaderRail
    ? 0
    : isNarrowKicker
      ? NARROW_KICKER_BOX_TOP_MARGIN - kickerHeightEst / 2
      : topInset;

  const kicker = createEditorialLabelLayout(
    isLeaderRail ? 0 : isNarrowKicker && effectiveKicker.style.alignment !== "center" ? inset + 12 : inset, // indented a bit so the line is visible on the left
    kickerTopInset,
    kickerLabelMeasureWidth,
    effectiveKicker,
    { gridSize: 1 },
    1,
  );
  if (kicker && isNarrowKicker) {
    kicker.height += 2;
  }
  if (kicker && isHealthDeskKicker) {
    // Colour/weight only -- width, centring, vertical position and font
    // size all now come for free from the regular (non-badge) kicker path
    // below, since isHealthDeskKicker excludes this box from isNarrowKicker
    // entirely (see its definition above). An earlier version patched size
    // and position onto an already-built badge layout instead, which left
    // the text's pre-measured segment widths out of sync with the new
    // (bigger) font size and silently dropped words instead of just
    // rendering bigger -- and left this box straddling its own top border
    // the way the narrow badge pill is designed to, which is what read as
    // two overlapping lines once it was widened.
    const healthDeskFill = "#8FCB93"; // medium green (was #F6FBF3, near-white)
    const healthDeskStroke = "#2F6F3A";
    const healthDeskText = "#000000";

    kicker.fill = healthDeskFill;
    kicker.stroke = healthDeskStroke;
    kicker.strokeWidth = 1.1;
    kicker.cornerRadius = 0;
    // A comfortable fixed height (generous padding around the fitted font
    // size), text vertically re-centred within it -- position only, so the
    // already-correctly-measured glyph sizes/segments from construction are
    // untouched. The full-width/x/width/horizontal-centring block right
    // below this one doesn't touch y or height, so both survive into the
    // final layout.
    const healthDeskBoxHeight = Math.max(kicker.height, kickerFontSize + 16);
    kicker.height = healthDeskBoxHeight;
    kicker.textBlock = {
      ...kicker.textBlock,
      y: kicker.y,
      height: healthDeskBoxHeight,
      style: {
        ...kicker.textBlock.style,
        fill: healthDeskText,
        fontFamily: getNewspaperFontStack("serif"),
        fontStyle: "700",
      },
      lineBoxes: kicker.textBlock.lineBoxes.map((line) => {
        // Segments render at (segment.y - line.y) *inside* a Group already
        // positioned at line.y (see ArticleBox.tsx's renderTextBlock) -- that
        // pre-measured relative offset is what actually places the glyphs on
        // their baseline within the line. Moving line.y without moving each
        // segment.y by the same amount changes that relative offset instead
        // of the line's absolute position, which is what silently cancelled
        // an earlier version of this centring out.
        const targetLineY = kicker.y + Math.max(0, (healthDeskBoxHeight - line.height) / 2);
        const deltaY = targetLineY - line.y;
        return {
          ...line,
          y: targetLineY,
          style: {
            ...line.style,
            fill: healthDeskText,
            fontFamily: getNewspaperFontStack("serif"),
            fontStyle: "700",
          },
          segments: line.segments?.map((segment) => ({
            ...segment,
            y: segment.y + deltaY,
            style: {
              ...segment.style,
              fill: healthDeskText,
              fontFamily: getNewspaperFontStack("serif"),
              fontStyle: "700",
            },
          })),
        };
      }),
    };
  }
  if (kicker && isVicharManthanBandKicker) {
    // Same colour/weight-only patch as isHealthDeskKicker just above --
    // width, centring, vertical position and font size already come for
    // free from the regular (non-badge) kicker path below, since this flag
    // excludes the box from isNarrowKicker entirely. Story 3's band is
    // maroon (सुनी सुनाई); story 5's is olive (बात मुद्दे की) -- the printed
    // page uses two different band colours for its two labelled columns.
    const bandFill = editorialStoryNumber === 3 ? "#8a1f2b" : "#6b7a3a";
    const bandText = "#ffffff";

    kicker.fill = bandFill;
    kicker.stroke = bandFill;
    kicker.strokeWidth = 0;
    kicker.cornerRadius = 0;
    const bandHeight = Math.max(kicker.height, kickerFontSize + 16);
    kicker.height = bandHeight;
    kicker.textBlock = {
      ...kicker.textBlock,
      y: kicker.y,
      height: bandHeight,
      style: {
        ...kicker.textBlock.style,
        fill: bandText,
        fontFamily: getNewspaperFontStack("serif"),
        fontStyle: "700",
      },
      lineBoxes: kicker.textBlock.lineBoxes.map((line) => {
        const targetLineY = kicker.y + Math.max(0, (bandHeight - line.height) / 2);
        const deltaY = targetLineY - line.y;
        return {
          ...line,
          y: targetLineY,
          style: { ...line.style, fill: bandText, fontFamily: getNewspaperFontStack("serif"), fontStyle: "700" },
          segments: line.segments?.map((segment) => ({
            ...segment,
            y: segment.y + deltaY,
            style: { ...segment.style, fill: bandText, fontFamily: getNewspaperFontStack("serif"), fontStyle: "700" },
          })),
        };
      }),
    };
  }
  if (kicker && !isNarrowKicker) {
    if (!isLeaderRail) {
      kicker.x = inset;
      kicker.width = contentWidth;
      kicker.textBlock = {
        ...kicker.textBlock,
        x: inset + kicker.padding,
        width: Math.max(1, contentWidth - kicker.padding * 2),
        style: {
          ...kicker.textBlock.style,
          align: "center",
        },
        lineBoxes: kicker.textBlock.lineBoxes.map((line) => {
          const centeredWidth = Math.max(1, contentWidth - kicker.padding * 2);
          if (!isVicharManthanBandKicker || !line.segments?.length) {
            return {
              ...line,
              x: inset + kicker.padding,
              width: centeredWidth,
              style: {
                ...line.style,
                align: "center",
              },
            };
          }

          const segmentStart = line.segments[0]?.x ?? line.x;
          const segmentEnd = line.segments.reduce(
            (max, segment) => Math.max(max, segment.x + (segment.renderedWidth ?? segment.measuredWidth ?? segment.width)),
            segmentStart,
          );
          const renderedWidth = Math.max(1, segmentEnd - segmentStart);
          const targetX = inset + kicker.padding + Math.max(0, (centeredWidth - renderedWidth) / 2);
          const deltaX = targetX - segmentStart;

          return {
            ...line,
            x: targetX,
            width: centeredWidth,
            measuredWidth: renderedWidth,
            renderedWidth,
            style: {
              ...line.style,
              align: "center",
            },
            segments: line.segments.map((segment) => ({
              ...segment,
              x: segment.x + deltaX,
            })),
          };
        }),
      };
    }
    if (isWideBottomFrontPackage) {
        kicker.stroke = "#7f1d1d";
        kicker.strokeWidth = 0.8;
      }
  }
  if (kicker && kickerScaleX < 1) {
    // The badge pill auto-sizes to its (now widened, unwrapped) text — unlike
    // the non-badge branch above, nothing has capped its width back down to
    // the real box yet, so the pill itself would render wider than the box.
    // Shrink it back to the box's own measure width, re-centred, so the
    // condensed text sits inside a correctly-sized pill rather than an
    // oversized one.
    if (isNarrowKicker) {
      const badgeTargetWidth = Math.min(kicker.width, kickerMeasureWidth);
      const centerX = kicker.x + kicker.width / 2;
      const newX = centerX - badgeTargetWidth / 2;
      kicker.width = badgeTargetWidth;
      kicker.x = newX;
      kicker.textBlock = {
        ...kicker.textBlock,
        x: newX + kicker.padding,
        width: Math.max(1, badgeTargetWidth - kicker.padding * 2),
        lineBoxes: kicker.textBlock.lineBoxes.map((line) => ({
          ...line,
          x: newX + kicker.padding,
          width: Math.max(1, badgeTargetWidth - kicker.padding * 2),
        })),
      };
    }
    kicker.textBlock = {
      ...kicker.textBlock,
      lineBoxes: kicker.textBlock.lineBoxes.map((line) => {
        const naturalWidth = line.measuredWidth ?? line.renderedWidth ?? line.width;

        return {
          ...line,
          scaleX: kickerScaleX,
          renderedWidth: naturalWidth * kickerScaleX,
        };
      }),
    };
  }

  // Scale the gap between the label (kicker/strap) and the headline
  // based on the headline's size so it always feels proportional.
  // Kicker gap raised back up (0.105→0.16, floor 3→4) — the tightened
  // 0.105 value from an earlier spacing pass read as the kicker sticking to
  // the headline once real kicker text started rendering regularly.
  const dynamicKickerHeadlineGap = isWideBottomFrontPackage
    ? 4
    : isNarrowKicker
      ? 2
    : Math.max(4, Math.round(headlineMetrics.fontSize * 0.16));
  const dynamicStrapHeadlineGap = Math.max(3, Math.round(headlineMetrics.fontSize * 0.084));

  // The badge pill's own bounding box straddles the border by design (see
  // NARROW_KICKER_BOX_TOP_MARGIN above) — its top half sits above the box's
  // true content area on purpose. Deriving the headline's position from that
  // straddled box made a badge-kicker story's headline start ~9-10pt higher
  // than a same-row story with a normal (in-flow) kicker, which is exactly
  // the row misalignment this fixes: content resumes as if the badge occupied
  // ordinary in-flow space from the box's own top padding, while the pill
  // itself keeps rendering at its actual (straddled) position untouched.
  const kickerContentFlowBottom = kicker
    ? isNarrowKicker
      ? topInset + kickerHeightEst
      : kicker.y + kicker.height
    : topInset;

  const strap = createEditorialLabelLayout(
    inset,
    kicker ? kickerContentFlowBottom + Math.max(1, Math.round(kickerFontSize * 0.1)) : topInset,
    contentWidth,
    articleData.strap,
    baselineGrid,
  );
  const editorialHeadlineTopClearance =
    settings.editorialPageStyle && !kicker && !strap ? Math.max(3, Math.min(7, topInset * 0.75)) : 0;
  const headlineY = strap
    ? strap.y + strap.height + dynamicStrapHeadlineGap
    : kicker
      ? kickerContentFlowBottom + dynamicKickerHeadlineGap
      : topInset + editorialHeadlineTopClearance;

  // headlineText is already stripped; the fallbacks render articleData.headline
  // directly, so they need stripping too or the danda comes back on screen.
  const finalHeadlineRichText = articleData.headlineColor
    ? createStyledHeadlineRichText(headlineText, articleData.headlineColor as EditorialHeadlineColor, headlineMetrics.wrappedLines)
      ?? stripHeadingTerminatorFromRichText(headlineRichSource)
    : stripHeadingTerminatorFromRichText(headlineRichSource);

  const baseHeadlinePaddingTop = containerStyles.headline.framePaddingTop ?? 0;
  const baseHeadlinePaddingBottom = containerStyles.headline.framePaddingBottom ?? 0;
  const hasHeadlineBackground = containerStyles.headline.containerBackgroundColor && containerStyles.headline.containerBackgroundColor !== "transparent";
  const dynamicHeadlinePaddingTop = hasHeadlineBackground
    ? Math.max(baseHeadlinePaddingTop, Math.round(resolvedHeadlineStyle.fontSize * 0.18))
    : baseHeadlinePaddingTop;
  const dynamicHeadlinePaddingBottom = hasHeadlineBackground
    ? Math.max(baseHeadlinePaddingBottom, Math.round(resolvedHeadlineStyle.fontSize * 0.18))
    : baseHeadlinePaddingBottom;

  const headlineTextY = headlineY + dynamicHeadlinePaddingTop;

  const adjustedHeadlineStyle = {
    ...containerStyles.headline,
    framePaddingTop: dynamicHeadlinePaddingTop,
    framePaddingBottom: dynamicHeadlinePaddingBottom,
  };

  let headline = applyContainerStyleToTextBlock(createRichTextBlock(
    inset,
    headlineTextY,
    contentWidth,
    finalHeadlineRichText,
    headlineText,
    resolvedHeadlineStyle,
    headlineMetrics,
    { gridSize: 1 },
  ), withBackgroundColor(adjustedHeadlineStyle, undefined), {
    x: inset,
    y: headlineY,
    width: contentWidth,
    height:
      headlineMetrics.consumedHeight +
      dynamicHeadlinePaddingTop +
      dynamicHeadlinePaddingBottom,
  });
  headline = fillHeadlineLineEdges(headline, headlineMetrics.lines.map((line) => line.width));

  // Subheadline font size MUST NEVER exceed main headline font size
  const maxSafeSubheadlineSize = Math.max(9, Math.floor(headlineMetrics.fontSize * 0.55));
  const resolvedSubheadlineFontSize = Math.min(editorialStyles.subheadline.fontSize, maxSafeSubheadlineSize);

  const subheadlineStyle = {
    ...editorialStyles.subheadline,
    fontSize: resolvedSubheadlineFontSize,
    align: typographyControls.subheadlineAlignment,
    letterSpacing: resolveCharacterSpacing({
      tracking: typographyControls.subheadlineTracking,
      letterSpacing: typographyControls.subheadlineLetterSpacing,
      fontSize: resolvedSubheadlineFontSize,
    }),
    fill:
      articleData.subheadlineBanner.mode === "none"
        ? editorialStyles.subheadline.fill
        : articleData.subheadlineBanner.textColor,
  };
  const subheadlinePadding =
    articleData.subheadlineBanner.mode === "none"
      ? 0
      : (articleData.subheadlineBanner.padding ?? 5) + (articleData.subheadlineBanner.borderWidth ?? 0.8);
  const subheadlineMeasureWidth = Math.max(1, contentWidth - subheadlinePadding * 2);
  // A front page sets the banner as a single ruled line. The 8-column layout
  // also keeps wide plain subheadlines to one line, matching the screenshot
  // review: the line may shrink, but it must not wrap or drop words.
  const subheadlineSingleLine = Boolean(
    houseStyle?.subheadlineBannerSingleLine &&
      hasSubheadlineText &&
      articleData.subheadlineBanner.mode !== "none",
  ) || Boolean(
    isEightColumnTemplate &&
      hasSubheadlineText &&
      Math.max(1, Math.round(frameColumnSpan)) >= 6,
  );
  const measureSubheadline = (style: typeof subheadlineStyle, maxLines: number) =>
    measureArticleParagraph({
      content: hasSubheadlineText ? stripHeadingTerminatorFromRichText(articleData.subheadline) : "",
      text: hasSubheadlineText ? subheadlineText : "",
      width: subheadlineMeasureWidth,
      style,
      maxLines: hasSubheadlineText ? maxLines : 0,
    });

  let fittedSubheadlineStyle = subheadlineStyle;
  let subheadlineMetrics = measureSubheadline(subheadlineStyle, subheadlineSingleLine ? 1 : 2);
  if (subheadlineSingleLine) {
    // Measure unbounded so the natural line count is visible; capping first
    // would report one line whether or not the text actually fits.
    const minBannerFontSize = Math.max(
      isEightColumnTemplate ? 4.5 : 5.5,
      subheadlineStyle.fontSize * (isEightColumnTemplate ? 0.5 : 0.62),
    );
    let candidateSize = subheadlineStyle.fontSize;
    while (
      candidateSize > minBannerFontSize &&
      measureSubheadline({ ...fittedSubheadlineStyle, fontSize: candidateSize }, 4).lineCount > 1
    ) {
      candidateSize = Math.max(minBannerFontSize, candidateSize - 0.25);
    }
    fittedSubheadlineStyle = { ...subheadlineStyle, fontSize: candidateSize };
    subheadlineMetrics = measureSubheadline(fittedSubheadlineStyle, 1);
  }

  const debugSubheadings =
    typeof process !== "undefined" &&
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DEBUG_SUBHEADINGS === "true";
  if (debugSubheadings && hasSubheadlineText) {
    console.log(`[SubheadingDiagnostic] Original subheading text: ${JSON.stringify(articleData.subheadline)}`);
    console.log(`[SubheadingDiagnostic] Normalised subheading text: ${JSON.stringify(subheadlineText)}`);
    console.log(`[SubheadingDiagnostic] Frame X: ${inset + subheadlinePadding}, Width: ${subheadlineMeasureWidth}, Height: ${subheadlineMetrics.consumedHeight}`);
    console.log(`[SubheadingDiagnostic] Font family: ${subheadlineStyle.fontFamily}, Size: ${subheadlineStyle.fontSize}, Line height: ${subheadlineStyle.lineHeight}`);
    console.log(`[SubheadingDiagnostic] Line count: ${subheadlineMetrics.lines.length}`);
    subheadlineMetrics.lines.forEach((l, i) => {
      console.log(`[SubheadingDiagnostic] Line ${i}: text=${l.text}, width=${l.width}`);
    });
  }
  const subheadlineContainerStyle = {
    ...withBackgroundColor(
      containerStyles.subheadline,
      articleData.subheadlineBanner.mode === "none"
        ? containerStyles.subheadline.containerBackgroundColor
        : articleData.subheadlineBanner.backgroundColor,
    ),
    frameMode: hasSubheadlineText
      ? (articleData.subheadlineBanner.mode === "none"
          ? containerStyles.subheadline.frameMode
          : "frame")
      : "none",
    containerOpacity:
      articleData.subheadlineBanner.mode === "none"
        ? containerStyles.subheadline.containerOpacity
        : Math.max(0, Math.min(1, articleData.subheadlineBanner.backgroundOpacity ?? 1)),
    containerBorderRadius: articleData.subheadlineBanner.mode === "rounded" ? (articleData.subheadlineBanner.borderRadius ?? 3) : 0,
    framePaddingTop: Math.max(subheadlinePadding, containerStyles.subheadline.framePaddingTop ?? 0) + (articleData.subheadlineBanner.mode !== "none" ? Math.max(4, Math.round(resolvedSubheadlineFontSize * 0.15)) : 0),
    framePaddingBottom: Math.max(subheadlinePadding, containerStyles.subheadline.framePaddingBottom ?? 0),
    framePaddingLeft: subheadlinePadding,
    framePaddingRight: subheadlinePadding,
  };
  // spacing.headlineToSubheadline is a flat, priority-based value — fine for a
  // small headline, but Devanagari descenders on a large (lead-tier, 5-6 col)
  // headline extend well past its nominal line box, and a flat ~1.5pt gap let
  // them touch a subheadline banner sitting directly underneath. Scaling with
  // the headline's own font size (same approach as the kicker-headline gap)
  // fixes that while leaving small headlines — which were never the problem —
  // at their already-correct tight spacing. Multiplier cut back (0.12→0.08)
  // — 0.12 left too much white space below the headline on larger tiers.
  const headlineToSubheadlineGap = Math.max(
    spacing.headlineToSubheadline,
    Math.round(headlineMetrics.fontSize * 0.08),
  );
  // Bottom of the headline for flow purposes: its box, less the trailing
  // leading that hangs below the last row of glyphs. Front-page-only, and it
  // moves what follows rather than the headline itself — see
  // `FrontPageArticleStyle.headlineTrailingLeadingTrim`.
  // Measured off the style the block is actually built with. This read
  // `headlineStyle` before, which is the pre-fit style — when the fitter
  // resolved a different line height the slack was under-estimated and the gap
  // survived the trim.
  // Reserved-but-unused descender depth under the last headline line.
  //
  // The slack figure below models the empty space under a headline as the
  // leading alone -- everything past 1.0em -- which treats the glyph ink as
  // filling the em exactly. Devanagari does: its matras ride above and its
  // conjuncts/descenders paint below the nominal line advance (the same
  // property this file already allows for on captions and on the
  // headline-to-subheadline gap). Latin ink stops at the baseline unless the
  // line happens to end in a descender, so the font's whole descender band
  // sits empty and the leading model cannot see it -- and because it scales
  // with font size, a lead-tier headline turns it into a visible white band.
  //
  // Measured per line rather than assumed per language: a line ending in "y"
  // or "g" reports its real descent and keeps its space. Returns null outside
  // a DOM (the test runner), where the original formula stands unchanged.
  const unusedHeadlineDescender = (() => {
    if (!settings.reclaimUnusedHeadlineDescender) return 0;
    const lastLine = headlineMetrics.lines[headlineMetrics.lines.length - 1];
    if (!lastLine?.text?.trim()) return 0;
    const ink = measureTextInkMetrics({
      text: lastLine.text,
      fontFamily: resolvedHeadlineStyle.fontFamily,
      fontSize: headlineMetrics.fontSize,
      fontStyle: resolvedHeadlineStyle.fontStyle,
    });
    if (!ink) return 0;
    return Math.max(0, ink.fontDescent - ink.actualDescent);
  })();
  const headlineTrailingSlack = Math.max(
    0,
    (resolvedHeadlineStyle.lineHeight - 1) * headlineMetrics.fontSize + unusedHeadlineDescender,
  );
  // A one-column box has the least depth to spare and showed the gap most
  // plainly, so it reclaims all of the slack rather than most of it.
  // The editorial page reclaims the same slack the front page does. Its
  // headlines are the largest on any page, so the leftover leading below them
  // is the most visible; leaving it in place is what put a white band between
  // an editorial headline and the first line of its copy.
  //
  // That reclaim is measured off the *last line's* nominal leading, on the
  // assumption a headline this narrow is one line and the whole block is
  // "slack". A narrow title promoted from the subheadline (usesNarrowTitle)
  // can still wrap to 2 lines, and Devanagari's own matras/conjuncts render
  // taller than the line-height metric predicts -- reclaiming the full
  // trailing slack in that case cut into the second line's real ink and
  // printed the byline directly over it. One line still reclaims fully (the
  // case this was built and tested for); 2+ lines reclaim nothing, leaving
  // the nominal leading as a safety margin instead of assuming it's spare.
  const editorialTrimShare = settings.editorialPageStyle?.headlineTrailingLeadingTrim ?? 0;
  const headlineTrimShare = usesNarrowTitle
    ? headlineMetrics.lineCount > 1
      ? 0
      : (houseStyle?.narrowBoxTitle.trailingLeadingTrim ?? editorialTrimShare)
    : isFrontPageTwoColumnBox
      ? Math.min(houseStyle?.headlineTrailingLeadingTrim ?? 0, 0.35)
    : (houseStyle?.headlineTrailingLeadingTrim ?? editorialTrimShare);
  // The headline's frame also carries bottom padding below the last row of
  // glyphs. Trimming only the leading left that padding in place, which is why
  // the gap under a one-column title stayed visible — reclaim both.
  const headlineFramePaddingBottom =
    settings.frontPageStyle || settings.editorialPageStyle ? dynamicHeadlinePaddingBottom : 0;
  const headlineFlowBottom =
    headline.y +
    headline.height -
    headlineTrailingSlack * headlineTrimShare -
    headlineFramePaddingBottom;
  const subheadlineY = headlineFlowBottom + headlineToSubheadlineGap;
  // The banner's own bottom padding already gives it breathing room before
  // the body starts, so this only needs to clear its border — not add
  // another full padding's worth of empty vertical space on top of that.
  // Floor cut ~30% (5→3.5) per an explicit request to tighten internal spacing.
  const subheadlineExtraClearance =
    articleData.subheadlineBanner.mode === "none"
      ? 0
      : Math.max(3.5, articleData.subheadlineBanner.borderWidth + 1);
  // Subheadline text block width must be the INNER measure width (subheadlineMeasureWidth),
  // not contentWidth. This ensures that when applyContainerStyleToTextBlock computes:
  //   frameWidth = Math.max(frame.width, block.width + paddingLeft + paddingRight)
  // the result equals exactly contentWidth (= subheadlineMeasureWidth + padding * 2),
  // and never bleeds beyond the article boundary into the gutter.
  const subheadlineInnerX = inset + subheadlinePadding;
  const subheadline = applyContainerStyleToTextBlock(createRichTextBlock(
    subheadlineInnerX,
    subheadlineY + subheadlineContainerStyle.framePaddingTop,
    subheadlineMeasureWidth,
    hasSubheadlineText ? stripHeadingTerminatorFromRichText(articleData.subheadline) : "",
    hasSubheadlineText ? subheadlineText : "",
    fittedSubheadlineStyle,
    subheadlineMetrics,
    { gridSize: 1 }, // 1px dummy grid to disable baseline snapping and prevent clipping inside fixed box
    typographyControls.subheadlineJustifyMode,
    typographyControls.subheadlineJustifyEngineMode,
  ), subheadlineContainerStyle, {
    x: inset,
    y: subheadlineY,
    // Hard clamp: frame must never exceed contentWidth
    width: Math.min(contentWidth, subheadlineMeasureWidth + subheadlinePadding * 2),
    height: hasSubheadlineText
      ? subheadlineMetrics.consumedHeight +
      subheadlineContainerStyle.framePaddingTop +
      subheadlineContainerStyle.framePaddingBottom
      : 0,
  });

  if (debugSubheadings && hasSubheadlineText) {
    console.log(`[SubheadingDiagnostic] Safe top/bottom insets: ${subheadlineContainerStyle.framePaddingTop}/${subheadlineContainerStyle.framePaddingBottom}`);
    console.log(`[SubheadingDiagnostic] Final line-box top/bottom: y=${subheadline.y}, height=${subheadline.height}`);
    console.log(`[SubheadingDiagnostic] Composition reported overflow: ${subheadline.overflow}`);
  }
  const subheadlineBackground = null;

  const bylineText = formatByline(articleData);
  const bylineStyle: ArticleTextStyle = {
    ...editorialStyles.dateline,
    align: "center",
    fontSize: 8.2,
    lineHeight: 1,
    fill: settings.tightBylineToBodyGap ? "#ffffff" : editorialStyles.dateline.fill,
  };
  const bylineMetrics = measureParagraph({
    text: bylineText,
    width: contentWidth,
    fontFamily: bylineStyle.fontFamily,
    fontSize: bylineStyle.fontSize,
    fontStyle: bylineStyle.fontStyle,
    lineHeight: bylineStyle.lineHeight,
    maxLines: 1,
    script: "mixed",
  });
  let byline = createTextBlock(0, 0, 1, "", bylineStyle, { ...bylineMetrics, wrappedLines: [], lineCount: 0, consumedHeight: 0 }, baselineGrid);
  let bylineDivider: ArticleDecorativeDivider | null = null;
  // Same fix as headlineToSubheadlineGap above: spacing.datelineToContent is a
  // flat, priority-based value, which reads fine for a small headline but let
  // a byline sit flush against a larger headline (no subheadline banner to
  // separate them) once headlines started growing — scale it with the
  // headline's own font size so bigger headlines always keep clear of it.
  // Multiplier cut back (0.12→0.08), matching headlineToSubheadlineGap —
  // 0.12 left too much white space below the headline on larger tiers.
  // Scaling with the headline size keeps a big headline clear of the byline,
  // but a one-column title is exactly where that reads as a hole. Those boxes
  // take the flat minimum instead.
  const editorialHeadlineBottomGap =
    settings.editorialPageStyle && editorialStoryNumber === 1
      ? 6
      : settings.editorialPageStyle && [2, 5, 6].includes(editorialStoryNumber)
      ? 5
      : (settings.editorialPageStyle?.headlineToBodyGap ?? 0);
  const headlineToDatelineGap = settings.editorialPageStyle
    // Flat, and small. The scaling rule below exists to keep a big headline
    // clear of a byline; an editorial headline has no byline under it and the
    // scaled gap read as a hole.
    ? editorialHeadlineBottomGap
    // A news page may state its own figure too. Only the inside page does — its
    // headlines showed the same hole, because the scaled gap and the baseline
    // snap compound. The front page leaves it undefined and keeps the rule
    // below exactly.
    : houseStyle?.headlineToBodyGap !== undefined
    ? houseStyle.headlineToBodyGap
    : narrowTitleFill
    ? spacing.datelineToContent
    : isFrontPageTwoColumnBox
      ? Math.max(spacing.datelineToContent, Math.round(headlineMetrics.fontSize * 0.24))
      : isBottomFrontThreeColumnPackage
        ? Math.max(spacing.datelineToContent, Math.round(headlineMetrics.fontSize * 0.16))
      : Math.max(spacing.datelineToContent, Math.round(headlineMetrics.fontSize * 0.08));
  // Opt-in per-story clearance on top of the rules above -- undefined for
  // every story except the few that explicitly set it, so this never moves
  // anything by default.
  const headlineToBylineExtraGap = articleData.headlineToBylineExtraGap ?? 0;
  // A banner already carries its own framePaddingBottom inside
  // `subheadline.height`, so adding `spacing.datelineToContent` on top pays for
  // the same breathing room twice -- and that figure was measured for the
  // dateline-to-content step, not for this one. Clearing the banner's border
  // (subheadlineExtraClearance) is all that is left to do, which is what the
  // comment on that constant already says it is for. The no-banner branch
  // below is untouched: it adds a single gap and is already correct.
  const subheadlineToContentGap = settings.tightBylineToBodyGap
    ? subheadlineExtraClearance
    : spacing.datelineToContent + subheadlineExtraClearance;
  const contentStartY =
    (hasSubheadlineText
      ? subheadline.y + subheadline.height + subheadlineToContentGap
      : headlineFlowBottom + headlineToDatelineGap) + headlineToBylineExtraGap;

  const captionStyle = editorialStyles.caption;
  const bodyLineHeight = getBaselineLineAdvance(getLineHeightPx(resolvedBodyStyle), baselineGrid);
  const lineAdvanceGrid = createBaselineGrid(bodyLineHeight);
  const mediaY = snapToBaseline(contentStartY, baselineGrid);
  const availableStackHeight = snapMinMeasurementToBaseline(
    articleBox.height - mediaY - bottomInset,
    getBaselineLineAdvance(MIN_BODY_HEIGHT, baselineGrid),
    baselineGrid,
    "floor",
  );
  // A wider gutter on the editorial and inside pages.
  //
  // The editorial page needed it because its columns are narrower and at 6.05pt
  // the copy ran together. The inside page needs it for a different reason: it
  // draws a hairline rule down each gutter, and a rule centred in 6.05pt leaves
  // barely 2.5pt of air either side, which reads worse than no rule at all.
  //
  // The front page keeps COLUMN_GAP exactly — it carries no rules and is signed
  // off, and widening its gutter would re-break every line on the page.
  const baseColumnGap =
    settings.editorialPageStyle || settings.insidePageStyle ? EDITORIAL_COLUMN_GAP : COLUMN_GAP;
  const columnGap = isEightColumnTemplate
    ? Math.max(baseColumnGap, EIGHT_COLUMN_BODY_COLUMN_GAP)
    : baseColumnGap;
  const requestedColumnSource =
    isEightColumnTemplate && roundedFrameColumnSpan <= 2
      ? 1
      : isEightColumnTemplate && Number.isFinite(frameColumnSpan) && roundedFrameColumnSpan > 2
      ? Math.max(articleData.columnCount, frameColumnSpan)
      : articleData.columnCount;
  const requestedColumnCount = clamp(Math.round(requestedColumnSource), 1, 8);
  const minReadableColumnWidth = isEightColumnTemplate
    ? EIGHT_COLUMN_MIN_BODY_COLUMN_WIDTH
    : MIN_BODY_COLUMN_WIDTH;
  const safeColumnCount = getReadableColumnCount(requestedColumnCount, contentWidth, columnGap, minReadableColumnWidth);
  // On a front page a photo never spans every column of a multi-column box —
  // there is always a column of text running beside it, so a 2-column box gets a
  // 1-column photo rather than a full-width band across the top.
  const imageColumnCeiling =
    houseStyle?.alwaysLeaveTextColumnBesideImage && safeColumnCount >= 2
      ? safeColumnCount - 1
      : Math.max(1, safeColumnCount);
  const requestedImageColumnSpan = clamp(
    Math.round(imageSettings.imageColumnSpan),
    1,
    Math.max(1, Math.min(imageColumnCeiling, safeColumnCount)),
  );
  const columnWidth =
    (contentWidth - columnGap * Math.max(0, safeColumnCount - 1)) / safeColumnCount;
  const safeImageColumnSpan = imageSettings.autoSizeImage
    ? getReadableImageColumnSpan(requestedImageColumnSpan, safeColumnCount, columnWidth)
    : requestedImageColumnSpan;
  // Reserve room for at least one readable caption line so a tall image can't
  // consume the whole stack height and squeeze the caption into nothing.
  // Overlay captions sit on top of the image itself, so they don't need
  // any of the stack height reserved for them.
  const captionWillConsumeStackSpace =
    articleData.caption.position === "below-image" || articleData.caption.position === "above-image";
  const minCaptionReserve = hasCaptionText && captionWillConsumeStackSpace
    ? Math.ceil(captionStyle.fontSize * 1.3 + spacing.imageToCaption + 2)
    : 0;
  const editorialImageQuality = optimizeImageForEditorialQuality({
    priority,
    imageSettings: {
      ...imageSettings,
      imageColumnSpan: safeImageColumnSpan,
    },
    storyHeight: articleBox.height,
    bodyHeight: Math.max(MIN_BODY_HEIGHT, availableStackHeight - minCaptionReserve),
    columnCount: safeColumnCount,
    bodyText,
  });
  let resolvedImageSettings = editorialImageQuality.imageSettings;
  if (
    settings.editorialPageStyle &&
    editorialTemplateId === "AkhandEditorial5A" &&
    (editorialStoryNumber === 2 || editorialStoryNumber === 5)
  ) {
    resolvedImageSettings = {
      ...resolvedImageSettings,
      imageHeight: editorialStoryNumber === 2 ? 176 : 156,
      imageHeightMode: "fixed",
      autoSizeImage: false,
    };
  }
  const imagePlacement = placeImage({
    storyBounds: {
      x: inset,
      y: mediaY,
      width: contentWidth,
      height: availableStackHeight,
    },
    imageSettings: resolvedImageSettings,
    columnCount: safeColumnCount,
    columnGap,
  });
  // Front page: a photo may not run the full depth of its box. Trim from the
  // bottom so the frame keeps its position and the body regains the height.
  const imageHeightBudget = isWideBottomFrontPackage
    ? Math.max(houseStyle?.imageHeightBudget ?? 0, 0.48)
    : houseStyle?.imageHeightBudget;
  const placedImageRect = hasImage ? imagePlacement.imageRect : null;
  const imageRect =
    placedImageRect && imageHeightBudget && imageHeightBudget > 0
      ? {
          ...placedImageRect,
          height: Math.min(placedImageRect.height, articleBox.height * imageHeightBudget),
        }
      : placedImageRect;
  const imageLabelStyle: ArticleTextStyle = {
    align: "center",
    fill: "#5f584f",
    fontFamily: "Arial",
    fontSize: 13,
    letterSpacing: 1.2,
    lineHeight: 1,
    wrap: "none",
  };
  const imageLabelMetrics = measureParagraph({
    text: "IMAGE",
    width: imageRect?.width ?? 1,
    fontFamily: imageLabelStyle.fontFamily,
    fontSize: imageLabelStyle.fontSize,
    fontStyle: imageLabelStyle.fontStyle,
    lineHeight: imageLabelStyle.lineHeight,
    maxLines: 1,
    script: "english",
  });
  const sourceWidth = articleBox.sourceWidth ?? resolvedImageSettings.sourceWidth;
  const sourceHeight = articleBox.sourceHeight ?? resolvedImageSettings.sourceHeight;
  const coverCrop =
    sourceWidth && sourceHeight && sourceWidth > 0 && sourceHeight > 0
      ? computeImageCoverCrop({
          sourceWidth,
          sourceHeight,
          frameWidth: imageRect?.width ?? 1,
          frameHeight: imageRect?.height ?? 1,
          // A dead-centre vertical crop (the default 0.5) cuts evenly off
          // the top and bottom -- for a typical news photo, where the
          // subject's head/face sits in the upper half, that reads as the
          // top of the subject being cut off. Biasing the focal point
          // upward keeps more of the top and crops more from the bottom
          // instead.
          focalPointY: 0.3,
        })
      : null;

  // Image geometry, cropping and the body-text obstacle it creates are left
  // completely untouched by caption placement — the photo always keeps its
  // full original size/position. An inside-image caption (below/left/right)
  // is purely a panel drawn within that same box, computed further down;
  // it never resizes or moves the photo, so body text flow can't be affected.
  // Round the photo's corners on roughly 30% of stories for visual variety.
  // Keyed off the box's own geometry so a given page always renders the same
  // way, and skipped on inside-image captions whose panel assumes square edges.
  const imageCornerSeed = Math.abs(Math.round(articleBox.x * 31 + articleBox.y * 17));
  const usesInsideImageCaption =
    hasCaptionText &&
    (imageRect?.width ?? 0) >= PAGE_COLUMN_WIDTH_PT &&
    articleData.caption.position !== "below-image" &&
    articleData.caption.position !== "above-image";
  const wantsRoundedImage = !usesInsideImageCaption && imageCornerSeed % 10 < 3;
  const image = hasImage
    ? {
        x: imageRect?.x ?? inset,
        y: imageRect?.y ?? mediaY,
        width: imageRect?.width ?? 1,
        height: imageRect?.height ?? 1,
        cornerRadius: wantsRoundedImage ? 6 : 0,
        fill: "#dfddd6",
        stroke: undefined,
        strokeWidth: 0,
        shapeType: resolvedImageSettings.imageShapeType ?? "rectangle",
        shapePoints: resolvedImageSettings.imageShapePoints ?? resolvedImageSettings.wrapContourPoints ?? [],
        crop: resolvedImageSettings.imageCrop ?? defaultStoryImageSettings.imageCrop,
        coverCropX: coverCrop?.sourceX,
        coverCropY: coverCrop?.sourceY,
        coverCropWidth: coverCrop?.sourceWidth,
        coverCropHeight: coverCrop?.sourceHeight,
        sourceAspectRatio: sourceWidth && sourceHeight && sourceHeight > 0 ? sourceWidth / sourceHeight : undefined,
        lines: [],
        label: createTextBlock(
          imageRect?.x ?? inset,
          (imageRect?.y ?? mediaY) +
            (imageRect?.height ?? 1) / 2 -
            imageLabelMetrics.consumedHeight / 2,
          imageRect?.width ?? 1,
          "IMAGE",
          imageLabelStyle,
          imageLabelMetrics,
          baselineGrid,
        ),
      }
    : null;

  // Inside-image caption placement: a light panel drawn within the image's
  // own (unchanged) bounds — full height + 25% width on the left/right edge.
  // The top/bottom edge (the only variant actually in use — editorStore only
  // ever assigns "overlay-bottom" now) deliberately has NO boxOverride here:
  // it used to get a fixed height guessed from 16% of the image's height,
  // sized before anything knew how many lines the caption text would
  // actually need. A caption long enough to wrap to 2 lines then had nowhere
  // in that fixed panel for the second line to go — it rendered past the
  // panel's own tinted background, into the plain photo below it.
  // createCaptionLayout already has a real dynamic-height code path for
  // "no boxOverride" (below, keyed off the caption's actual measured
  // consumedHeight, still capped at 3 lines via maxCaptionLines) — leaving
  // this branch unset lets that correct path run instead of the guess.
  const captionPosition = articleData.caption.position;
  const insideImageCaptionBox =
    image && hasCaptionText && (captionPosition === "overlay-left" || captionPosition === "overlay-right")
      ? (() => {
            const stripWidth = clamp(Math.round(image.width * 0.25), 24, Math.round(image.width * 0.5));
            const onRight = captionPosition === "overlay-right";
            return {
              x: onRight ? image.x + image.width - stripWidth : image.x,
              y: image.y,
              width: stripWidth,
              height: image.height,
            };
          })()
      : null;

  // A 1-column-wide image has no room for an inset caption panel without
  // crowding the photo — skip the caption and let the full image show
  // instead. Gated on the image's own actual rendered width against the true
  // page column width (PAGE_COLUMN_WIDTH_PT, ~145pt) — not the enclosing
  // box's width or articleData.columnCount (which, for real generated
  // stories, holds the body copy's internal text-column count instead, an
  // unrelated number that happened to almost always be >1 regardless of how
  // narrow the photo itself actually was).
  const imageWideEnoughForCaption = image ? image.width >= PAGE_COLUMN_WIDTH_PT : false;
  const caption =
    image && hasCaptionText && imageWideEnoughForCaption
      ? createCaptionLayout({
          caption: articleData.caption,
          image,
          fallbackY: image.y + image.height + spacing.imageToCaption,
          width: image.width,
          style: captionStyle,
          baselineGrid,
          typographyControls,
          containerStyles,
          boxOverride: insideImageCaptionBox,
        })
      : null;
  const captionConsumesVerticalSpace =
    Boolean(caption) &&
    (articleData.caption.position === "below-image" || articleData.caption.position === "above-image");
  const bodyStartY = mediaY;
  const bodyY = snapToBaseline(bodyStartY, baselineGrid);
  const naturalBodyHeight = articleBox.height - bodyY - bottomInset;
  const endBreathingSpace = allowEndBreathingSpace && naturalBodyHeight >= MIN_BODY_HEIGHT + requestedEndBreathingSpace
    ? Math.min(requestedEndBreathingSpace, Math.max(0, naturalBodyHeight - MIN_BODY_HEIGHT))
    : 0;
  const bodyHeight = snapMinMeasurementToBaseline(
    naturalBodyHeight - endBreathingSpace,
    getBaselineLineAdvance(MIN_BODY_HEIGHT, baselineGrid),
    baselineGrid,
    "floor",
  );
  const editorialFloatImage =
    usesLegacyEditorialFurniture &&
    editorialStoryNumber === 2 &&
    safeColumnCount >= 3 &&
    bodyHeight >= 180
      ? (() => {
          // Editorial-only story 2 image slot. It uses the normal story image
          // source and replacement flow; this is not part of front/inside layouts.
          const targetColumnIndex = Math.min(2, safeColumnCount - 1);
          const columnX = inset + getColumnStartX(targetColumnIndex, columnWidth, columnGap);
          const imageWidth = columnWidth;
          const imageHeight = Math.max(76, Math.min(bodyHeight * 0.26, imageWidth * 0.72));

          return {
            source: "articleImage" as const,
            x: columnX,
            y: bodyY,
            width: imageWidth,
            height: imageHeight,
            fill: "#F5F0E6",
            stroke: "#9A9086",
            strokeWidth: 0.8,
            opacity: 1,
          };
        })()
      : null;
  const factBoxX = inset + getColumnStartX(safeColumnCount - 1, columnWidth, columnGap);
  const factBoxOverlapsImageColumn = image
    ? rangesOverlap(
        factBoxX,
        factBoxX + columnWidth,
        image.x,
        image.x + image.width,
      )
    : false;
  const factBoxY = snapToBaseline(
    factBoxOverlapsImageColumn && caption && captionConsumesVerticalSpace
      ? caption.y + caption.height + 12
      : bodyY,
    baselineGrid,
  );
  const factBox = settings.enableFactBox
      ? composeFactBox({
        data: articleData.factBox,
        x: factBoxX,
        y: factBoxY,
        width: columnWidth,
        baselineGridSize: settings.baselineGridSize,
        theme: articleData.factBoxTheme,
        typography: typographyControls,
        containerStyles,
      })
    : null;
  const pullQuoteColumnSpan = Math.min(2, safeColumnCount);
  const pullQuoteStartColumn = Math.max(
    0,
    Math.floor((safeColumnCount - pullQuoteColumnSpan) / 2),
  );
  const pullQuoteWidth = Math.max(
    1,
    columnWidth * pullQuoteColumnSpan + columnGap * Math.max(0, pullQuoteColumnSpan - 1),
  );
  const pullQuoteX = inset + getColumnStartX(pullQuoteStartColumn, columnWidth, columnGap);
  const imageObstacleBottom =
    image
      ? snapToBaseline(
          caption && captionConsumesVerticalSpace && articleData.caption.position === "below-image"
            ? caption.y + caption.height + spacing.captionToBody
            : image.y + image.height + (isEightColumnTemplate ? 0 : spacing.imageToCaption),
          baselineGrid,
          "ceil",
        )
      : bodyY;
  const imageObstacle = {
    x: image ? image.x : 0,
    y: image ? image.y : mediaY,
    width: image ? image.width : 0,
    height: image ? Math.max(0, imageObstacleBottom - image.y) : 0,
  };
  const factBoxObstacle = factBox
    ? {
        x: factBox.x,
        y: factBox.y,
        width: factBox.width,
        height: factBox.height,
      }
    : null;
  let pullQuoteY = snapToBaseline(bodyY + bodyHeight * 0.38, baselineGrid);
  let pullQuote = settings.enablePullQuote
    ? composePullQuote({
        data: articleData.pullQuote,
        x: pullQuoteX,
        y: pullQuoteY,
        width: pullQuoteWidth,
        baselineGridSize: settings.baselineGridSize,
        theme: articleData.pullQuoteTheme,
        typography: typographyControls,
        containerStyles,
      })
    : null;

  if (pullQuote) {
    const pullQuoteAvoidanceRects = [
      image ? imageObstacle : null,
      factBoxObstacle,
    ].filter((obstacle): obstacle is { x: number; y: number; width: number; height: number } => obstacle !== null);

    for (const obstacle of pullQuoteAvoidanceRects) {
      const currentPullQuote = pullQuote;

      if (currentPullQuote && rectsOverlap(currentPullQuote, obstacle)) {
        pullQuoteY = snapToBaseline(obstacle.y + obstacle.height + 12, baselineGrid);
        pullQuote = composePullQuote({
          data: articleData.pullQuote,
          x: pullQuoteX,
          y: pullQuoteY,
          width: pullQuoteWidth,
          baselineGridSize: settings.baselineGridSize,
          theme: articleData.pullQuoteTheme,
          typography: typographyControls,
          containerStyles,
        });
      }
    }
  }

  if (pullQuote && pullQuote.y + pullQuote.height > articleBox.height - bottomInset) {
    pullQuoteY = snapToBaseline(
      Math.max(bodyY, articleBox.height - bottomInset - pullQuote.height),
      baselineGrid,
      "floor",
    );
    pullQuote = composePullQuote({
      data: articleData.pullQuote,
      x: pullQuoteX,
      y: pullQuoteY,
      width: pullQuoteWidth,
      baselineGridSize: settings.baselineGridSize,
      theme: articleData.pullQuoteTheme,
      typography: typographyControls,
      containerStyles,
    });
  }

  const obstacleRects = [
    factBox
      ? {
          x: factBox.x - inset,
          y: factBox.y,
          width: factBox.width,
          height: factBox.height,
        }
      : null,
    pullQuote
      ? {
          x: pullQuote.x - inset,
          y: pullQuote.y,
          width: pullQuote.width,
          height: pullQuote.height,
        }
      : null,
  ].filter((rect): rect is { x: number; y: number; width: number; height: number } => rect !== null);

  // Nested story boxes arrive as page-absolute rectangles; obstacleRects are
  // content-local (x measured from the content edge, y from the box top), so
  // convert before adding them.
  const isEditorialLeaderArticle =
    usesLegacyEditorialFurniture && editorialStoryNumber === 1;
  const isAkhandEditorialCompactAuthorArticle =
    editorialTemplateId === "AkhandEditorial5A" && (editorialStoryNumber === 1 || editorialStoryNumber === 4);
  const isAkhandVicharManthanCompactAuthorArticle =
    editorialTemplateId === "AkhandVicharManthan6A" && (editorialStoryNumber === 2 || editorialStoryNumber === 5);
  const isAkhandCompactAuthorArticle =
    Boolean(settings.editorialPageStyle) &&
    (isAkhandEditorialCompactAuthorArticle || isAkhandVicharManthanCompactAuthorArticle);
  const isAkhandSecondaryCompactAuthorArticle =
    (editorialTemplateId === "AkhandEditorial5A" && editorialStoryNumber === 4) ||
    (editorialTemplateId === "AkhandVicharManthan6A" && editorialStoryNumber === 5);
  const isAkhandBodyStartCompactAuthorArticle = isAkhandCompactAuthorArticle;
  const isAkhandTightPrimaryCompactAuthorArticle =
    editorialTemplateId === "AkhandVicharManthan6A" && editorialStoryNumber === 2;
  const hasAkhandEditorialAuthorIdentity =
    isAkhandCompactAuthorArticle &&
    Boolean((articleData.editorPortraitUrl ?? "").trim() || (articleData.editorName ?? "").trim());

  for (const region of settings.reservedRegions ?? []) {
    if (isEditorialLeaderArticle || isAkhandCompactAuthorArticle) {
      continue;
    }

    obstacleRects.push({
      x: region.x - articleBox.x - inset,
      y: region.y - articleBox.y,
      width: region.width,
      height: region.height,
    });
  }

  if (
    hasAkhandEditorialAuthorIdentity
  ) {
    const authorBlock = getAuthorBlock({
      x: articleBox.x,
      y: articleBox.y,
      width: articleBox.width,
      height: articleBox.height,
      // Tight-primary's offset here MUST match `resolveAuthorBlock`'s own
      // topOffset for the same card in AuthorBlockGeometry.ts -- one feeds
      // the draw path, this one feeds text-avoidance, and `getAuthorBlock`
      // now uses this value directly (no internal floor/lift for this
      // case), so drifting the two out of sync means text avoids a
      // rectangle that isn't where the portrait actually is.
      topOffset: isAkhandBodyStartCompactAuthorArticle
        ? bodyY
        : headline.y +
          headline.height -
          articleBox.y +
          (isAkhandSecondaryCompactAuthorArticle ? 7 : -10),
      columnSpan: Math.max(1, (articleBox as any).columnSpan ?? 4),
      compactPassport: true,
      compactBodyAlignedPassport: isAkhandSecondaryCompactAuthorArticle,
      compactBodyStartPassport: isAkhandBodyStartCompactAuthorArticle,
      compactTightPrimaryPassport: isAkhandTightPrimaryCompactAuthorArticle,
      hasSummary: false,
    });
    const pushAuthorObstacle = (rect: { x: number; y: number; width: number; height: number }) => {
      const rawX = rect.x - articleBox.x - inset;
      const clippedLeft = Math.max(0, -rawX);
      const localX = Math.max(0, rawX);
      const localWidth = Math.max(0, rect.width - clippedLeft);
      if (localWidth <= 0 || rect.height <= 0) return;

      obstacleRects.push({
        x: localX,
        y: rect.y - articleBox.y,
        width: localWidth,
        height: rect.height,
      });
    };

    const authorWrapGutter = isAkhandBodyStartCompactAuthorArticle ? 10 : 1;
    const authorStackBottom = Math.max(
      authorBlock.portrait.y + authorBlock.portrait.height,
      authorBlock.namePlate.y + authorBlock.namePlate.height,
    );
    const authorObstacleBottom = isAkhandBodyStartCompactAuthorArticle
      ? snapToBaseline(authorStackBottom - articleBox.y, lineAdvanceGrid, "ceil") + articleBox.y
      : Math.max(
          authorBlock.portrait.y + authorBlock.portrait.height,
          snapToBaseline(authorStackBottom - articleBox.y, lineAdvanceGrid, "floor") + articleBox.y,
        );

    pushAuthorObstacle({
      x: authorBlock.portrait.x,
      y: authorBlock.portrait.y,
      width: authorBlock.portrait.width + authorWrapGutter,
      height: Math.max(0, authorObstacleBottom - authorBlock.portrait.y),
    });
  }

  if (
    isEditorialLeaderArticle &&
    ((articleData.editorPortraitUrl ?? "").trim() || (articleData.editorName ?? "").trim())
  ) {
    const leaderBlock = getAuthorBlock({
      x: articleBox.x,
      y: articleBox.y,
      width: articleBox.width,
      height: articleBox.height,
      topOffset: headline.y + headline.height,
      columnSpan: 1,
      hasSummary: false,
    });
    const leaderWrapGutter = 1;
    const leaderNamePlateBottom = leaderBlock.namePlate.y + leaderBlock.namePlate.height;
    const leaderObstacleBottom = Math.max(
      leaderBlock.portrait.y + leaderBlock.portrait.height,
      snapToBaseline(
        leaderNamePlateBottom - articleBox.y,
        lineAdvanceGrid,
        "floor",
      ) + articleBox.y,
    );

    obstacleRects.push({
      x: leaderBlock.portrait.x - articleBox.x - inset,
      y: leaderBlock.portrait.y - articleBox.y,
      width: leaderBlock.portrait.width + leaderWrapGutter,
      height: Math.max(0, leaderObstacleBottom - leaderBlock.portrait.y),
    });
  }

  if (editorialFloatImage) {
    const wrapOffset = 6;
    obstacleRects.push({
      x: editorialFloatImage.x - inset - wrapOffset,
      y: editorialFloatImage.y - wrapOffset,
      width: editorialFloatImage.width + wrapOffset * 2,
      height: editorialFloatImage.height + wrapOffset * 2,
    });
  }

  const imageObstacleRects = image
    ? [
        {
          x: image.x - inset,
          y: image.y,
          width: image.width,
          height: imageObstacle.height,
        },
      ]
    : [];

  if (image && caption && captionConsumesVerticalSpace) {
    imageObstacleRects.push({
      x: caption.x - inset,
      y: caption.y,
      width: caption.width,
      height: caption.height,
    });
  }

  const regionResult = generateTextRegions({
    articleWidth: contentWidth,
    articleHeight: articleBox.height,
    columnCount: safeColumnCount,
    columnGap,
    imageRect: {
      x: image ? image.x - inset : 0,
      y: image ? image.y : bodyY,
      width: image ? image.width : 0,
      height: imageObstacle.height,
    },
    imageObstacleRects,
    obstacleRects,
  });
  // Regions are snapped to the page's small baseline grid unit (gridSize),
  // but flowLinesThroughRegions divides each region's height by the actual
  // per-line advance (bodyLineHeight — typically a multiple of gridSize
  // greater than 1x) to decide how many lines fit. Snapping to only the
  // smaller unit can still leave a fractional-line remainder unaccounted
  // for — e.g. a region cleanly snapped to 150pt on a 6pt grid still wastes
  // 6pt against a 12pt line advance, since 150 isn't itself a multiple of
  // 12. That leftover surfaces as an unexpected gap wherever a story's body
  // text flows across more than one region — most visibly when a
  // newspaper-wrapped image (touching a side edge) splits every column into
  // an above/below region pair around it. Snapping to a grid keyed on the
  // real line advance instead removes the remainder at the source, so
  // consecutive regions in the same column flow with no gap between them.
  // Distance from a body line's box top down to where its ink actually starts:
  // half the leading, plus the font's reserved ascent that a capital does not
  // reach. Measured, not assumed -- the same reason the headline's descender
  // reclaim is measured. Sampled with a capital because body copy opens with
  // one. Clamped to half an em so an unusual face cannot yank the column up.
  const bodyFirstLineCapGap = (() => {
    if (!settings.tightBylineToBodyGap && !tightWideEightColumnBylineToBodyGap) return 0;
    const ink = measureTextInkMetrics({
      text: "H",
      fontFamily: resolvedBodyStyle.fontFamily,
      fontSize: resolvedBodyStyle.fontSize,
      fontStyle: resolvedBodyStyle.fontStyle,
    });
    if (!ink) return 0;
    const halfLeading = Math.max(
      0,
      (getLineHeightPx(resolvedBodyStyle) - resolvedBodyStyle.fontSize) / 2,
    );
    return Math.max(
      0,
      Math.min(halfLeading + ink.fontAscent - ink.actualAscent, resolvedBodyStyle.fontSize * 0.5),
    );
  })();
  const initialBodyRegions = regionResult.regions.flatMap((region) => {
    const articleRegion = shiftRegionX(region, inset);
    const clipped = intersectRegion(articleRegion, {
      x: inset,
      y: bodyY,
      width: contentWidth,
      height: bodyHeight,
    });
    const baselineRegion = clipped ? snapRegionToBaseline(clipped, lineAdvanceGrid) : null;

    return baselineRegion ? [baselineRegion] : [];
  })
    // Optical alignment of body copy against a photo sharing its top edge.
    //
    // An image is drawn flush to its rectangle, so its top edge IS the region
    // top. Text is not: a line is positioned by its baseline, and above that
    // sit half the leading and the gap between the font's ascent and the real
    // cap height -- neither of which contains ink. Placing both at the same y
    // therefore aligns the boxes while leaving the visible letter-tops sitting
    // a few points below the photo.
    //
    // Lifting every body region by that same constant puts the first line's
    // ink level with the image. Applied uniformly after the baseline snap, so
    // all columns move together and stay row-aligned with each other -- the
    // grid's origin shifts, its rhythm does not.
    .map((region) => {
      if (!bodyFirstLineCapGap) return region;
      return {
        ...region,
        y: region.y - bodyFirstLineCapGap,
        height: region.height + bodyFirstLineCapGap,
      };
    });
  const compactHeadlineByline =
    Boolean(settings.frontPageStyle) && !hasSubheadlineText && !shouldShowInlineSubheadline;
  const frontPageImageLeadRegions =
    settings.frontPageStyle && image
      ? initialBodyRegions
          .map((region, index) => ({ region, index }))
          .filter(({ region }) => {
            const bylineBandHeight = Math.max(
              bylineMetrics.consumedHeight + BYLINE_DIVIDER_GAP + BYLINE_DIVIDER_TO_BODY,
              bodyLineHeight,
            );
            return !rectsOverlap(
              {
                x: region.x,
                y: compactHeadlineByline ? contentStartY : region.y,
                width: region.width,
                height: Math.min(region.height, bylineBandHeight),
              },
              image,
            );
          })
      : [];
  const firstColumnX =
    initialBodyRegions.length > 0
      ? Math.min(...initialBodyRegions.map((region) => region.x))
      : 0;
  const firstColumnWidth =
    initialBodyRegions.find((region) => Math.abs(region.x - firstColumnX) <= 0.5)?.width ??
    columnWidth;
  const firstColumnRight = firstColumnX + firstColumnWidth;
  const realFirstColumnLeadRegions =
    frontPageImageLeadRegions.length > 0
      ? frontPageImageLeadRegions.filter(({ region }) => Math.abs(region.x - firstColumnX) <= 0.5)
      : [];
  const realFirstColumnBelowImageRegions =
    settings.frontPageStyle && image
      ? initialBodyRegions
          .map((region, index) => ({ region, index }))
          .filter(({ region }) =>
            Math.abs(region.x - firstColumnX) <= 0.5 &&
            region.y >= image.y + image.height - 0.5,
          )
      : [];
  const imageOccupiesFirstColumn =
    Boolean(image) &&
    rangesOverlap(firstColumnX, firstColumnRight, image!.x, image!.x + image!.width);
  const imageStartsFirstColumn =
    resolvedImageSettings.imageAlignment === "top-left" ||
    resolvedImageSettings.imageAlignment === "left";
  const forceBylineBelowFirstColumnImage = Boolean(
    image && (imageStartsFirstColumn || imageOccupiesFirstColumn),
  );
  const leadRegionCandidates = forceBylineBelowFirstColumnImage && realFirstColumnBelowImageRegions.length > 0
    ? realFirstColumnBelowImageRegions
    : realFirstColumnLeadRegions.length > 0
    ? realFirstColumnLeadRegions
    : realFirstColumnBelowImageRegions.length > 0
      ? realFirstColumnBelowImageRegions
    : frontPageImageLeadRegions.length > 0
      ? frontPageImageLeadRegions
    : initialBodyRegions.map((region, index) => ({ region, index }));
  const leadRegionIndex = (shouldShowInlineSubheadline || bylineText) && leadRegionCandidates.length > 0
    ? leadRegionCandidates.reduce((selectedEntry, entry) => {
        const region = entry.region;
        const selected = selectedEntry.region;
        if (!selected) {
          return entry;
        }

        if (region.x < selected.x - 0.5) {
          return entry;
        }

        if (Math.abs(region.x - selected.x) <= 0.5 && region.y < selected.y) {
          return entry;
        }

        return selectedEntry;
      }).index
    : -1;
  const rawLeadRegion = leadRegionIndex >= 0 ? initialBodyRegions[leadRegionIndex] : undefined;

  const inlineSubheadline: ArticleLayoutTextBlock[] = [];
  let currentLeadY = rawLeadRegion ? rawLeadRegion.y : 0;
  let remainingLeadHeight = rawLeadRegion ? rawLeadRegion.height : 0;
  let inlineConsumedHeight = 0;

  if (shouldShowInlineSubheadline && rawLeadRegion && candidateBullets.length > 0) {
    const inlineBulletStyle: ArticleTextStyle = {
      ...resolvedBodyStyle,
      fontSize: Math.min(10.5, Math.max(9, Math.round(resolvedBodyStyle.fontSize * 1.15 * 10) / 10)),
      lineHeight: 1.25,
      fontStyle: "bold",
      fill: articleData.inlineSubheadingColor || "#18181b",
      align: "left",
      wrap: "word",
    };
    const inlineLineAdvance = getBaselineLineAdvance(getLineHeightPx(inlineBulletStyle), baselineGrid);
    const inlineSubheadlineToBodyGap = Math.max(2, Math.round(inlineBulletStyle.fontSize * 0.25));
    const minReserveForBody = Math.max(35, bodyLineHeight * 2);

    // Measure every candidate bullet (capped at 2, the max this block ever
    // rendered) up front, then decide ONCE whether the complete set fits —
    // never render a partial set. The previous per-bullet loop placed
    // bullets greedily and always forced the first one in regardless of
    // room (`|| inlineSubheadline.length === 0`), so a box just tall enough
    // for bullet 1 but not bullet 2 silently dropped the second one — a
    // real newswire item's 2-bullet summary reading as if it only ever had
    // one, with no visible sign anything was cut. All-or-nothing means a box
    // too short for the full set shows no inline bullets at all, and the
    // byline/body naturally reclaim that space (byline.y already derives
    // from wherever currentLeadY actually ends up, not a fixed slot — see
    // bylineRegion below — so skipping bullets here leaves no gap).
    const measuredBullets = candidateBullets
      .slice(0, 2)
      .map((rawBullet) => rawBullet.replace(/^[•*\-•]\s*/u, "").trim())
      .filter(Boolean)
      .map((cleanBullet) => {
        const dotWidth = Math.max(3.5, inlineBulletStyle.fontSize * 0.45);
        const gap = Math.max(2.5, inlineBulletStyle.fontSize * 0.3);
        const hangingIndent = dotWidth + gap;
        const bulletMetrics = measureParagraph({
          text: cleanBullet,
          width: rawLeadRegion.width - hangingIndent,
          fontFamily: inlineBulletStyle.fontFamily,
          fontSize: inlineBulletStyle.fontSize,
          fontStyle: inlineBulletStyle.fontStyle,
          lineHeight: inlineBulletStyle.lineHeight,
          maxLines: 4,
          script: "mixed",
        });
        const consumedHeight = bulletMetrics.wrappedLines.length * inlineLineAdvance;
        return { cleanBullet, dotWidth, hangingIndent, bulletMetrics, blockPlusGap: consumedHeight + inlineSubheadlineToBodyGap };
      });
    const projectedTotalHeight = measuredBullets.reduce((sum, m) => sum + m.blockPlusGap, 0);
    const allBulletsFit =
      measuredBullets.length > 0 && remainingLeadHeight - projectedTotalHeight >= minReserveForBody;

    if (allBulletsFit) {
      for (const { cleanBullet, dotWidth, hangingIndent, bulletMetrics, blockPlusGap } of measuredBullets) {
        const bulletBlock = createTextBlock(
          rawLeadRegion.x + hangingIndent,
          currentLeadY,
          rawLeadRegion.width - hangingIndent,
          cleanBullet,
          inlineBulletStyle,
          bulletMetrics,
          baselineGrid,
        );

        const updatedLineBoxes = [...bulletBlock.lineBoxes];
        if (updatedLineBoxes.length > 0) {
          const firstLine = updatedLineBoxes[0];
          const dotSegment = {
            x: rawLeadRegion.x,
            y: firstLine.y,
            width: dotWidth,
            height: firstLine.height,
            text: "•",
            role: "byline-dot" as const,
            style: { ...inlineBulletStyle, fill: articleData.inlineSubheadingColor || "#b42318", wrap: "none" as const },
          };
          const textSegment = {
            x: firstLine.x,
            y: firstLine.y,
            width: firstLine.width,
            height: firstLine.height,
            text: firstLine.text,
            style: { ...inlineBulletStyle, wrap: "none" as const },
          };
          updatedLineBoxes[0] = {
            ...firstLine,
            segments: [dotSegment, textSegment],
          };
        }

        inlineSubheadline.push({
          ...bulletBlock,
          x: rawLeadRegion.x,
          width: rawLeadRegion.width,
          lineBoxes: updatedLineBoxes,
        });
        currentLeadY += blockPlusGap;
        inlineConsumedHeight += blockPlusGap;
        remainingLeadHeight -= blockPlusGap;
      }
    }
  }

  const bylineDividerGap = settings.frontPageStyle
    ? isBottomFrontThreeColumnPackage ? 5 : 2.5
    : BYLINE_DIVIDER_GAP;
  const bylineDividerToBody = settings.frontPageStyle
    ? isBottomFrontThreeColumnPackage ? 5 : 2.5
    : BYLINE_DIVIDER_TO_BODY;
  // The inline-bullet block above already reserves its own small gap after
  // its last line (inlineSubheadlineToBodyGap), which is right for the space
  // between bullets but reads as flush between the last bullet and the
  // byline beneath it. headlineToBylineExtraGap opts a story into a bit more
  // clearance there too -- 0 everywhere it isn't set, so this only ever
  // moves the boxes that ask for it.
  const forcedBylineY =
    rawLeadRegion && image && forceBylineBelowFirstColumnImage
      ? Math.max(currentLeadY, image.y + image.height + Math.max(2, bylineDividerToBody))
      : currentLeadY + (shouldShowInlineSubheadline ? headlineToBylineExtraGap : 0);
  const shouldUseCompactBylineY = (compactHeadlineByline || (settings.tightBylineToBodyGap && !shouldShowInlineSubheadline)) && !forceBylineBelowFirstColumnImage;
  const bylineRegion = leadRegionIndex >= 0 && rawLeadRegion
    ? {
        ...rawLeadRegion,
        y: shouldUseCompactBylineY ? contentStartY : forcedBylineY,
        height: shouldUseCompactBylineY
          ? Math.max(0, rawLeadRegion.y + rawLeadRegion.height - contentStartY)
          : Math.max(0, rawLeadRegion.y + rawLeadRegion.height - forcedBylineY),
      }
    : undefined;
  const bylineReserveRawHeight = bylineMetrics.consumedHeight + bylineDividerGap + bylineDividerToBody;
  const bylineReserveHeight =
    bylineRegion && bylineText
      ? snapMeasurementToBaseline(
          bylineReserveRawHeight,
          settings.frontPageStyle && !isSingleColumnBox ? lineAdvanceGrid : baselineGrid,
          "ceil",
        )
      : 0;
  byline = bylineRegion && bylineText
    ? applyNewspaperBylineSegments(createTextBlock(
        bylineRegion.x,
        bylineRegion.y,
        bylineRegion.width,
        bylineText,
        bylineStyle,
        {
          ...bylineMetrics,
          overflow: false,
        },
        compactHeadlineByline ? { gridSize: 1 } : baselineGrid,
      ), bylineStyle)
    : byline;

  if (settings.tightBylineToBodyGap && byline.text) {
    let minX = Number.MAX_VALUE;
    let maxX = Number.MIN_VALUE;
    const segments = byline.lineBoxes[0]?.segments || [];
    for (const seg of segments) {
      minX = Math.min(minX, seg.x);
      maxX = Math.max(maxX, seg.x + seg.width);
    }
    const textWidth = segments.length > 0 ? maxX - minX : (bylineMetrics.lines[0]?.width || byline.width);
    const textX = segments.length > 0 ? minX : byline.x + (byline.width - textWidth) / 2;
    const paddingTop = 6;

    const tightByline = {
      ...byline,
      x: textX,
      y: byline.y + paddingTop,
      width: textWidth,
      lineBoxes: byline.lineBoxes.map(line => ({
        ...line,
        y: line.y + paddingTop,
        segments: (line.segments || []).map(seg => ({
          ...seg,
          y: seg.y + paddingTop
        }))
      }))
    };

    byline = applyContainerStyleToTextBlock(tightByline, {
      mode: "container",
      frameMode: "text-only",
      contentHorizontalAlignment: "center",
      contentVerticalAlignment: "middle",
      minimumFrameHeight: 0,
      minimumFrameWidth: 0,
      autoFrameHeight: true,
      framePaddingTop: 0,
      framePaddingBottom: 0,
      framePaddingLeft: 0,
      framePaddingRight: 0,
      frameBorderWidth: 0,
      frameBorderColor: "transparent",
      frameBorderStyle: "solid",
      frameBackgroundColor: "transparent",
      frameRadius: 0,
      frameOpacity: 1,
      containerBackgroundColor: "#1797d8",
      containerOpacity: 1,
      containerPaddingTop: 6,
      containerPaddingBottom: 2,
      containerPaddingLeft: 10,
      containerPaddingRight: 10,
      containerBorderWidth: 0,
      containerBorderColor: "transparent",
      containerBorderRadius: 2,
    });
    bylineDivider = null;
  } else {
    bylineDivider = bylineRegion && byline.text
      ? {
          x: Math.max(bylineRegion.x, byline.x - 16),
          y: Math.round(byline.y + byline.height + bylineDividerGap),
          width: Math.min(bylineRegion.width, byline.width + 32),
          strokeWidth: 0.8,
          color: "#29251f",
          style: "dotted",
          dotSize: 0.8,
          dotSpacing: 1.2,
        }
      : null;
  }
  const rawTotalLeadHeight =
    compactHeadlineByline && rawLeadRegion && byline.text
      ? isSingleColumnBox
        ? Math.max(
            0,
            byline.y + byline.height + bylineDividerGap + bylineDividerToBody - rawLeadRegion.y,
          )
        : // Measured off the byline's real ink, like every other branch here.
          // `bylineReserveHeight` is itself already ceil-snapped to the grid,
          // and `totalLeadConsumedHeight` below ceil-snaps whatever this
          // yields a second time -- so taking the reserve instead of the ink
          // rounds up twice and leaves up to two empty grid rows between the
          // byline and the body. That only ever showed with the image on the
          // right (a left/first-column image, or any of the "tight" flags,
          // used to route here through the ink-measured branch above instead)
          // -- ink-measuring unconditionally removes the gap for every case,
          // not just the ones already known to hit it. The outer snap still
          // lands the body on the baseline grid, so columns stay row-aligned.
          Math.max(
            0,
            byline.y +
              byline.height +
              bylineDividerGap +
              (tightWideEightColumnBylineToBodyGap ? 0.5 : bylineDividerToBody) -
              rawLeadRegion.y,
          )
      : bylineRegion && rawLeadRegion && byline.text
        ? Math.max(
            0,
            byline.y + byline.height + bylineDividerGap + bylineDividerToBody - rawLeadRegion.y,
          )
        : inlineConsumedHeight + bylineReserveHeight;
  const totalLeadConsumedHeight = rawTotalLeadHeight > 0
    ? tightWideEightColumnBylineToBodyGap
      ? rawTotalLeadHeight
      : snapMeasurementToBaseline(
          rawTotalLeadHeight,
          settings.frontPageStyle && !isSingleColumnBox ? lineAdvanceGrid : baselineGrid,
          "ceil",
        )
    : 0;
  const bodyRegions =
    totalLeadConsumedHeight > 0
      ? [
          ...initialBodyRegions.slice(leadRegionIndex, leadRegionIndex + 1),
          ...initialBodyRegions.slice(0, leadRegionIndex),
          ...initialBodyRegions.slice(leadRegionIndex + 1),
        ]
          .map((region, index) =>
            index === 0
              ? {
                  ...region,
                  y: region.y + totalLeadConsumedHeight,
                  height: Math.max(0, region.height - totalLeadConsumedHeight),
                }
              : region,
          )
          .filter((region) => region.height >= bodyLineHeight)
      : initialBodyRegions;
  const regionUsabilityRules: RegionUsabilityRules = {
    minRegionWidth: Math.max(1, columnWidth * 0.2),
    minRegionLines: 1,
  };
  const enableBodyDropCap = Boolean(settings.enableDropCap || hasAkhandEditorialAuthorIdentity);
  const dropCapComposition = composeDropCap({
    enabled: enableBodyDropCap,
    text: bodyText,
    regions: bodyRegions,
    bodyStyle: resolvedBodyStyle,
    lineHeight: bodyLineHeight,
  });
  const bodyFlow = createBodyColumns(
    dropCapComposition.text,
    enableBodyDropCap ? dropCapComposition.text : bodyRichContent,
    dropCapComposition.regions,
    regionUsabilityRules,
    baselineGrid,
    resolvedBodyStyle,
    typographyControls,
    isLowerFrontPagePackage ? 0.18 : 1,
    // Re-wrap per region on the editorial page only, where a box's copy runs
    // around a portrait and its regions are therefore different widths. Every
    // other page's regions are equal-width columns, so the single wrap they
    // have always used produces exactly the same lines.
    Boolean(settings.editorialPageStyle),
    Boolean(settings.suppressBodySegments),
    Boolean(settings.englishBodyHyphenation && articleBox.contentLanguage === "english"),
    Boolean(settings.constrainBodySegments && articleBox.contentLanguage === "english"),
    settings.bodyColumnEdgeInsetPt ?? 0,
    Boolean(settings.nativeBodyJustifyText && articleBox.contentLanguage === "english"),
  );
  const generatedColumnIndexes = new Set(bodyRegions.map((region) => region.columnIndex));
  const usableColumnIndexes = new Set(bodyFlow.flow.regions.map((region) => region.region.columnIndex));
  const usedColumns = usableColumnIndexes.size;
  const unusedColumns = Math.max(0, safeColumnCount - generatedColumnIndexes.size);
  const bodyWhitespaceRatio = getBodyWhitespaceRatio({
    totalCapacity: bodyFlow.flow.totalCapacity,
    visibleLineCount: bodyFlow.flow.visibleLineCount,
    remainingLineCount: bodyFlow.flow.remainingLineCount,
  });
  const imageArea = image ? image.width * image.height : 0;
  const storyArea = Math.max(1, articleBox.width * articleBox.height);
  const imageCoveragePercent = Math.round((imageArea / storyArea) * 1000) / 10;
  const headlineTextWidth = headlineMetrics.consumedWidth;
  const headlineFillPercent = Math.round((headlineTextWidth / Math.max(1, headlineMeasureWidth)) * 1000) / 10;
  const getHeadlineLineFillPercent = (lineIndex: number) =>
    Math.round(((headlineMetrics.lines[lineIndex]?.width ?? 0) / Math.max(1, headlineMeasureWidth)) * 1000) / 10;
  const headlineRenderedLines = headline.lineBoxes.map((line) => line.text);
  const headlineLineWidths = headlineMetrics.lines.map((line) => Math.round(line.width * 10) / 10);
  const headlineLineOverflowPx = headlineMetrics.lines.map((line) =>
    Math.round(Math.max(0, line.width - headlineMeasureWidth) * 10) / 10,
  );
  const headlineUnusedPixels =
    Math.round(
      headlineMetrics.lines.reduce(
        (sum, line) => sum + Math.max(0, headlineMeasureWidth - line.width),
        0,
      ) * 10,
    ) / 10;
  const headlineAverageFillPercent =
    headlineMetrics.lines.length > 0
      ? Math.round(
          (headlineMetrics.lines.reduce(
            (sum, line) => sum + line.width / Math.max(1, headlineMeasureWidth),
            0,
          ) /
            headlineMetrics.lines.length) *
            1000,
        ) / 10
      : 0;
  const debugTextRegions = [...bodyFlow.flow.regions, ...bodyFlow.flow.discardedRegions]
    .sort((a, b) => a.region.order - b.region.order)
    .map((region) => ({
      id: region.id,
      status: region.status,
      x: region.region.x,
      y: region.region.y,
      width: region.region.width,
      height: region.region.height,
      area: region.area,
      order: region.region.order,
      columnIndex: region.region.columnIndex,
      capacity: region.maxLines,
      assignedLineCount: region.assignedLineCount,
      remainingCapacity: region.remainingCapacity,
      discardReasons: "discardReasons" in region ? region.discardReasons : [],
    }));
  const density = calculateEditorialDensity({
    storyHeight: articleBox.height,
    storyTopPadding: topInset,
    storyBottomPadding: bottomInset,
    bodyY,
    bodyHeight,
    bodyColumns: bodyFlow.columns,
    visibleLineCount: bodyFlow.flow.visibleLineCount,
    remainingLineCount: bodyFlow.flow.remainingLineCount,
    totalLineCapacity: bodyFlow.flow.totalCapacity,
  });
  const compositionOverflow =
    headline.overflow ||
    subheadline.overflow ||
    Boolean(caption?.textBlock.overflow || caption?.creditBlock?.overflow || caption?.sourceBlock?.overflow) ||
    bodyFlow.flow.overflow;
  const fitMetrics = createFitMetricsFromComposition({
    articleBox,
    density,
    textArea: getTextArea(bodyFlow.columns),
    imageArea,
    remainingLineCount: bodyFlow.flow.remainingLineCount,
    totalLineCount: bodyFlow.flow.visibleLineCount + bodyFlow.flow.remainingLineCount,
    overflow: compositionOverflow,
  });
  const fitStatus = getEditorialFitStatus(fitMetrics);

  // ── Decorative Dotted Dividers ────────────────────────────────────────────
  // Randomly add 1–2 small close-packed dotted horizontal rules to approximately
  // 1/3 of stories (newspaper Dainik Bhaskar / Rajasthan Patrika style).
  // Rules are placed in body column gaps, never in headlines or images.
  const captionTextBottom = caption?.textBlock.lineBoxes.reduce(
    (bottom, line) => Math.max(bottom, line.y + line.height),
    caption.textBlock.y,
  );
  const captionDivider: ArticleDecorativeDivider | null =
    caption && image && articleData.caption.position === "below-image"
      ? {
          x: caption.x,
          y: (captionTextBottom ?? caption.textBlock.y + caption.textBlock.height) + 0.15,
          width: caption.width,
          strokeWidth: 0.5,
          color: "#3a352f",
          style: "solid",
          dotSize: 0,
          dotSpacing: 0,
        }
      : null;
  const decorativeDividers: ArticleDecorativeDivider[] = [bylineDivider, captionDivider].filter(
    (divider): divider is ArticleDecorativeDivider => divider !== null,
  );
  {
    const seed = Math.abs(Math.round(articleBox.x * 7 + articleBox.y * 13));
    const rand1 = (Math.sin((seed + 1) * 17.3171) * 43758.5453);
    const rand1n = rand1 - Math.floor(rand1);
    const dividerRatio = clamp(settings.selectiveDividerLineRatio ?? DEFAULT_SELECTIVE_DIVIDER_RATIO, 0, 1);
    const storyDecorationIndex = settings.storyDecorationIndex;
    const storyDecorationCount = settings.storyDecorationCount;
    const pageOrderSelected =
      dividerRatio > 0 &&
      (typeof storyDecorationIndex === "number" && typeof storyDecorationCount === "number"
        ? storyDecorationIndex % Math.max(1, Math.round(1 / Math.max(0.01, dividerRatio))) === 0
        : rand1n < dividerRatio);
    const lineCrossesBodyText = (y: number, x: number, width: number) =>
      bodyFlow.columns.some((column) =>
        column.lines.some((line) => {
          const horizontalOverlap = rangesOverlap(x, x + width, line.x, line.x + line.width);
          const verticalOverlap = rangesOverlap(y - 3, y + 3, line.y, line.y + line.height);

          return horizontalOverlap && verticalOverlap;
        }),
      );
    const lineCrossesImage = (y: number, x: number, width: number) =>
      Boolean(
        image &&
          rangesOverlap(x, x + width, image.x, image.x + image.width) &&
          rangesOverlap(y - 3, y + 3, image.y, image.y + image.height),
      );
    const addDivider = (x: number, y: number, width: number) => {
      const safeY = Math.round(y);
      const safeWidth = Math.max(24, width);

      if (
        safeY > topInset + 20 &&
        safeY < articleBox.height - bottomInset - 8 &&
        safeWidth >= 60 &&
        !lineCrossesImage(safeY, x, safeWidth) &&
        !lineCrossesBodyText(safeY, x, safeWidth)
      ) {
        decorativeDividers.push({
          x,
          y: safeY,
          width: safeWidth,
          strokeWidth: 0.5,
          color: "#29251f",
          style: "solid",
          dotSize: 0,
          dotSpacing: 0,
        });
      }
    };
    const storyLooksDense =
      priority === "lead" ||
      priority === "major" ||
      bodyFlow.flow.visibleLineCount >= 8 ||
      Boolean(image && caption);

    if (
      settings.selectiveDividerLinesEnabled !== false &&
      pageOrderSelected &&
      priority !== "brief" &&
      priority !== "filler" &&
      storyLooksDense
    ) {
      if (caption && image && !captionDivider) {
        addDivider(caption.x + 8, caption.y + caption.height + 3, Math.max(1, Math.min(caption.width, image.width) - 16));
      } else if (image) {
        addDivider(image.x + 8, image.y + image.height + 4, image.width - 16);
      } else if (subheadline.text) {
        addDivider(inset, subheadline.y + subheadline.height + 4, contentWidth);
      }
    }
  }

  // The rounded outline is half of the narrow-column badge design — it only
  // reads correctly paired with the pill. Requiring an actually-rendered
  // kicker keeps the two together on every 1-2 col box that gets the
  // treatment, instead of leaving an orphan border on boxes whose story
  // carries no kicker text.
  let finalContainerStyles = containerStyles;
  // `containerStyles.article` is optional — fall back to the engine default so
  // the outline still applies on stories that carry no explicit article style.
  const baseArticleContainerStyle = containerStyles.article ?? defaultContainerStyles.article;
  if (!settings.suppressArticleContainerBorder && isNarrowKicker && kicker && baseArticleContainerStyle) {
    finalContainerStyles = {
      ...containerStyles,
      article: {
        ...baseArticleContainerStyle,
        containerBorderColor: "#000000",
        containerBorderWidth: 1,
        containerBorderRadius: 6,
      },
    };
  } else if (!settings.suppressArticleContainerBorder && (priority === "brief" || priority === "filler") && baseArticleContainerStyle) {
    // A brief/filler box reads as a distinct "boxed" item on a real
    // newspaper page — a plain hairline rule framing it, sharp corners (real
    // print boxes are never rounded, unlike the narrow-kicker badge above,
    // which is a deliberately different, rounded pill treatment).
    finalContainerStyles = {
      ...containerStyles,
      article: {
        ...baseArticleContainerStyle,
        containerBorderColor: "#1a1a1a",
        containerBorderWidth: 1,
        containerBorderRadius: 0,
      },
    };
  }

  return {
    kicker,
    strap,
    headline,
    subheadlineBackground,
    subheadline,
    inlineSubheadline: inlineSubheadline.length > 0 ? inlineSubheadline : undefined,
    byline,
    image,
    editorialFloatImage,
    factBox,
    pullQuote,
    caption,
    decorativeDividers: decorativeDividers.length > 0 ? decorativeDividers : undefined,
    body: {
      x: inset,
      y: bodyY,
      width: contentWidth,
      height: bodyHeight,
      text: bodyText,
      wrappedLines: bodyFlow.flow.visibleLines,
      lineCount: bodyFlow.flow.visibleLineCount,
      remainingLineCount: bodyFlow.flow.remainingLineCount,
      overflow: bodyFlow.flow.overflow,
      dropCap: dropCapComposition.dropCap,
      columns: bodyFlow.columns,
    },
    debugTextRegions: settings.showRegionDebug ? debugTextRegions : [],
    paragraphBounds: createParagraphLayoutBounds(bodyFlow.columns),
    containerStyles: finalContainerStyles,
    metrics: {
      headlineLines: headline.lineCount,
      bodyLines: bodyFlow.flow.visibleLineCount + bodyFlow.flow.remainingLineCount,
      visibleLines: bodyFlow.flow.visibleLineCount,
      hiddenLines: bodyFlow.flow.remainingLineCount,
      overflow: compositionOverflow,
      editorialFitScore: fitStatus === "PERFECT" ? 100 : fitStatus === "GOOD" ? 92 : fitStatus === "NEEDS_FIT" ? 82 : 60,
      fillPercentage: fitMetrics.fillPercentage,
      whitespacePercentage: fitMetrics.whitespacePercentage,
      overflowPercentage: fitMetrics.overflowPercentage,
      fitStatus,
      storyDensityPercent: density.storyDensityPercent,
      internalWhitespacePercent: density.internalWhitespacePercent,
      bodyFillPercent: density.bodyFillPercent,
      unusedVerticalSpace: density.unusedVerticalSpace,
      bodyWhitespacePercent: Math.round(bodyWhitespaceRatio * 1000) / 10,
      averageSpacing: bodyFlow.compositionDiagnostics.averageSpacing,
      minimumSpacing: bodyFlow.compositionDiagnostics.minimumSpacing,
      maximumSpacing: bodyFlow.compositionDiagnostics.maximumSpacing,
      spacingVariance: bodyFlow.compositionDiagnostics.spacingVariance,
      compositionPasses: bodyFlow.compositionDiagnostics.compositionPasses,
      wordsMoved: bodyFlow.compositionDiagnostics.wordsMoved,
      bodyCompositionBadnessScore: bodyFlow.compositionDiagnostics.badnessScore,
      bodyFinalLineWidths: bodyFlow.compositionDiagnostics.finalLineWidths,
      paragraphCandidatesTested: bodyFlow.compositionDiagnostics.paragraphCandidatesTested,
      selectedParagraphCandidate: bodyFlow.compositionDiagnostics.selectedCandidate,
      riverScore: bodyFlow.compositionDiagnostics.riverScore,
      widowScore: bodyFlow.compositionDiagnostics.widowScore,
      orphanScore: bodyFlow.compositionDiagnostics.orphanScore,
      paragraphQuality: bodyFlow.compositionDiagnostics.paragraphQuality,
      hjParagraphQuality: bodyFlow.compositionDiagnostics.paragraphQuality,
      hjGrayValue: bodyFlow.compositionDiagnostics.grayValue,
      hjGrayBalanceScore: bodyFlow.compositionDiagnostics.grayBalanceScore,
      hjAverageTracking: bodyFlow.compositionDiagnostics.averageTracking,
      hjTrackingVariance: bodyFlow.compositionDiagnostics.trackingVariance,
      hjGapVariance: bodyFlow.compositionDiagnostics.gapVariance,
      hjHyphenCount: bodyFlow.compositionDiagnostics.hyphenCount,
      hjOptimizationPasses: bodyFlow.compositionDiagnostics.optimizationPasses,
      hjRejectedCandidates: bodyFlow.compositionDiagnostics.rejectedCandidates,
      hjAcceptedCandidates: bodyFlow.compositionDiagnostics.acceptedCandidates,
      hjParagraphCandidates: bodyFlow.compositionDiagnostics.paragraphCandidates,
      hjBeamWidth: bodyFlow.compositionDiagnostics.beamWidth,
      hjCacheHit: bodyFlow.compositionDiagnostics.cacheHit,
      hjOptimizationTimeMs: bodyFlow.compositionDiagnostics.optimizationTimeMs,
      hjCompositionTimeMs: bodyFlow.compositionDiagnostics.compositionTimeMs,
      hjFinalBadness: bodyFlow.compositionDiagnostics.finalBadness,
      storyScore: bodyFlow.compositionDiagnostics.storyScore,
      paragraphScores: bodyFlow.compositionDiagnostics.paragraphScores,
      storyFillPercent: bodyFlow.compositionDiagnostics.storyFillPercent,
      bottomWhitespace: bodyFlow.compositionDiagnostics.bottomWhitespace,
      storyCompositionIterations: bodyFlow.compositionDiagnostics.storyCompositionIterations,
      storyOptimizationPasses: bodyFlow.compositionDiagnostics.storyOptimizationPasses,
      averageParagraphScore: bodyFlow.compositionDiagnostics.averageParagraphScore,
      bestCandidateScore: bodyFlow.compositionDiagnostics.bestCandidateScore,
      rejectedCandidates: bodyFlow.compositionDiagnostics.rejectedCandidates,
      finalStoryQuality: bodyFlow.compositionDiagnostics.finalStoryQuality,
      opticalGlyphCount: 0,
      leftHangingCount: 0,
      rightHangingCount: 0,
      averageHangPercent: 0,
      storyWidth: contentWidth,
      headlineMeasureWidth,
      renderedHeadlineWidth: headline.width,
      headlineFillPercent,
      headlineFillLine1Percent: getHeadlineLineFillPercent(0),
      headlineFillLine2Percent: getHeadlineLineFillPercent(1),
      selectedHeadlineCandidateScore: headlineMetrics.selectedCandidateScore,
      selectedHeadlineCandidateType: headlineMetrics.selectedCandidateType,
      selectedHeadlineCandidateReason: headlineMetrics.selectedCandidateReason,
      headlineTopCandidateScores: headlineMetrics.topCandidateScores,
      headlineOriginal: headlineText,
      headlineGeneratedCandidates: headlineMetrics.candidateLayouts,
      headlineChosenCandidate: headlineMetrics.selectedLayout,
      headlineRenderedLines,
      headlineRenderedLine1: headlineRenderedLines[0] ?? "",
      headlineRenderedLine2: headlineRenderedLines[1] ?? "",
      headlineRenderedLine3: headlineRenderedLines[2] ?? "",
      headlineLineWidths,
      headlineLineAvailableWidth: Math.round(headlineMeasureWidth * 10) / 10,
      headlineLineOverflowPx,
      headlineMaxOverflowPx: Math.max(0, ...headlineLineOverflowPx),
      headlineAverageFillPercent,
      headlineUnusedPixels,
      imageHeight: image?.height ?? 0,
      imageCoveragePercent,
      textCoveragePercent: Math.max(0, Math.round((100 - imageCoveragePercent) * 10) / 10),
      generatedRegions: bodyRegions.length,
      consumedRegions: bodyFlow.flow.consumedRegionCount,
      remainingText: bodyFlow.flow.remainingLineCount,
      usedColumns,
      unusedColumns,
      regionCount: bodyFlow.flow.usableRegionCount + bodyFlow.flow.discardedRegionCount,
      usableRegions: bodyFlow.flow.usableRegionCount,
      discardedRegions: bodyFlow.flow.discardedRegionCount,
      columnCount: safeColumnCount,
    },
  };
};
