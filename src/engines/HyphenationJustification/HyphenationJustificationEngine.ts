import {
  composeNewspaperBodyLines,
  type NewspaperCompositionLineInput,
} from "@/engines/NewspaperComposition/NewspaperCompositionEngine";
import { measureTextWidth } from "@/engines/TypographyEngine/TextMeasure";
import { validateReadableWordGap } from "@/engines/TypographyEngine/TypographyLimits";
import type { ArticleTextStyle } from "@/types/editor";
import type {
  HyphenationJustificationInput,
  HyphenationJustificationResult,
  HyphenationJustificationSettings,
} from "./HyphenationJustificationTypes";

type PreparedCompositionLines = NewspaperCompositionLineInput[] & { hyphenCount?: number };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const MAX_CACHE_SIZE = 250;
const paragraphLayoutCache = new Map<string, HyphenationJustificationResult>();

const optimizationTargets: Record<HyphenationJustificationSettings["optimizationLevel"], number[]> = {
  fast: [0.92],
  balanced: [0.92, 0.94],
  quality: [0.92, 0.94, 0.9],
};

const modeSpacingLimits: Record<
  HyphenationJustificationSettings["optimizationLevel"],
  { min: number; max: number; beamWidth: number; earlyExitQuality: number }
> = {
  fast: { min: 100, max: 110, beamWidth: 10, earlyExitQuality: 96 },
  balanced: { min: 100, max: 120, beamWidth: 10, earlyExitQuality: 97 },
  quality: { min: 100, max: 140, beamWidth: 10, earlyExitQuality: 98 },
};

const measureWord = (text: string, style: ArticleTextStyle) =>
  measureTextWidth({
    text,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontStyle: style.fontStyle,
  });

const getWords = (text: string) => text.replace(/\s+/gu, " ").trim().split(" ").filter(Boolean);

const getHyphenPoints = (word: string, settings: HyphenationJustificationSettings) => {
  if (!settings.hyphenation || Array.from(word).length < settings.minimumWordLength) {
    return [];
  }

  // Body composition may only hyphenate from explicit language-aware points.
  // Until dictionary-backed Hindi/English hyphenation lands, never invent
  // character or grapheme breaks inside Unicode words.
  return [];
};

const hyphenateOverflowLines = (
  lines: NewspaperCompositionLineInput[],
  style: ArticleTextStyle,
  settings: HyphenationJustificationSettings,
): PreparedCompositionLines => {
  let hyphenCount = 0;
  let consecutiveHyphens = 0;
  const preparedLines = lines.map((line) => {
    const words = getWords(line.text);

    if (!settings.hyphenation || words.length !== 1 || consecutiveHyphens >= settings.maximumConsecutiveHyphens) {
      consecutiveHyphens = 0;
      return line;
    }

    const [word] = words;

    if (measureWord(word, style) <= line.width) {
      consecutiveHyphens = 0;
      return line;
    }

    for (const point of getHyphenPoints(word, settings)) {
      const first = `${Array.from(word).slice(0, point).join("")}-`;

      if (measureWord(first, style) <= line.width) {
        hyphenCount += 1;
        consecutiveHyphens += 1;

        return {
          ...line,
          text: first,
        };
      }
    }

    consecutiveHyphens = 0;
    return line;
  });

  return Object.assign(preparedLines, { hyphenCount });
};

const getMaxExpansionRatio = (settings: HyphenationJustificationSettings) =>
  clamp(
    Math.min(settings.wordSpacingMax, modeSpacingLimits[settings.optimizationLevel].max) / 100 - 1,
    0,
    0.75,
  );

const getMinExpansionRatio = (_settings: HyphenationJustificationSettings) => 0; // Never allow word compression below 1.0x natural spacing

const getGrayValue = (result: ReturnType<typeof composeNewspaperBodyLines>) => {
  const fills = result.lines.map((line) => clamp(line.fillPercent, 0, 100));
  const average = fills.length ? fills.reduce((sum, fill) => sum + fill, 0) / fills.length : 0;
  const variance = fills.length
    ? fills.reduce((sum, fill) => sum + (fill - average) ** 2, 0) / fills.length
    : 0;

  return Math.max(0, 100 - Math.sqrt(variance));
};

const selectBestResult = (results: HyphenationJustificationResult[]) =>
  results.reduce((best, candidate) =>
    candidate.diagnostics.finalBadness < best.diagnostics.finalBadness ? candidate : best,
  );

const getCacheKey = ({
  lines,
  style,
  justifyMode,
  engineMode,
  settings,
  targetMinFill,
}: HyphenationJustificationInput) =>
  JSON.stringify({
    lines: lines.map((line) => [line.text, Math.round(line.width * 100) / 100, line.justify]),
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontStyle: style.fontStyle,
    lineHeight: style.lineHeight,
    align: style.align,
    wordSpacing: style.wordSpacing ?? 0,
    letterSpacing: style.letterSpacing ?? 0,
    justifyMode,
    engineMode,
    settings,
    targetMinFill,
  });

const cloneWithCacheState = (
  result: HyphenationJustificationResult,
  cacheHit: boolean,
  cacheKey: string,
): HyphenationJustificationResult => ({
  ...result,
  diagnostics: {
    ...result.diagnostics,
    cacheHit,
    cacheKey,
  },
});

const rememberCache = (cacheKey: string, result: HyphenationJustificationResult) => {
  if (paragraphLayoutCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = paragraphLayoutCache.keys().next().value;

    if (oldestKey) {
      paragraphLayoutCache.delete(oldestKey);
    }
  }

  paragraphLayoutCache.set(cacheKey, cloneWithCacheState(result, false, cacheKey));
};

export const composeHyphenationJustification = ({
  lines,
  style,
  justifyMode,
  engineMode,
  settings,
  targetMinFill,
}: HyphenationJustificationInput): HyphenationJustificationResult => {
  const input = {
    lines,
    style,
    justifyMode,
    engineMode,
    settings,
    targetMinFill,
  };
  const cacheKey = getCacheKey(input);
  const cached = paragraphLayoutCache.get(cacheKey);

  if (cached) {
    return cloneWithCacheState(cached, true, cacheKey);
  }

  const preparedLines = hyphenateOverflowLines(lines, style, settings);
  const hyphenCount = preparedLines.hyphenCount ?? 0;
  const targets = targetMinFill ? [targetMinFill] : optimizationTargets[settings.optimizationLevel];
  const maxExpansionRatio = getMaxExpansionRatio(settings);
  const minExpansionRatio = getMinExpansionRatio(settings);
  const modeLimits = modeSpacingLimits[settings.optimizationLevel];
  const results = targets.map((target) => {
    const result = composeNewspaperBodyLines({
      lines: preparedLines,
      style,
      justifyMode,
      engineMode,
      targetMinFill: target,
      maxExpansionRatio,
      beamWidth: modeLimits.beamWidth,
      earlyExitQuality: modeLimits.earlyExitQuality,
    });
    const rejectedLines = result.lines.filter((line) => line.rejected).length;
    const compressedLines = result.lines.filter((line) => line.expansionRatio < minExpansionRatio).length;
    const rejectedCandidates = result.diagnostics.paragraphCandidatesRejected + rejectedLines + compressedLines;
    const grayValue = getGrayValue(result);
    
    // Validate readable word gap
    const naturalSpaceWidthPx = measureWord(" ", style);
    const unreadableGapLines = result.lines.filter((line) => {
      // If there's 0 or 1 word, word gap doesn't apply
      if (line.words.length <= 1) return false;
      const measuredWordGapPx = naturalSpaceWidthPx * (1 + line.expansionRatio);
      return !validateReadableWordGap(measuredWordGapPx, style.fontSize, naturalSpaceWidthPx);
    }).length;

    const finalBadness =
      result.diagnostics.badnessScore +
      result.diagnostics.riverScore * 1.8 +
      result.diagnostics.spacingVariance * 24 +
      rejectedCandidates * 350 +
      compressedLines * 1200 +
      unreadableGapLines * 2000 +
      Math.max(0, 92 - grayValue) * 16;

    return {
      ...result,
      diagnostics: {
        ...result.diagnostics,
        paragraphQuality: Math.max(0, 100 - finalBadness / 100),
        grayValue,
        grayBalanceScore: result.diagnostics.grayBalanceScore,
        averageWordSpacing: result.diagnostics.averageSpacing,
        averageTracking: result.diagnostics.averageTracking,
        trackingVariance: result.diagnostics.trackingVariance,
        gapVariance: result.diagnostics.gapVariance,
        hyphenCount,
        optimizationPasses: result.diagnostics.compositionPasses,
        rejectedCandidates,
        acceptedCandidates: result.diagnostics.paragraphCandidatesAccepted,
        paragraphCandidates: result.diagnostics.paragraphCandidatesTested,
        beamWidth: result.diagnostics.beamWidth,
        cacheHit: false,
        cacheKey,
        optimizationTimeMs: result.diagnostics.optimizationTimeMs,
        compositionTimeMs: result.diagnostics.compositionTimeMs,
        selectedCandidate: `${result.diagnostics.selectedCandidate}/hj-${Math.round(target * 100)}`,
        finalBadness,
      },
    };
  });

  const selected = selectBestResult(results);

  rememberCache(cacheKey, selected);

  return selected;
};

export const composeHyphenationJustificationIdle = (
  input: HyphenationJustificationInput,
): Promise<HyphenationJustificationResult> =>
  new Promise((resolve) => {
    const run = () => resolve(composeHyphenationJustification(input));
    const scheduler = (globalThis as typeof globalThis & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    }).requestIdleCallback;

    if (input.settings.optimizationLevel === "quality" && scheduler) {
      scheduler(run, { timeout: 120 });
      return;
    }

    setTimeout(run, 0);
  });

export const HyphenationJustificationEngine = {
  composeHyphenationJustification,
  composeHyphenationJustificationIdle,
};
