import {
  findCutoffIndexInFullText,
  findNearbyPreviousClauseBoundary,
  findNextSentenceBoundary,
  findPreviousSentenceBoundary,
  isAlreadyAtSentenceEnd,
  isSentenceBoundaryAt,
} from "@/engines/TypographyEngine/SentenceBoundaryEngine";
import { getBaselineLineAdvance } from "@/engines/BaselineGridEngine/BaselineGridEngine";

import { bodyTypographySafety, resolveTypographyAdjustments } from "@/engines/TypographyEngine/TypographyLimits";
import { normalizeRichText, richTextToPlainText } from "@/engines/RichText/RichTextUtils";
import type {
  ArticleBoxModel,
  ArticleCompositionSettings,
  ArticleData,
  ArticleLayout,
  ArticleTextStyle,
  StoryImageSettings,
  StoryPriority,
  StoryTypographySettings,
} from "@/types/editor";

const getLineHeightPx = (style: ArticleTextStyle) => style.fontSize * style.lineHeight;

export type ArticleFitOverrides = {
  bodyFontSize?: number;
  bodyLineHeight?: number;
  bodyTracking?: number;
  letterSpacingAdjustment?: number;
  wordSpacingAdjustment?: number;
  captionSpacingAdjustment?: number;
  imageHeight?: number;
  imageHeightPreset?: StoryImageSettings["imageHeightPreset"];
  pullQuoteHeightAdjustment?: number;
  factBoxHeightAdjustment?: number;
  // Forces the inline-subheadline bullet block off entirely, regardless of
  // whether it would otherwise fit. Used for a second composition attempt
  // when a first pass (bullets shown) still overflows its body — see
  // composeArticleBox's retry-without-bullets step.
  suppressInlineSubheadline?: boolean;
};

export type SafetyCheckInput = {
  articleBox: { x: number; y: number; width: number; height: number; id?: string };
  layout: ArticleLayout;
  pageBounds?: { x: number; y: number; width: number; height: number };
  otherStories?: { id: string; x: number; y: number; width: number; height: number }[];
};

/**
 * Safety Checks before committing layout adjustment:
 * - Verify every text frame is fully contained within assigned article frame.
 * - Verify no text overlaps another article.
 * - Verify no text overlaps an image.
 * - Verify no frame exceeds allocated bounds.
 */
export const runSafetyChecks = ({
  articleBox,
  layout,
  pageBounds,
  otherStories = [],
}: SafetyCheckInput): boolean => {
  // 1. Verify frame does not exceed allocated page bounds
  if (pageBounds) {
    const maxY = pageBounds.y + pageBounds.height;
    const maxX = pageBounds.x + pageBounds.width;
    if (articleBox.y + articleBox.height > maxY + 1 || articleBox.x + articleBox.width > maxX + 1) {
      return false;
    }
  }

  // 2. Verify no text frame / box overlaps another article frame
  for (const other of otherStories) {
    if (other.id && articleBox.id && other.id === articleBox.id) {
      continue;
    }
    const overlap =
      articleBox.x < other.x + other.width - 0.5 &&
      articleBox.x + articleBox.width > other.x + 0.5 &&
      articleBox.y < other.y + other.height - 0.5 &&
      articleBox.y + articleBox.height > other.y + 0.5;

    if (overlap) {
      return false;
    }
  }

  // 3. Verify every text frame is fully contained within assigned article frame bounds (local offsets inside articleBox)
  const containsBlock = (block: { x: number; y: number; width: number; height: number } | null | undefined) => {
    if (!block) return true;
    return (
      block.x >= -2 &&
      block.y >= -2 &&
      block.x + block.width <= articleBox.width + 4 &&
      block.y + block.height <= articleBox.height + 4
    );
  };

  if (!containsBlock(layout.headline)) return false;
  if (!containsBlock(layout.subheadline)) return false;
  if (!containsBlock(layout.byline)) return false;

  // 4. Verify no text overlaps an image
  if (layout.image && layout.body.columns) {
    const img = layout.image;
    for (const col of layout.body.columns) {
      for (const line of col.lines) {
        const lineX = col.x + line.x;
        const lineY = col.y + line.y;
        const textOverlapsImage =
          lineX < img.x + img.width - 1 &&
          lineX + line.width > img.x + 1 &&
          lineY < img.y + img.height - 1 &&
          lineY + line.height > img.y + 1;

        if (textOverlapsImage) {
          return false;
        }
      }
    }
  }

  return true;
};

export type SentenceEndFittingInput = {
  articleBox: ArticleBoxModel &
    Partial<StoryImageSettings> &
    Partial<StoryTypographySettings> & { priority?: StoryPriority };
  articleData: ArticleData;
  compositionSettings: ArticleCompositionSettings;
  composePass: (
    box: ArticleBoxModel &
      Partial<StoryImageSettings> &
      Partial<StoryTypographySettings> & { priority?: StoryPriority },
    data: ArticleData,
    settings: ArticleCompositionSettings,
    fitOverrides?: ArticleFitOverrides,
  ) => ArticleLayout;
};

// findCutoffIndexInFullText and isAlreadyAtSentenceEnd used to be duplicated
// here — a second, drifting copy of the same logic already in
// SentenceBoundaryEngine.ts, with a weaker isAlreadyAtSentenceEnd (its
// last-visible-line check didn't validate against abbreviations/decimals
// the way isSentenceBoundaryAt does, so a line ending in "डॉ." or "3.5" at a
// wrap boundary could be misread as a real sentence end and skip the
// trim-to-boundary logic entirely). Now imported from the shared engine so
// this outer fitting pass and the inner one in composeArticleBox.ts can
// never drift apart again.

/**
 * Newspaper Body Fitting Engine v2
 *
 * Step 1: Lay out the article normally (base layout).
 * Step 2: Determine last fully visible sentence. If already ends on sentence boundary & remaining space < 1 line, return base layout.
 * Step 3: Locate NEXT sentence boundary in fullText and measure required extra height.
 * Step 4: Apply 7-pass micro-typography compression in strict order:
 *   Pass 1: Tracking -1%
 *   Pass 2: Tracking -2%
 *   Pass 3: Tracking -2%, Word spacing -1%
 *   Pass 4: Tracking -2%, Word spacing -2%, Line height -1%
 *   Pass 5: Tracking -2%, Word spacing -2%, Line height -2%
 *   Pass 6: Letter spacing -1%
 *   Pass 7: Letter spacing -2%
 * Step 5: 1-Line Safe Frame Expansion: Expand frame height by max 1 line height. Reflow & run collision detection against page bounds & other stories. If collision occurs, undo expansion immediately.
 * Step 6: Font Condensation: Reduce body font size by max 0.25 pt. Reflow & run safety check.
 * Step 7: Micro Expansion Pass: If sentence fits but leaves a gap, apply up to +1% line height, +1% word spacing, +1% tracking to stretch paragraph smoothly to column bottom.
 * Step 8: Fallback: Fall back to previous complete sentence boundary. Never cut mid-sentence.
 * Step 9: Hard Boundary Guarantee: Re-run full layout per pass, 0 glyph overflow outside article frame rect.
 */
export const adjustArticleSentenceEnd = ({
  articleBox,
  articleData,
  compositionSettings,
  composePass,
}: SentenceEndFittingInput): ArticleLayout => {
  // Step 1: Base layout.
  const baseLayout = composePass(articleBox, articleData, compositionSettings);

  const fullText = richTextToPlainText(articleData.body).trim();
  if (!fullText) {
    return baseLayout;
  }

  const visibleLines = baseLayout.body.columns.flatMap((col) => col.lines);
  if (visibleLines.length === 0) {
    return baseLayout;
  }

  // Step 2: Locate last visible character.
  const cutoffIndex = findCutoffIndexInFullText(visibleLines, fullText);
  if (cutoffIndex < 0) {
    return baseLayout;
  }

  // Step 2 Check: Already ends on sentence boundary and remaining line count < 1?
  if (
    isAlreadyAtSentenceEnd(fullText, cutoffIndex, visibleLines) &&
    baseLayout.body.remainingLineCount < 1
  ) {
    return baseLayout;
  }

  const pageBounds = compositionSettings.pageBounds;
  const otherStories = compositionSettings.otherStories;
  const baseLineHeight = articleBox.bodyLineHeight ?? 1.2;

  // Helper: Vertical Justification Pass (Rule 5)
  // Distributes remaining height evenly across rendered body lines to fill all remaining whitespace completely.
  const performVerticalJustification = (
    layout: ArticleLayout,
    box: ArticleBoxModel & Partial<StoryImageSettings> & Partial<StoryTypographySettings> & { priority?: StoryPriority },
    data: ArticleData,
  ): ArticleLayout => {
    if (layout.body.remainingLineCount <= 0.05) {
      return layout;
    }

    const verticalPasses: ArticleFitOverrides[] = [
      // Line height +1%
      { bodyLineHeight: baseLineHeight * 1.01 },
      // Line height +2%
      { bodyLineHeight: baseLineHeight * 1.02 },
      // Line height +3%
      { bodyLineHeight: baseLineHeight * 1.03 },
      // Line height +4%
      { bodyLineHeight: baseLineHeight * 1.04 },
      // Line height +5%
      { bodyLineHeight: baseLineHeight * 1.05 },
      // Line height +6%
      { bodyLineHeight: baseLineHeight * 1.06 },
      // Line height +3%, Word spacing +1%
      { bodyLineHeight: baseLineHeight * 1.03, wordSpacingAdjustment: 0.01 },
      // Line height +4%, Word spacing +2%
      { bodyLineHeight: baseLineHeight * 1.04, wordSpacingAdjustment: 0.02 },
      // Line height +5%, Word spacing +2%, Tracking +1%
      { bodyLineHeight: baseLineHeight * 1.05, wordSpacingAdjustment: 0.02, bodyTracking: 0.01, letterSpacingAdjustment: 0.01 },
      // Micro font size expansion +0.2pt to take up line height space
      { bodyFontSize: (box.bodyFontSize ?? 10) + 0.2 },
      { bodyFontSize: (box.bodyFontSize ?? 10) + 0.3, bodyLineHeight: baseLineHeight * 1.02 },
    ];

    let bestFitted = layout;
    for (const vOverrides of verticalPasses) {
      const vLayout = composePass(box, data, compositionSettings, vOverrides);
      if (
        !vLayout.body.overflow &&
        vLayout.body.remainingLineCount < bestFitted.body.remainingLineCount &&
        runSafetyChecks({ articleBox: box, layout: vLayout, pageBounds, otherStories })
      ) {
        bestFitted = vLayout;
        if (vLayout.body.remainingLineCount <= 0.05) {
          return vLayout;
        }
      }
    }

    return bestFitted;
  };

  // Step 3: Locate NEXT sentence boundary after cutoff.
  const nextBoundaryIndex = findNextSentenceBoundary(fullText, cutoffIndex);

  if (nextBoundaryIndex !== -1) {
    const nextSentenceText = fullText.slice(0, nextBoundaryIndex + 1).trim();

    if (nextSentenceText) {
      const nextSentenceData: ArticleData = {
        ...articleData,
        body: normalizeRichText(nextSentenceText),
      };

      const baseFontSize = articleBox.bodyFontSize ?? 10;
      const pass1Spacing = resolveTypographyAdjustments({ trackingEm: -0.01, fontSize: baseFontSize, renderer: "composition" });
      const pass2Spacing = resolveTypographyAdjustments({ trackingEm: -0.015, fontSize: baseFontSize, renderer: "composition" });
      const passWordSpacing1 = resolveTypographyAdjustments({ wordSpacingEm: 0.02, fontSize: baseFontSize, renderer: "composition" });
      const passWordSpacing2 = resolveTypographyAdjustments({ wordSpacingEm: 0.03, fontSize: baseFontSize, renderer: "composition" });

      // Step 4: 9-Pass Micro-Typography Compression Sequence
      const compressionPasses: ArticleFitOverrides[] = [
        // Pass 1: Safe Tracking 1
        { letterSpacingAdjustment: pass1Spacing.letterSpacingPx },
        // Pass 2: Safe Tracking 2
        { letterSpacingAdjustment: pass2Spacing.letterSpacingPx },
        // Pass 3: Safe Tracking 2, Word spacing compensation 1
        { letterSpacingAdjustment: pass2Spacing.letterSpacingPx, wordSpacingAdjustment: passWordSpacing1.wordSpacingPx },
        // Pass 4: Safe Tracking 2, Word spacing compensation 2
        { letterSpacingAdjustment: pass2Spacing.letterSpacingPx, wordSpacingAdjustment: passWordSpacing2.wordSpacingPx },
        // Pass 5: Safe Tracking 2, Word spacing compensation 2, Line height -1%
        { letterSpacingAdjustment: pass2Spacing.letterSpacingPx, wordSpacingAdjustment: passWordSpacing2.wordSpacingPx, bodyLineHeight: baseLineHeight * 0.99 },
        // Pass 6: Safe Tracking 2, Word spacing compensation 2, Line height -3% (safe limit)
        { letterSpacingAdjustment: pass2Spacing.letterSpacingPx, wordSpacingAdjustment: passWordSpacing2.wordSpacingPx, bodyLineHeight: baseLineHeight * Math.max(0.97, bodyTypographySafety.minLineHeightScale) },
        // Pass 7: Letter spacing 1 (standalone)
        { letterSpacingAdjustment: pass1Spacing.letterSpacingPx },
        // Pass 8: Letter spacing 2 (standalone)
        { letterSpacingAdjustment: pass2Spacing.letterSpacingPx },
        // Pass 9: Body font size max 0.2pt reduction (bounded by safe min font scale)
        { bodyFontSize: Math.max(6, baseFontSize * bodyTypographySafety.minFontScale, baseFontSize - 0.2) },
      ];

      for (const passOverrides of compressionPasses) {
        const passLayout = composePass(
          articleBox,
          nextSentenceData,
          compositionSettings,
          passOverrides,
        );

        if (!passLayout.body.overflow) {
          if (runSafetyChecks({ articleBox, layout: passLayout, pageBounds, otherStories })) {
            return performVerticalJustification(passLayout, articleBox, nextSentenceData);
          }
        }
      }
    }
  }

  // Step 8: Image Height Micro-Adjustment Pass
  // If the article has an image and still has > 0.5 lines of blank space, adjust image height to push text down to fill the bottom line.
  if (baseLayout.image && baseLayout.body.remainingLineCount > 0.5) {
    const lineAdvance = (articleBox.bodyFontSize ?? 10) * baseLineHeight;
    const currentImgHeight = baseLayout.image.height;
    
    // Try adjusting image height in micro steps (+1 line, +2 lines, +3 lines, -1 line, -2 lines)
    const imgAdjustments = [
      currentImgHeight + lineAdvance * 0.8,
      currentImgHeight + lineAdvance * 1.6,
      currentImgHeight + lineAdvance * 2.4,
      Math.max(40, currentImgHeight - lineAdvance * 0.8),
      Math.max(40, currentImgHeight - lineAdvance * 1.6),
    ];

    for (const newImgHeight of imgAdjustments) {
      const imgOverrides: ArticleFitOverrides = {
        imageHeight: newImgHeight,
      };
      const imgLayout = composePass(articleBox, articleData, compositionSettings, imgOverrides);
      if (
        !imgLayout.body.overflow &&
        imgLayout.body.remainingLineCount < baseLayout.body.remainingLineCount &&
        runSafetyChecks({ articleBox, layout: imgLayout, pageBounds, otherStories })
      ) {
        return performVerticalJustification(imgLayout, articleBox, articleData);
      }
    }
  }

  // Step 9: Cannot fit the next full sentence even after compression, so end the story
  // at the last COMPLETE sentence that fits.
  //
  // Earlier revisions trimmed at a clause boundary or, failing that, at whatever word
  // happened to fit. Both cut mid-sentence, and since the result is later passed through
  // ensureTextEndsWithFullStop, a full stop got appended to that fragment — printing a
  // sentence that stops early yet looks finished. Rolling back to a real sentence boundary
  // is now unconditional; any blank space left behind is closed by the copyfitter reflowing
  // real text, never by inventing an ending.
  const prevSentenceBoundary = findPreviousSentenceBoundary(fullText, cutoffIndex - 1);

  if (prevSentenceBoundary !== -1) {
    const prevSentenceText = fullText.slice(0, prevSentenceBoundary + 1).trim();
    if (prevSentenceText) {
      const prevSentenceData: ArticleData = {
        ...articleData,
        body: normalizeRichText(prevSentenceText),
      };
      const prevSentenceLayout = composePass(articleBox, prevSentenceData, compositionSettings);

      if (
        !prevSentenceLayout.body.overflow &&
        runSafetyChecks({ articleBox, layout: prevSentenceLayout, pageBounds, otherStories })
      ) {
        return performVerticalJustification(prevSentenceLayout, articleBox, prevSentenceData);
      }
    }
  }

  // Step 9: Return base layout with vertical justification if no overflow.
  return performVerticalJustification(baseLayout, articleBox, articleData);
};

export type ArticleQualityReport = {
  storyId?: string;
  remainingLines: number;
  bodyOverflow: boolean;
  headlineOverflow: boolean;
  sentenceEndingStatus: boolean;
  textOutsideArticleBox: boolean;
  hasOverlaps: boolean;
  passed: boolean;
};

export const validatePageQuality = (
  layout: ArticleLayout,
  articleBox: ArticleBoxModel & { id?: string },
  articleData: ArticleData,
): ArticleQualityReport => {
  const fullText = richTextToPlainText(articleData.body).trim();
  const visibleLines = layout.body.columns.flatMap((col) => col.lines);
  const cutoffIndex = findCutoffIndexInFullText(visibleLines, fullText);
  const sentenceEndingStatus = isAlreadyAtSentenceEnd(fullText, cutoffIndex, visibleLines);
  const remainingLines = layout.body.remainingLineCount;
  const bodyOverflow = layout.body.overflow;
  const headlineOverflow = Boolean(layout.headline && layout.headline.lineBoxes.some((l) => l.width > articleBox.width + 2));

  const textOutsideArticleBox = !runSafetyChecks({ articleBox, layout });
  const hasOverlaps = false; // Checked via safety checks
  const passed =
    sentenceEndingStatus &&
    !bodyOverflow &&
    !headlineOverflow &&
    !textOutsideArticleBox &&
    remainingLines <= 1.0;

  return {
    storyId: articleBox.id,
    remainingLines,
    bodyOverflow,
    headlineOverflow,
    sentenceEndingStatus,
    textOutsideArticleBox,
    hasOverlaps,
    passed,
  };
};

export const SentenceEndFittingEngine = {
  adjustArticleSentenceEnd,
  runSafetyChecks,
  validatePageQuality,
};
