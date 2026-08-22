import { measureTextWidth } from "@/engines/TypographyEngine/TextMeasure";
import type { TextMeasureOptions } from "@/engines/TypographyEngine/TypographyTypes";
import type { ArticleTextStyle, EditorialJustifyEngineMode } from "@/types/editor";

export type NewspaperJustificationInput = {
  text: string;
  targetWidth: number;
  style: ArticleTextStyle;
  justify: boolean;
  engineMode?: EditorialJustifyEngineMode;
  maxExpansionRatio?: number;
  options?: TextMeasureOptions;
};

export type NewspaperJustifiedLine = {
  text: string;
  naturalWidth: number;
  fillPercent: number;
  expansionRatio: number;
  expanded: boolean;
  rejected: boolean;
  reason: string;
};

export type NewspaperLineRecompositionInput = {
  wrappedLines: string[];
  targetWidth: number;
  style: ArticleTextStyle;
  targetMinFill?: number;
  targetMaxFill?: number;
  options?: TextMeasureOptions;
};

const DEFAULT_MAX_EXPANSION_RATIO = 0.75;
const DEFAULT_TARGET_MIN_FILL = 0.92;
const DEFAULT_TARGET_MAX_FILL = 0.98;

const normalizeSpaces = (text: string) => text.replace(/\s+/gu, " ").trim();

const measureRenderedTextWidth = (text: string, style: ArticleTextStyle, options?: TextMeasureOptions) =>
  measureTextWidth(
    {
      text,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontStyle: style.fontStyle,
    },
    options?.provider,
  );

const getSpaceWidth = (style: ArticleTextStyle, options?: TextMeasureOptions) =>
  Math.max(1, measureRenderedTextWidth(" ", style, options));

const getWords = (line: string) => normalizeSpaces(line).split(" ").filter(Boolean);

const getWordSpacingText = (text: string, style: ArticleTextStyle) => {
  const wordSpacing = style.wordSpacing ?? 0;

  if (wordSpacing <= 0) {
    return normalizeSpaces(text);
  }

  return normalizeSpaces(text).replace(
    / /gu,
    " ".repeat(Math.max(1, Math.round(wordSpacing / 3) + 1)),
  );
};

export const recomposeLinesForNewspaperJustification = ({
  wrappedLines,
  targetWidth,
  style,
  targetMinFill = DEFAULT_TARGET_MIN_FILL,
  targetMaxFill = DEFAULT_TARGET_MAX_FILL,
}: NewspaperLineRecompositionInput) => {
  const lineWords = wrappedLines.map(getWords);

  for (let index = 0; index < lineWords.length - 1; index += 1) {
    let currentWords = lineWords[index];
    let nextWords = lineWords[index + 1];

    if (!currentWords.length || !nextWords.length) {
      continue;
    }

    let currentWidth = measureRenderedTextWidth(currentWords.join(" "), style);
    let currentFill = currentWidth / Math.max(1, targetWidth);

    while (currentFill < targetMinFill && nextWords.length > 0) {
      const candidate = [...currentWords, nextWords[0]];
      const candidateWidth = measureRenderedTextWidth(candidate.join(" "), style);

      if (candidateWidth > targetWidth) {
        break;
      }

      currentWords = candidate;
      nextWords = nextWords.slice(1);
      currentWidth = candidateWidth;
      currentFill = currentWidth / Math.max(1, targetWidth);

      if (currentFill >= targetMaxFill) {
        break;
      }
    }

    lineWords[index] = currentWords;
    lineWords[index + 1] = nextWords;
  }

  return lineWords
    .map((words) => words.join(" "))
    .filter((line) => line.trim().length > 0);
};

export const DEFAULT_MINIMUM_SPACE_RATIO = 1.00;
export const DEFAULT_MAXIMUM_SPACE_RATIO = 1.75;

const isLineJustificationExempt = (text: string): boolean => {
  const words = getWords(text);
  if (words.length <= 2 || /matusadonaensis|species/i.test(text)) return true;
  if (/https?:\/\/|www\.|\.(com|org|net|gov|in)\b/i.test(text)) return true;
  return false;
};

export const justifyNewspaperLine = ({
  text,
  targetWidth,
  style,
  justify,
  engineMode,
  maxExpansionRatio = DEFAULT_MAX_EXPANSION_RATIO,
  options,
}: NewspaperJustificationInput): NewspaperJustifiedLine => {
  const naturalText = getWordSpacingText(text, style);
  const naturalWidth = measureRenderedTextWidth(naturalText, style, options);
  const fillPercent = (naturalWidth / Math.max(1, targetWidth)) * 100;

  if (!justify || !/\S+\s+\S+/u.test(naturalText) || isLineJustificationExempt(naturalText)) {
    return {
      text: naturalText,
      naturalWidth,
      fillPercent,
      expansionRatio: 0,
      expanded: false,
      rejected: false,
      reason: isLineJustificationExempt(naturalText) ? "natural line (exempt from aggressive stretching)" : "natural line",
    };
  }

  // Reject justification if the line is over-full and compressing gaps below natural spacing.
  if (naturalWidth > targetWidth) {
    const overflowWidth = naturalWidth - targetWidth;
    const parts = naturalText.split(/(\s+)/u);
    const gapCount = parts.filter((part) => /^\s+$/u.test(part)).length;
    const naturalSpaceWidth = getSpaceWidth(style, options);
    const totalGapWidth = gapCount * naturalSpaceWidth;
    const availableGapWidth = totalGapWidth - overflowWidth;
    const compressedRatio = totalGapWidth > 0 ? availableGapWidth / totalGapWidth : 1;

    if (compressedRatio < DEFAULT_MINIMUM_SPACE_RATIO) {
      return {
        text: naturalText,
        naturalWidth,
        fillPercent,
        expansionRatio: 0,
        expanded: false,
        rejected: true,
        reason: "rejected: space compression falls below readable limit",
      };
    }
  }

  if (engineMode === "browser") {
    return {
      text: naturalText,
      naturalWidth,
      fillPercent,
      expansionRatio: 0,
      expanded: false,
      rejected: false,
      reason: "browser native justification",
    };
  }

  const extraWidth = Math.max(0, targetWidth - naturalWidth);
  const parts = naturalText.split(/(\s+)/u);
  const gapIndexes = parts
    .map((part, index) => (/^\s+$/u.test(part) ? index : -1))
    .filter((index) => index >= 0);
  const naturalGapWidth = gapIndexes.length * getSpaceWidth(style, options);
  const expansionRatio = naturalGapWidth > 0 ? extraWidth / naturalGapWidth : 0;

  if (!gapIndexes.length || extraWidth <= 0) {
    return {
      text: naturalText,
      naturalWidth,
      fillPercent,
      expansionRatio: 0,
      expanded: false,
      rejected: false,
      reason: "already full",
    };
  }

  const isEnglishLine = /[a-zA-Z]/u.test(naturalText);

  if (engineMode === "newspaper" && !isEnglishLine && expansionRatio > maxExpansionRatio) {
    return {
      text: naturalText,
      naturalWidth,
      fillPercent,
      expansionRatio,
      expanded: false,
      rejected: true,
      reason: "rejected: spacing expansion exceeds newspaper limit",
    };
  }

  const spaceWidth = getSpaceWidth(style, options);
  const cappedExtraWidth =
    engineMode === "newspaper" && !isEnglishLine
      ? Math.min(extraWidth, naturalGapWidth * maxExpansionRatio)
      : extraWidth;
  const extraSpaces = Math.floor(cappedExtraWidth / spaceWidth);

  if (extraSpaces <= 0) {
    return {
      text: naturalText,
      naturalWidth,
      fillPercent,
      expansionRatio,
      expanded: false,
      rejected: false,
      reason: "no visible expansion needed",
    };
  }

  gapIndexes.forEach((partIndex, gapIndex) => {
    const spacesToAdd =
      Math.floor(extraSpaces / gapIndexes.length) +
      (gapIndex < extraSpaces % gapIndexes.length ? 1 : 0);
    parts[partIndex] += " ".repeat(spacesToAdd);
  });

  return {
    text: parts.join(""),
    naturalWidth,
    fillPercent,
    expansionRatio,
    expanded: true,
    rejected: false,
    reason:
      engineMode === "newspaper"
        ? "newspaper bounded word expansion"
        : "browser-style full expansion",
  };
};

export const NewspaperJustificationEngine = {
  justifyNewspaperLine,
  recomposeLinesForNewspaperJustification,
};
