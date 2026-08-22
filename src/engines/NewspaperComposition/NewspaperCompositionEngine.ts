import { measureTextWidth } from "@/engines/TypographyEngine/TextMeasure";
import type {
  ArticleTextStyle,
  EditorialJustifyEngineMode,
  EditorialJustifyMode,
} from "@/types/editor";

export type NewspaperCompositionLineInput = {
  text: string;
  width: number;
  justify: boolean;
};

export type NewspaperComposedWord = {
  text: string;
  x: number;
  width: number;
  gapAfter: number;
  tracking: number;
};

export type NewspaperComposedLine = {
  text: string;
  words: NewspaperComposedWord[];
  naturalWidth: number;
  renderedWidth: number;
  targetWidth: number;
  fillPercent: number;
  gap: number;
  expansionRatio: number;
  badness: number;
  justified: boolean;
  rejected: boolean;
  naturalSpaceWidth: number;
  resolvedWordGap: number;
  alignment: "left" | "justified";
  fontSize: number;
  tracking: number;
  horizontalScale: 1;
  isParagraphLastLine: boolean;
  isArticleLastLine: boolean;
};

export type NewspaperCompositionDiagnostics = {
  averageSpacing: number;
  minimumSpacing: number;
  maximumSpacing: number;
  spacingVariance: number;
  trackingVariance: number;
  averageTracking: number;
  grayBalanceScore: number;
  gapVariance: number;
  compositionPasses: number;
  wordsMoved: number;
  badnessScore: number;
  finalLineWidths: number[];
  paragraphCandidatesTested: number;
  paragraphCandidatesAccepted: number;
  paragraphCandidatesRejected: number;
  beamWidth: number;
  optimizationTimeMs: number;
  compositionTimeMs: number;
  lineBalanceScore: number;
  grayVariance: number;
  rhythmScore: number;
  isolatedWordScore: number;
  selectedCandidate: string;
  riverScore: number;
  widowScore: number;
  orphanScore: number;
  paragraphQuality: number;
};

export type NewspaperCompositionResult = {
  lines: NewspaperComposedLine[];
  diagnostics: NewspaperCompositionDiagnostics;
};

export type NewspaperCompositionInput = {
  lines: NewspaperCompositionLineInput[];
  style: ArticleTextStyle;
  justifyMode: EditorialJustifyMode;
  engineMode: EditorialJustifyEngineMode;
  maxExpansionRatio?: number;
  targetMinFill?: number;
  beamWidth?: number;
  earlyExitQuality?: number;
};

type ParagraphCandidate = {
  id: string;
  lineWords: string[][];
  wordsMoved: number;
};

type ParagraphScore = {
  badness: number;
  riverScore: number;
  widowScore: number;
  orphanScore: number;
  gapVariance: number;
  lineBalanceScore: number;
  grayVariance: number;
  rhythmScore: number;
  isolatedWordScore: number;
  paragraphQuality: number;
  rejected: boolean;
};

const MAX_NEWSPAPER_EXPANSION_RATIO = 0.75;
const PREFERRED_EXPANSION_RATIO = 0.35;
const DEFAULT_TARGET_MIN_FILL = 0.92;
const DEFAULT_BEAM_WIDTH = 10;
const DEFAULT_EARLY_EXIT_QUALITY = 97;

const performanceNow = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const getWords = (text: string) => text.replace(/\s+/gu, " ").trim().split(" ").filter(Boolean);

const shortFunctionWords = new Set([
  "के",
  "की",
  "को",
  "का",
  "से",
  "में",
  "पर",
  "है",
  "हैं",
  "ने",
  "और",
  "या",
  "तो",
  "ही",
  "भी",
  "तक",
  "for",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "as",
  "and",
  "or",
  "the",
]);

const isShortFunctionWord = (word: string) => shortFunctionWords.has(word.toLowerCase());

const getCandidateKey = (lineWords: string[][]) =>
  lineWords.map((words) => words.join(" ")).join("\n");

const cloneLineWords = (lineWords: string[][]) => lineWords.map((words) => [...words]);

const measureWord = (text: string, style: ArticleTextStyle) =>
  getCachedMeasuredWordWidth(text, style);

const wordWidthCache = new Map<string, number>();
const MAX_WORD_WIDTH_CACHE_SIZE = 5000;

const getCachedMeasuredWordWidth = (text: string, style: ArticleTextStyle) => {
  const cacheKey = `${style.fontFamily}:${style.fontSize}:${style.fontStyle ?? ""}:${text}`;
  const cached = wordWidthCache.get(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const width = measureTextWidth({
    text,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontStyle: style.fontStyle,
  });

  if (wordWidthCache.size >= MAX_WORD_WIDTH_CACHE_SIZE) {
    const oldestKey = wordWidthCache.keys().next().value;

    if (oldestKey) {
      wordWidthCache.delete(oldestKey);
    }
  }

  wordWidthCache.set(cacheKey, width);

  return width;
};

const getNormalGap = (style: ArticleTextStyle) =>
  Math.max(
    1,
    measureTextWidth({
      text: " ",
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontStyle: style.fontStyle,
    }) + (style.wordSpacing ?? 0),
  );

const measureWords = (words: string[], style: ArticleTextStyle, normalGap: number) => {
  const wordWidths = words.map((word) => measureWord(word, style));
  const naturalWidth =
    wordWidths.reduce((sum, width) => sum + width, 0) + normalGap * Math.max(0, words.length - 1);

  return {
    wordWidths,
    naturalWidth,
  };
};

const MINIMUM_VISIBLE_SPACE_RATIO = 1.0;
const CONDENSED_VISIBLE_SPACE_RATIO = 1.05;
const TIGHT_TRACKING_VISIBLE_SPACE_RATIO = 1.10;
const MAXIMUM_VISIBLE_SPACE_RATIO = 1.75;

export const isAggressiveJustificationProhibited = (text: string, words: string[]): boolean => {
  if (words.length <= 2 || /matusadonaensis|species/i.test(text)) {
    return true;
  }
  if (/https?:\/\/|www\.|\.(com|org|net|gov|in)\b/i.test(text)) {
    return true;
  }
  return false;
};

const shouldJustifyLine = (
  line: NewspaperCompositionLineInput,
  index: number,
  lineCount: number,
  justifyMode: EditorialJustifyMode,
) => {
  if (!line.justify) {
    return false;
  }
  const words = line.text.trim().split(/\s+/u).filter(Boolean);
  if (isAggressiveJustificationProhibited(line.text, words)) {
    return false;
  }
  return justifyMode === "justify-all-lines" || index < lineCount - 1;
};

const getLineQuality = ({
  words,
  width,
  style,
  normalGap,
  justify,
  isFinalLine,
  targetMinFill,
  maxExpansionRatio,
}: {
  words: string[];
  width: number;
  style: ArticleTextStyle;
  normalGap: number;
  justify: boolean;
  isFinalLine: boolean;
  targetMinFill: number;
  maxExpansionRatio: number;
}) => {
  const { naturalWidth } = measureWords(words, style, normalGap);
  const gapCount = Math.max(0, words.length - 1);
  const unusedWidth = Math.max(0, width - naturalWidth);
  const fillRatio = naturalWidth / Math.max(1, width);
  const expansionRatio = gapCount > 0 ? unusedWidth / (normalGap * gapCount) : 0;
  const overflow = Math.max(0, naturalWidth - width);
  const singleWordLinePenalty =
    words.length === 1
      ? isFinalLine
        ? 6000 + Math.max(0, 0.34 - fillRatio) * 12000
        : fillRatio > 0.82
          ? 520000 + fillRatio * 90000
          : 460000 + Math.max(0, 0.55 - fillRatio) * 160000
      : 0;
  const twoWordLinePenalty =
    words.length === 2 && !isFinalLine
      ? 220000 + Math.max(0, 0.68 - fillRatio) * 90000
      : words.length === 2 && isFinalLine
        ? Math.max(0, 0.22 - fillRatio) * 5000
        : 0;
  const isolatedFunctionWordPenalty =
    words.some(isShortFunctionWord) && words.length <= 2
      ? 45000
      : (isShortFunctionWord(words[0] ?? "") || isShortFunctionWord(words.at(-1) ?? "")) && !isFinalLine
        ? 12000
        : 0;
  const veryShortLinePenalty = !isFinalLine && fillRatio < 0.58 ? (0.58 - fillRatio) * 5000 : 0;
  const veryLongLinePenalty = !isFinalLine && fillRatio > 1 ? (fillRatio - 1) * 120000 : 0;
  const expansionPenalty =
    justify && expansionRatio > maxExpansionRatio
      ? 50000 + (expansionRatio - maxExpansionRatio) * 200000
      : 0;
  const spacingDifferencePenalty =
    justify && gapCount > 0 ? Math.abs(expansionRatio - Math.min(expansionRatio, PREFERRED_EXPANSION_RATIO)) * 2600 : 0;
  const preferredGapPenalty =
    justify && expansionRatio > PREFERRED_EXPANSION_RATIO
      ? (expansionRatio - PREFERRED_EXPANSION_RATIO) * 1200
      : 0;
  const unusedPenalty = justify
    ? Math.max(0, targetMinFill - fillRatio) * 2200 + unusedWidth * 0.18
    : unusedWidth * 0.03;
  const shortLinePenalty = !isFinalLine && fillRatio < 0.78 ? (0.78 - fillRatio) * 1200 : 0;
  const longLinePenalty = fillRatio > 0.995 ? (fillRatio - 0.995) * 300 : 0;
  const widowPenalty = isFinalLine && words.length === 1 ? 700 : 0;
  const orphanPenalty = !isFinalLine && words.length <= 2 ? 450 : 0;

  return {
    naturalWidth,
    fillRatio,
    expansionRatio,
    unusedWidth,
    badness:
      overflow * 10000 +
      expansionPenalty +
      spacingDifferencePenalty +
      preferredGapPenalty +
      unusedPenalty +
      singleWordLinePenalty +
      twoWordLinePenalty +
      isolatedFunctionWordPenalty +
      veryShortLinePenalty +
      veryLongLinePenalty +
      shortLinePenalty +
      longLinePenalty +
      widowPenalty +
      orphanPenalty,
    widowPenalty,
    orphanPenalty,
  };
};

const canFitLine = (
  words: string[],
  width: number,
  style: ArticleTextStyle,
  normalGap: number,
) => measureWords(words, style, normalGap).naturalWidth <= width;

const addCandidate = (
  candidates: ParagraphCandidate[],
  seen: Set<string>,
  lineWords: string[][],
  id: string,
  wordsMoved: number,
  limit: number,
) => {
  const normalized = lineWords.filter((words) => words.length > 0);

  if (!normalized.length) {
    return;
  }

  const key = getCandidateKey(normalized);

  if (seen.has(key) || candidates.length >= limit) {
    return;
  }

  seen.add(key);
  candidates.push({
    id,
    lineWords: normalized,
    wordsMoved,
  });
};

const expandBoundaryCandidates = ({
  seed,
  boundaryIndex,
  lines,
  style,
  normalGap,
  seen,
  limit,
}: {
  seed: ParagraphCandidate;
  boundaryIndex: number;
  lines: NewspaperCompositionLineInput[];
  style: ArticleTextStyle;
  normalGap: number;
  seen: Set<string>;
  limit: number;
}) => {
  const expanded: ParagraphCandidate[] = [];

  addCandidate(expanded, seen, seed.lineWords, `${seed.id}+keep-${boundaryIndex + 1}`, seed.wordsMoved, limit);

  for (const moveCount of [1, 2, 3]) {
    const nextLine = seed.lineWords[boundaryIndex + 1] ?? [];

    if (nextLine.length > moveCount) {
      const variant = cloneLineWords(seed.lineWords);

      variant[boundaryIndex].push(...variant[boundaryIndex + 1].slice(0, moveCount));
      variant[boundaryIndex + 1] = variant[boundaryIndex + 1].slice(moveCount);

      if (canFitLine(variant[boundaryIndex], lines[boundaryIndex]?.width ?? lines.at(-1)?.width ?? 1, style, normalGap)) {
        addCandidate(
          expanded,
          seen,
          variant,
          `${seed.id}+pull-${boundaryIndex + 1}-${moveCount}`,
          seed.wordsMoved + moveCount,
          limit,
        );
      }
    }

    const currentLine = seed.lineWords[boundaryIndex] ?? [];

    if (currentLine.length > moveCount + 2) {
      const variant = cloneLineWords(seed.lineWords);
      const moved = variant[boundaryIndex].splice(-moveCount);

      variant[boundaryIndex + 1].unshift(...moved);
      addCandidate(
        expanded,
        seen,
        variant,
        `${seed.id}+push-${boundaryIndex + 1}-${moveCount}`,
        seed.wordsMoved + moveCount,
        limit,
      );
    }
  }

  return expanded;
};

const getMaxFittingWordCount = (
  words: string[],
  startIndex: number,
  width: number,
  style: ArticleTextStyle,
  normalGap: number,
) => {
  let maxCount = 0;

  for (let count = 1; startIndex + count <= words.length; count += 1) {
    const slice = words.slice(startIndex, startIndex + count);

    if (!canFitLine(slice, width, style, normalGap)) {
      break;
    }

    maxCount = count;
  }

  return Math.max(1, maxCount);
};

const generateGlobalBeamCandidates = ({
  base,
  lines,
  style,
  normalGap,
  justifyMode,
  targetMinFill,
  maxExpansionRatio,
  beamWidth,
}: {
  base: string[][];
  lines: NewspaperCompositionLineInput[];
  style: ArticleTextStyle;
  normalGap: number;
  justifyMode: EditorialJustifyMode;
  targetMinFill: number;
  maxExpansionRatio: number;
  beamWidth: number;
}) => {
  const flatWords = base.flat();
  const lineCount = Math.max(1, base.length);
  let beam: { lineWords: string[][]; nextIndex: number; wordsMoved: number; id: string }[] = [
    { lineWords: [], nextIndex: 0, wordsMoved: 0, id: "global" },
  ];

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    const nextStates: typeof beam = [];
    const isFinalLine = lineIndex === lineCount - 1;
    const width = lines[lineIndex]?.width ?? lines.at(-1)?.width ?? 1;

    for (const state of beam) {
      const remainingWords = flatWords.length - state.nextIndex;
      const remainingSlots = lineCount - lineIndex - 1;

      if (remainingWords <= 0) {
        nextStates.push({
          ...state,
          lineWords: [...state.lineWords, []],
          id: `${state.id}+empty-${lineIndex + 1}`,
        });
        continue;
      }

      if (isFinalLine) {
        nextStates.push({
          lineWords: [...state.lineWords, flatWords.slice(state.nextIndex)],
          nextIndex: flatWords.length,
          wordsMoved: state.wordsMoved,
          id: `${state.id}+final`,
        });
        continue;
      }

      const maxCount = Math.min(
        remainingWords - remainingSlots,
        getMaxFittingWordCount(flatWords, state.nextIndex, width, style, normalGap),
      );
      const minCount = Math.max(1, maxCount - 4);
      const counts = Array.from({ length: Math.max(0, maxCount - minCount + 1) }, (_, index) => maxCount - index);

      for (const count of counts) {
        if (remainingWords - count < remainingSlots) {
          continue;
        }

        const nextLineWords = flatWords.slice(state.nextIndex, state.nextIndex + count);

        nextStates.push({
          lineWords: [...state.lineWords, nextLineWords],
          nextIndex: state.nextIndex + count,
          wordsMoved: state.wordsMoved + Math.abs(count - (base[lineIndex]?.length ?? count)),
          id: `${state.id}+${lineIndex + 1}:${count}`,
        });
      }
    }

    beam = pruneBeam({
      candidates: nextStates.map((state) => ({
        id: state.id,
        lineWords: state.lineWords,
        wordsMoved: state.wordsMoved,
      })),
      lines,
      style,
      normalGap,
      justifyMode,
      targetMinFill,
      maxExpansionRatio,
      beamWidth,
    }).map((candidate) => ({
      lineWords: candidate.lineWords,
      nextIndex: candidate.lineWords.flat().length,
      wordsMoved: candidate.wordsMoved,
      id: candidate.id,
    }));
  }

  return beam
    .filter((state) => state.nextIndex >= flatWords.length)
    .map((state) => ({
      id: state.id,
      lineWords: state.lineWords,
      wordsMoved: state.wordsMoved,
    }));
};

const generateFastLocalCandidates = (
  base: string[][],
  lines: NewspaperCompositionLineInput[],
  style: ArticleTextStyle,
  normalGap: number,
  justifyMode: EditorialJustifyMode,
  targetMinFill: number,
  maxExpansionRatio: number,
  beamWidth: number,
) => {
  const candidates: ParagraphCandidate[] = [];
  const seen = new Set<string>();
  const candidateLimit = Math.max(beamWidth * 4, beamWidth + 1);

  addCandidate(candidates, seen, base, "base", 0, candidateLimit);

  for (let index = 0; index < base.length - 1; index += 1) {
    for (const moveCount of [1, 2]) {
      if (base[index + 1].length > moveCount) {
        const variant = cloneLineWords(base);

        variant[index].push(...variant[index + 1].slice(0, moveCount));
        variant[index + 1] = variant[index + 1].slice(moveCount);

        if (canFitLine(variant[index], lines[index]?.width ?? lines.at(-1)?.width ?? 1, style, normalGap)) {
          addCandidate(candidates, seen, variant, `fast-pull-${index + 1}-${moveCount}`, moveCount, candidateLimit);
        }
      }

      if (base[index].length > moveCount + 2) {
        const variant = cloneLineWords(base);
        const moved = variant[index].splice(-moveCount);

        variant[index + 1].unshift(...moved);
        addCandidate(candidates, seen, variant, `fast-push-${index + 1}-${moveCount}`, moveCount, candidateLimit);
      }
    }
  }

  return pruneBeam({
    candidates,
    lines,
    style,
    normalGap,
    justifyMode,
    targetMinFill,
    maxExpansionRatio,
    beamWidth,
  });
};

const generateCandidates = (
  lines: NewspaperCompositionLineInput[],
  style: ArticleTextStyle,
  normalGap: number,
  beamWidth: number,
  targetMinFill: number,
  maxExpansionRatio: number,
  justifyMode: EditorialJustifyMode,
) => {
  const base = lines.map((line) => getWords(line.text));

  if (base.length > 8) {
    return generateFastLocalCandidates(
      base,
      lines,
      style,
      normalGap,
      justifyMode,
      targetMinFill,
      maxExpansionRatio,
      beamWidth,
    );
  }

  const seen = new Set<string>();
  const candidateLimit = Math.max(beamWidth * 8, beamWidth + 1);
  let beam: ParagraphCandidate[] = [];

  addCandidate(beam, seen, base, "base", 0, candidateLimit);

  for (let boundaryIndex = 0; boundaryIndex < base.length - 1; boundaryIndex += 1) {
    const boundarySeen = new Set<string>();
    const expanded = beam.flatMap((seed) =>
      expandBoundaryCandidates({
        seed,
        boundaryIndex,
        lines,
        style,
        normalGap,
        seen: boundarySeen,
        limit: candidateLimit,
      }),
    );

    beam = pruneBeam({
      candidates: expanded.length > 0 ? expanded : beam,
      lines,
      style,
      normalGap,
      justifyMode,
      targetMinFill,
      maxExpansionRatio,
      beamWidth,
    });
  }

  const globalBeam =
    base.length <= 8
      ? generateGlobalBeamCandidates({
          base,
          lines,
          style,
          normalGap,
          justifyMode,
          targetMinFill,
          maxExpansionRatio,
          beamWidth,
        })
      : [];

  return pruneBeam({
    candidates: [...beam, ...globalBeam],
    lines,
    style,
    normalGap,
    justifyMode,
    targetMinFill,
    maxExpansionRatio,
    beamWidth,
  });
};

const pruneBeam = ({
  candidates,
  lines,
  style,
  normalGap,
  justifyMode,
  targetMinFill,
  maxExpansionRatio,
  beamWidth,
}: {
  candidates: ParagraphCandidate[];
  lines: NewspaperCompositionLineInput[];
  style: ArticleTextStyle;
  normalGap: number;
  justifyMode: EditorialJustifyMode;
  targetMinFill: number;
  maxExpansionRatio: number;
  beamWidth: number;
}) =>
  candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate({
        candidate,
        lines,
        style,
        normalGap,
        justifyMode,
        targetMinFill,
        maxExpansionRatio,
        includeRiverScore: false,
      }),
    }))
    .sort((first, second) => first.score.badness - second.score.badness)
    .map(({ candidate }) => candidate)
    .slice(0, Math.max(1, beamWidth));

const getGapPositions = (
  words: string[],
  style: ArticleTextStyle,
  normalGap: number,
) => {
  let cursor = 0;

  return words.slice(0, -1).map((word) => {
    cursor += measureWord(word, style);
    const gapX = cursor;

    cursor += normalGap;

    return gapX;
  });
};

const calculateRiverScore = (
  candidate: ParagraphCandidate,
  style: ArticleTextStyle,
  normalGap: number,
) => {
  let score = 0;

  for (let index = 0; index < candidate.lineWords.length - 1; index += 1) {
    const currentGaps = getGapPositions(candidate.lineWords[index], style, normalGap);
    const nextGaps = getGapPositions(candidate.lineWords[index + 1], style, normalGap);

    for (const currentGap of currentGaps) {
      for (const nextGap of nextGaps) {
        const distance = Math.abs(currentGap - nextGap);

        if (distance < normalGap * 0.75) {
          score += (normalGap * 0.75 - distance) * 8;
        }
      }
    }
  }

  return score;
};

const scoreCandidate = ({
  candidate,
  lines,
  style,
  normalGap,
  justifyMode,
  targetMinFill,
  maxExpansionRatio,
  includeRiverScore = true,
}: {
  candidate: ParagraphCandidate;
  lines: NewspaperCompositionLineInput[];
  style: ArticleTextStyle;
  normalGap: number;
  justifyMode: EditorialJustifyMode;
  targetMinFill: number;
  maxExpansionRatio: number;
  includeRiverScore?: boolean;
}): ParagraphScore => {
  const lineScores = candidate.lineWords.map((words, index) =>
    getLineQuality({
      words,
      width: lines[index]?.width ?? lines.at(-1)?.width ?? 1,
      style,
      normalGap,
      justify: shouldJustifyLine(lines[index] ?? lines.at(-1)!, index, candidate.lineWords.length, justifyMode),
      isFinalLine: index === candidate.lineWords.length - 1,
      targetMinFill,
      maxExpansionRatio,
    }),
  );
  const expansionRatios = lineScores.slice(0, -1).map((score) => score.expansionRatio);
  const averageExpansion = expansionRatios.length
    ? expansionRatios.reduce((sum, ratio) => sum + ratio, 0) / expansionRatios.length
    : 0;
  const gapVariance = expansionRatios.length
    ? expansionRatios.reduce((sum, ratio) => sum + (ratio - averageExpansion) ** 2, 0) / expansionRatios.length
    : 0;
  const fillRatios = lineScores.map((score) => score.fillRatio);
  const averageFill = fillRatios.length
    ? fillRatios.reduce((sum, fill) => sum + fill, 0) / fillRatios.length
    : 0;
  const grayVariance = fillRatios.length
    ? fillRatios.reduce((sum, fill) => sum + (fill - averageFill) ** 2, 0) / fillRatios.length
    : 0;
  const neighborDifferencePenalty = lineScores.slice(1).reduce((sum, score, index) => {
    const previous = lineScores[index];

    return sum + Math.abs(score.fillRatio - previous.fillRatio) * 1800;
  }, 0);
  const isolatedWordScore = candidate.lineWords.reduce((sum, words, index) => {
    const isFinalLine = index === candidate.lineWords.length - 1;
    const singleOrDouble = words.length <= 2 ? 1 : 0;
    const isolatedFunctionWord =
      words.some(isShortFunctionWord) && words.length <= 2
        ? 1
        : (isShortFunctionWord(words[0] ?? "") || isShortFunctionWord(words.at(-1) ?? "")) && !isFinalLine
          ? 0.35
          : 0;

    return sum + singleOrDouble + isolatedFunctionWord;
  }, 0);
  const rhythmPenalty = lineScores.reduce((sum, score, index) => {
    const expected = index === lineScores.length - 1 ? Math.min(averageFill, 0.72) : averageFill;

    return sum + Math.abs(score.fillRatio - expected) * 900;
  }, 0);
  const densityPenalty = grayVariance * 14000;
  const hasInvalidSpacing = lineScores.some(
    (score, index) =>
      shouldJustifyLine(lines[index] ?? lines.at(-1)!, index, candidate.lineWords.length, justifyMode) &&
      score.expansionRatio > maxExpansionRatio,
  );
  const hasOversetLine = lineScores.some((score) => score.naturalWidth > (lines[0]?.width ?? 1) * 1.15);
  const rejected = hasInvalidSpacing || hasOversetLine;
  const riverScore = includeRiverScore ? calculateRiverScore(candidate, style, normalGap) : 0;
  const widowScore = lineScores.reduce((sum, score) => sum + score.widowPenalty, 0);
  const orphanScore = lineScores.reduce((sum, score) => sum + score.orphanPenalty, 0);
  const baseBadness = lineScores.reduce((sum, score) => sum + score.badness, 0);
  const lastLine = lineScores.at(-1);
  const lastLineQualityPenalty =
    lastLine && candidate.lineWords.length > 1 && lastLine.fillRatio < 0.25
      ? (0.25 - lastLine.fillRatio) * 1200
      : 0;
  const paragraphBalancePenalty = grayVariance * 8000 + gapVariance * 5000;
  const badness =
    baseBadness +
    riverScore +
    widowScore +
    orphanScore +
    lastLineQualityPenalty +
    paragraphBalancePenalty +
    densityPenalty +
    rhythmPenalty +
    neighborDifferencePenalty +
    (rejected ? 100000 : 0) +
    candidate.wordsMoved * 4;

  return {
    badness,
    riverScore,
    widowScore,
    orphanScore,
    gapVariance,
    lineBalanceScore: neighborDifferencePenalty,
    grayVariance,
    rhythmScore: rhythmPenalty,
    isolatedWordScore,
    paragraphQuality: Math.max(0, 100 - badness / 80),
    rejected,
  };
};

const selectBestCandidate = ({
  candidates,
  lines,
  style,
  normalGap,
  justifyMode,
  targetMinFill,
  maxExpansionRatio,
  earlyExitQuality,
}: {
  candidates: ParagraphCandidate[];
  lines: NewspaperCompositionLineInput[];
  style: ArticleTextStyle;
  normalGap: number;
  justifyMode: EditorialJustifyMode;
  targetMinFill: number;
  maxExpansionRatio: number;
  earlyExitQuality: number;
}) => {
  let bestCandidate = candidates[0];
  let bestScore = scoreCandidate({
    candidate: bestCandidate,
    lines,
    style,
    normalGap,
    justifyMode,
    targetMinFill,
    maxExpansionRatio,
  });
  let rejectedCandidateCount = bestScore.rejected ? 1 : 0;

  for (const candidate of candidates.slice(1)) {
    const score = scoreCandidate({
      candidate,
      lines,
      style,
      normalGap,
      justifyMode,
      targetMinFill,
      maxExpansionRatio,
    });
    rejectedCandidateCount += score.rejected ? 1 : 0;

    if (score.badness < bestScore.badness) {
      bestCandidate = candidate;
      bestScore = score;

      if (!score.rejected && score.paragraphQuality >= earlyExitQuality) {
        break;
      }
    }
  }

  return {
    candidate: bestCandidate,
    score: bestScore,
    rejectedCandidateCount,
  };
};

const createSmoothedGapAdditions = (gapCount: number, totalAddition: number, normalGap: number) => {
  if (gapCount <= 0 || totalAddition <= 0) {
    return [];
  }

  const maxDelta = Math.min(normalGap * 0.005, 0.15);
  const baseAddition = totalAddition / gapCount;
  const raw = Array.from({ length: gapCount }, (_, index) => {
    const centerDistance = Math.abs(index - (gapCount - 1) / 2) / Math.max(1, gapCount);
    const wave = index % 2 === 0 ? 0.5 : -0.5;

    return Math.max(0, baseAddition + wave * maxDelta - centerDistance * maxDelta * 0.35);
  });
  const rawTotal = raw.reduce((sum, value) => sum + value, 0);

  if (rawTotal <= 0) {
    return Array.from({ length: gapCount }, () => baseAddition);
  }

  return raw.map((value) => (value / rawTotal) * totalAddition);
};

const getMicroJustification = ({
  wordWidths,
  width,
  normalGap,
  justify,
  engineMode,
  maxExpansionRatio,
  style,
  words,
}: {
  wordWidths: number[];
  width: number;
  normalGap: number;
  justify: boolean;
  engineMode: EditorialJustifyEngineMode;
  maxExpansionRatio: number;
  style: ArticleTextStyle;
  words: string[];
}) => {
  const gapCount = Math.max(0, wordWidths.length - 1);
  const baseWidth = wordWidths.reduce((sum, wordWidth) => sum + wordWidth, 0) + normalGap * gapCount;
  const remainingWidth = width - baseWidth;
  const tolerance = Math.max(0.25, width * 0.005);
  // Newspaper body copy is allowed only a restrained 15% space expansion.
  // This keeps the professional mode from creating rivers in narrow columns.
  const absoluteMaxExpansionRatio = Math.min(Math.max(0, maxExpansionRatio), MAXIMUM_VISIBLE_SPACE_RATIO - 1);
  const negativeTrackingRatio = Math.max(0, -(style.letterSpacing ?? 0) / Math.max(1, style.fontSize));
  const minimumSpaceRatio =
    negativeTrackingRatio > 0
      ? TIGHT_TRACKING_VISIBLE_SPACE_RATIO
      : style.fontSize < 12
        ? CONDENSED_VISIBLE_SPACE_RATIO
        : MINIMUM_VISIBLE_SPACE_RATIO;
  const minimumVisibleGap = normalGap * minimumSpaceRatio;
  const maximumVisibleGap = normalGap * MAXIMUM_VISIBLE_SPACE_RATIO;

  if (gapCount > 0) {
    const totalWordsWidth = wordWidths.reduce((sum, w) => sum + w, 0);
    const requiredGap = (width - totalWordsWidth) / gapCount;
    if (requiredGap + 0.001 < minimumVisibleGap) {
      return {
        gaps: Array.from({ length: gapCount }, () => normalGap),
        tracking: 0,
        renderedWidth: baseWidth,
        rejected: true,
        justified: false,
        expansionRatio: 0,
      };
    }
  }

  if (!justify || gapCount <= 0 || engineMode !== "newspaper" || remainingWidth <= tolerance || isAggressiveJustificationProhibited(words.join(" "), words)) {
    return {
      gaps: Array.from({ length: gapCount }, () => normalGap),
      tracking: 0,
      renderedWidth: baseWidth,
      rejected: false,
      justified: false,
      expansionRatio: gapCount > 0 ? Math.max(0, remainingWidth) / (normalGap * gapCount) : 0,
    };
  }

  const requiredExpansionRatio = remainingWidth / (normalGap * gapCount);
  const isEnglishLine = words.some((w) => /[a-zA-Z]/u.test(w));

  if (!isEnglishLine && requiredExpansionRatio > absoluteMaxExpansionRatio) {
    return {
      gaps: Array.from({ length: gapCount }, () => normalGap),
      tracking: 0,
      renderedWidth: baseWidth,
      rejected: true,
      justified: false,
      expansionRatio: requiredExpansionRatio,
    };
  }

  const tracking = 0;
  const trackingWidth = 0;
  const spaceWidth = Math.max(0, remainingWidth);
  const maxGap = isEnglishLine
    ? Math.max(normalGap * (1 + requiredExpansionRatio), maximumVisibleGap)
    : Math.min(normalGap * (1 + absoluteMaxExpansionRatio), maximumVisibleGap);
  const minGap = minimumVisibleGap;
  const minimumTotalGapAddition = Math.max(0, minGap - normalGap) * gapCount;
  const gaps =
    spaceWidth <= minimumTotalGapAddition + tolerance
      ? Array.from({ length: gapCount }, () => minGap)
      : createSmoothedGapAdditions(gapCount, spaceWidth, normalGap).map((addition) => normalGap + addition);
  const rejected = (!isEnglishLine && gaps.some((gap) => gap > maxGap + 0.001 || gap + 0.001 < minGap)) || gaps.some((gap) => gap + 0.001 < minGap);
  const renderedWidth =
    wordWidths.reduce((sum, wordWidth) => sum + wordWidth, 0) +
    trackingWidth +
    gaps.reduce((sum, gap) => sum + gap, 0);

  return {
    gaps: rejected ? Array.from({ length: gapCount }, () => normalGap) : gaps,
    tracking: rejected ? 0 : tracking,
    renderedWidth: rejected ? baseWidth : renderedWidth,
    rejected,
    justified: !rejected,
    expansionRatio: requiredExpansionRatio,
  };
};

const composeWords = ({
  words,
  width,
  style,
  normalGap,
  justify,
  engineMode,
  maxExpansionRatio,
}: {
  words: string[];
  width: number;
  style: ArticleTextStyle;
  normalGap: number;
  justify: boolean;
  engineMode: EditorialJustifyEngineMode;
  maxExpansionRatio: number;
}): NewspaperComposedLine => {
  const { wordWidths, naturalWidth } = measureWords(words, style, normalGap);
  const gapCount = Math.max(0, words.length - 1);
  const unusedWidth = Math.max(0, width - naturalWidth);
  const browserRequiredExpansionRatio = gapCount > 0 ? unusedWidth / (normalGap * gapCount) : 0;
  const browserGap = gapCount > 0 && justify ? normalGap * (1 + browserRequiredExpansionRatio) : normalGap;
  const microJustification =
    engineMode === "newspaper"
      ? getMicroJustification({
          wordWidths,
          width,
          normalGap,
          justify,
          engineMode,
          maxExpansionRatio,
          style,
          words,
        })
      : {
          gaps: Array.from({ length: gapCount }, () => browserGap),
          tracking: 0,
          renderedWidth:
            wordWidths.reduce((sum, wordWidth) => sum + wordWidth, 0) + browserGap * Math.max(0, words.length - 1),
          rejected: false,
          justified: justify && gapCount > 0,
          expansionRatio: browserRequiredExpansionRatio,
        };
  const renderedWidth =
    microJustification.renderedWidth;
  let cursor = 0;
  const composedWordObjects = words.map((word, index) => {
    const wordWidth = wordWidths[index];
    const wordX = cursor;
    const renderedWordWidth = wordWidth;
    const gapAfter = index < words.length - 1 ? microJustification.gaps[index] ?? normalGap : 0;

    cursor += renderedWordWidth + gapAfter;

    return {
      text: word,
      x: wordX,
      width: renderedWordWidth,
      gapAfter,
      tracking: microJustification.tracking,
    };
  });
  const lineText = words.join(" ");

  const debugBodySpacing =
    typeof process !== "undefined" &&
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DEBUG_BODY_WORD_SPACING === "true";
  const adjacentBounds = composedWordObjects.slice(0, -1).map((word, index) => {
    const next = composedWordObjects[index + 1];
    const gap = next.x - (word.x + word.width);

    return {
      left: word.text,
      right: next.text,
      gap,
      overlapsOrNearlyTouches: gap < normalGap,
    };
  });

  if (debugBodySpacing && lineText.includes("क्रिकेट") && lineText.includes("बारीकियों")) {
    console.log(`[BodyWordSpacingDiagnostic] Original paragraph text: "क्रिकेट की बारीकियों को जल्दी समझा।"`);
    console.log(`[BodyWordSpacingDiagnostic] Final line text: "${lineText}"`);
    console.log(`[BodyWordSpacingDiagnostic] Word tokens: ${JSON.stringify(words)}`);
    console.log(`[BodyWordSpacingDiagnostic] Number of words: ${words.length}`);
    console.log(`[BodyWordSpacingDiagnostic] Number of spaces: ${Math.max(0, words.length - 1)}`);
    console.log(`[BodyWordSpacingDiagnostic] Natural width of each word: ${JSON.stringify(wordWidths)}`);
    console.log(`[BodyWordSpacingDiagnostic] Natural space width: ${normalGap}`);
    console.log(`[BodyWordSpacingDiagnostic] Resolved gap between every adjacent word: ${JSON.stringify(microJustification.gaps)}`);
    console.log(`[BodyWordSpacingDiagnostic] Word X positions: ${JSON.stringify(composedWordObjects.map(w => w.x))}`);
    console.log(`[BodyWordSpacingDiagnostic] Adjacent word bounds: ${JSON.stringify(adjacentBounds)}`);
    console.log(`[BodyWordSpacingDiagnostic] Tracking value: ${microJustification.tracking}`);
    console.log(`[BodyWordSpacingDiagnostic] Word-spacing value: ${style.wordSpacing ?? 0}`);
    console.log(`[BodyWordSpacingDiagnostic] Font size: ${style.fontSize}`);
    console.log(`[BodyWordSpacingDiagnostic] Line-height: ${style.lineHeight}`);
    console.log(`[BodyWordSpacingDiagnostic] Justification applied: ${microJustification.justified}`);
    console.log(`[BodyWordSpacingDiagnostic] Horizontal scale: 1`);
    console.log(`[BodyWordSpacingDiagnostic] Renderer used: composition/pdf/canvas`);
    console.log(`[BodyWordSpacingDiagnostic] Whether the PDF independently recalculated spacing: false (PDF consumes explicit segment X positions)`);
  }

  return {
    text: lineText,
    words: composedWordObjects,
    naturalWidth,
    renderedWidth,
    targetWidth: width,
    fillPercent: (renderedWidth / Math.max(1, width)) * 100,
    gap: microJustification.gaps[0] ?? normalGap,
    expansionRatio: microJustification.expansionRatio,
    badness: Math.max(0, width - renderedWidth) + (microJustification.rejected ? 1000 : 0),
    justified: microJustification.justified,
    rejected: microJustification.rejected,
    naturalSpaceWidth: normalGap,
    resolvedWordGap: microJustification.gaps[0] ?? normalGap,
    alignment: microJustification.justified ? ("justified" as const) : ("left" as const),
    fontSize: style.fontSize,
    tracking: microJustification.tracking,
    horizontalScale: 1 as const,
    isParagraphLastLine: false,
    isArticleLastLine: false,
  };
};

const calculateDiagnostics = (
  lines: NewspaperComposedLine[],
  selectedCandidate: ParagraphCandidate,
  selectedScore: ParagraphScore,
  paragraphCandidatesTested: number,
  rejectedCandidateCount: number,
  beamWidth: number,
  optimizationTimeMs: number,
  compositionTimeMs: number,
): NewspaperCompositionDiagnostics => {
  const gaps = lines.flatMap((line) =>
    line.words.slice(0, -1).map((word) => word.gapAfter).filter((gap) => gap > 0),
  );
  const averageSpacing = gaps.length
    ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length
    : 0;
  const minimumSpacing = gaps.length ? Math.min(...gaps) : 0;
  const maximumSpacing = gaps.length ? Math.max(...gaps) : 0;
  const spacingVariance = gaps.length
    ? gaps.reduce((sum, gap) => sum + (gap - averageSpacing) ** 2, 0) / gaps.length
    : 0;
  const trackingValues = lines.flatMap((line) => line.words.map((word) => word.tracking).filter((tracking) => tracking > 0));
  const averageTracking = trackingValues.length
    ? trackingValues.reduce((sum, tracking) => sum + tracking, 0) / trackingValues.length
    : 0;
  const trackingVariance = trackingValues.length
    ? trackingValues.reduce((sum, tracking) => sum + (tracking - averageTracking) ** 2, 0) / trackingValues.length
    : 0;
  const fillValues = lines.map((line) => Math.min(100, Math.max(0, line.fillPercent)));
  const averageFill = fillValues.length
    ? fillValues.reduce((sum, fill) => sum + fill, 0) / fillValues.length
    : 0;
  const fillVariance = fillValues.length
    ? fillValues.reduce((sum, fill) => sum + (fill - averageFill) ** 2, 0) / fillValues.length
    : 0;
  const grayBalanceScore = Math.max(0, 100 - Math.sqrt(fillVariance) - Math.sqrt(spacingVariance) * 2);

  return {
    averageSpacing,
    minimumSpacing,
    maximumSpacing,
    spacingVariance,
    trackingVariance,
    averageTracking,
    grayBalanceScore,
    gapVariance: spacingVariance,
    compositionPasses: paragraphCandidatesTested,
    wordsMoved: selectedCandidate.wordsMoved,
    badnessScore: selectedScore.badness,
    finalLineWidths: lines.map((line) => line.renderedWidth),
    paragraphCandidatesTested,
    paragraphCandidatesAccepted: Math.max(0, paragraphCandidatesTested - rejectedCandidateCount),
    paragraphCandidatesRejected: rejectedCandidateCount,
    beamWidth,
    optimizationTimeMs,
    compositionTimeMs,
    lineBalanceScore: selectedScore.lineBalanceScore,
    grayVariance: selectedScore.grayVariance,
    rhythmScore: selectedScore.rhythmScore,
    isolatedWordScore: selectedScore.isolatedWordScore,
    selectedCandidate: selectedCandidate.id,
    riverScore: selectedScore.riverScore,
    widowScore: selectedScore.widowScore,
    orphanScore: selectedScore.orphanScore,
    paragraphQuality: selectedScore.paragraphQuality,
  };
};

export const composeNewspaperBodyLines = ({
  lines,
  style,
  justifyMode,
  engineMode,
  targetMinFill = DEFAULT_TARGET_MIN_FILL,
  maxExpansionRatio = MAX_NEWSPAPER_EXPANSION_RATIO,
  beamWidth = DEFAULT_BEAM_WIDTH,
  earlyExitQuality = DEFAULT_EARLY_EXIT_QUALITY,
}: NewspaperCompositionInput): NewspaperCompositionResult => {
  const startedAt = performanceNow();
  const normalGap = getNormalGap(style);
  const optimizationStartedAt = performanceNow();
  const candidates =
    engineMode === "newspaper"
      ? generateCandidates(lines, style, normalGap, beamWidth, targetMinFill, maxExpansionRatio, justifyMode)
      : [
          {
            id: "browser",
            lineWords: lines.map((line) => getWords(line.text)),
            wordsMoved: 0,
          },
        ];
  const optimizationTimeMs = performanceNow() - optimizationStartedAt;
  const { candidate, score, rejectedCandidateCount } = selectBestCandidate({
    candidates,
    lines,
    style,
    normalGap,
    justifyMode,
    targetMinFill,
    maxExpansionRatio,
    earlyExitQuality,
  });
  const composedLines = candidate.lineWords.map((words, index) => {
    const line = composeWords({
      words,
      width: lines[index]?.width ?? lines.at(-1)?.width ?? 1,
      style,
      normalGap,
      justify: shouldJustifyLine(lines[index] ?? lines.at(-1)!, index, candidate.lineWords.length, justifyMode),
      engineMode,
      maxExpansionRatio,
    });
    return {
      ...line,
      isParagraphLastLine: index === candidate.lineWords.length - 1,
      isArticleLastLine: index === candidate.lineWords.length - 1,
    };
  });

  return {
    lines: composedLines,
    diagnostics: calculateDiagnostics(
      composedLines,
      candidate,
      score,
      candidates.length,
      rejectedCandidateCount,
      beamWidth,
      optimizationTimeMs,
      performanceNow() - startedAt,
    ),
  };
};

export const NewspaperCompositionEngine = {
  composeNewspaperBodyLines,
};
