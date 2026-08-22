import { balanceHeadline } from "./HeadlineBalancerEngine";
import { measureTextWidth } from "./TextMeasure";
import type {
  HeadlineBalanceResult,
  HeadlineFitInput,
  HeadlineFitResult,
  TextMeasureOptions,
  TypographyInput,
  TypographyLine,
  TypographyResult,
} from "./TypographyTypes";

type Token = {
  text: string;
  start: number;
  end: number;
  whitespace: boolean;
};

const DEFAULT_LINE_HEIGHT = 1.28;
const SHORT_HEADLINE_WORD_LIMIT = 6;
const SHORT_HEADLINE_LAST_LINE_WORD_LIMIT = 3;
const MAX_HEADLINE_UNUSED_RATIO = 1 / 6;
const MIN_HEADLINE_FILL_RATIO = 1 - MAX_HEADLINE_UNUSED_RATIO;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getLineHeightPx = (fontSize: number, lineHeight: number) =>
  fontSize * (lineHeight || DEFAULT_LINE_HEIGHT);

const countWords = (text: string) => text.split(/\s+/u).filter(Boolean).length;

const getLargestSingleLineHeadlineFit = (
  input: HeadlineFitInput,
  maxFontSize: number,
  minFontSize: number,
  headlineLayoutMode: HeadlineFitInput["headlineLayoutMode"],
  options?: TextMeasureOptions,
) => {
  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
    const result = createHeadlineFitResult(
      balanceHeadline(
        {
          headline: input.text,
          availableWidth: input.width,
          fontFamily: input.fontFamily,
          fontSize,
          fontStyle: input.fontStyle,
          maxLines: 1,
          autoBalance: input.autoBalance,
          enableHyphenation: input.enableHyphenation,
          forceFullWidth: input.forceFullWidth,
          headlineLayoutMode,
        },
        options,
      ),
      fontSize,
      input.lineHeight,
    );

    if (!result.overflow && result.lineCount === 1) {
      return result;
    }
  }

  return null;
};

const shouldPreferSingleLineShortHeadline = (input: HeadlineFitInput, result: HeadlineFitResult) => {
  if (input.maxLines < 2 || result.lineCount !== 2) {
    return false;
  }

  const words = countWords(input.text);
  const firstLineWords = countWords(result.wrappedLines[0] ?? "");
  const finalLineWords = countWords(result.wrappedLines.at(-1) ?? "");

  return (
    words <= SHORT_HEADLINE_WORD_LIMIT &&
    finalLineWords >= 2 &&
    finalLineWords <= SHORT_HEADLINE_LAST_LINE_WORD_LIMIT &&
    firstLineWords > 0
  );
};

const getHeadlineFillRatios = (result: HeadlineFitResult, width: number) =>
  result.lines.map((line) => line.width / Math.max(1, width));

const getHeadlineLooseLinePenalty = (result: HeadlineFitResult, width: number) => {
  if (result.lineCount <= 1) {
    return 0;
  }

  return getHeadlineFillRatios(result, width).reduce(
    (sum, ratio) => sum + Math.pow(Math.max(0, MIN_HEADLINE_FILL_RATIO - ratio), 2),
    0,
  );
};

const headlineMeetsFillGoal = (result: HeadlineFitResult, width: number) =>
  result.lineCount <= 1 || getHeadlineFillRatios(result, width).every((ratio) => ratio >= MIN_HEADLINE_FILL_RATIO);

const normalizeInput = (input: TypographyInput): TypographyInput => ({
  ...input,
  width: Math.max(0, input.width),
  fontSize: Math.max(1, input.fontSize),
  lineHeight: input.lineHeight || DEFAULT_LINE_HEIGHT,
});

const segmentGraphemes = (text: string) => {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

    return Array.from(segmenter.segment(text), (segment) => segment.segment);
  }

  return Array.from(text);
};

const tokenize = (text: string): Token[] => {
  const tokens: Token[] = [];
  const pattern = /(\s+|\S+)/gu;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const value = match[0];

    tokens.push({
      text: value,
      start: match.index,
      end: match.index + value.length,
      whitespace: /^\s+$/u.test(value),
    });
  }

  return tokens;
};

const trimLineText = (line: TypographyLine): TypographyLine => {
  const leadingTrimmed = line.text.replace(/^\s+/u, "");
  const trailingTrimmed = leadingTrimmed.replace(/\s+$/u, "");
  const leadingOffset = line.text.length - leadingTrimmed.length;

  return {
    ...line,
    text: trailingTrimmed,
    start: line.start + leadingOffset,
    end: line.start + leadingOffset + trailingTrimmed.length,
  };
};

/** Tracking applied on top of canvas measurement; both default to 0. */
type MeasureSpacing = { letterSpacing?: number; wordSpacing?: number };

const createLine = (
  text: string,
  start: number,
  fontFamily: string,
  fontSize: number,
  fontStyle?: string,
  options?: TextMeasureOptions,
  spacing?: MeasureSpacing,
): TypographyLine => {
  const trimmed = trimLineText({
    text,
    start,
    end: start + text.length,
    width: 0,
  });

  return {
    ...trimmed,
    width: measureTextWidth(
      {
        text: trimmed.text,
        fontFamily,
        fontSize,
        fontStyle,
        letterSpacing: spacing?.letterSpacing,
        wordSpacing: spacing?.wordSpacing,
      },
      options?.provider,
    ),
  };
};

const splitOversetToken = (
  token: Token,
  width: number,
  fontFamily: string,
  fontSize: number,
  fontStyle?: string,
  options?: TextMeasureOptions,
  spacing?: MeasureSpacing,
) => {
  const pieces: TypographyLine[] = [];
  const graphemes = segmentGraphemes(token.text);
  let currentText = "";
  let currentStart = token.start;
  let absoluteOffset = token.start;

  for (const grapheme of graphemes) {
    const nextText = `${currentText}${grapheme}`;
    const nextWidth = measureTextWidth(
      {
        text: nextText,
        fontFamily,
        fontSize,
        fontStyle,
        letterSpacing: spacing?.letterSpacing,
        wordSpacing: spacing?.wordSpacing,
      },
      options?.provider,
    );

    if (currentText && nextWidth > width) {
      pieces.push(createLine(currentText, currentStart, fontFamily, fontSize, fontStyle, options, spacing));
      currentStart = absoluteOffset;
      currentText = grapheme;
    } else {
      currentText = nextText;
    }

    absoluteOffset += grapheme.length;
  }

  if (currentText) {
    pieces.push(createLine(currentText, currentStart, fontFamily, fontSize, fontStyle, options, spacing));
  }

  return pieces;
};

const wrapText = (input: TypographyInput, options?: TextMeasureOptions): TypographyLine[] => {
  const normalized = normalizeInput(input);
  const { text, width, fontFamily, fontSize, fontStyle } = normalized;
  const spacing: MeasureSpacing = {
    letterSpacing: normalized.letterSpacing,
    wordSpacing: normalized.wordSpacing,
  };
  const tokens = tokenize(text);
  const lines: TypographyLine[] = [];
  let currentText = "";
  let currentStart = 0;

  for (const token of tokens) {
    const tokenText = token.text.replace(/\n/g, " ");

    if (!currentText && token.whitespace) {
      continue;
    }

    const candidateText = `${currentText}${tokenText}`;
    const candidateWidth = measureTextWidth(
      {
        text: candidateText.trimEnd(),
        fontFamily,
        fontSize,
        fontStyle,
        letterSpacing: spacing.letterSpacing,
        wordSpacing: spacing.wordSpacing,
      },
      options?.provider,
    );

    if (!currentText) {
      const tokenWidth = measureTextWidth(
        {
          text: tokenText,
          fontFamily,
          fontSize,
          fontStyle,
          letterSpacing: spacing.letterSpacing,
          wordSpacing: spacing.wordSpacing,
        },
        options?.provider,
      );

      if (!token.whitespace && tokenWidth > width) {
        lines.push(...splitOversetToken(token, width, fontFamily, fontSize, fontStyle, options, spacing));
        currentText = "";
        continue;
      }

      currentText = tokenText;
      currentStart = token.start;
      continue;
    }

    if (candidateWidth <= width || token.whitespace) {
      currentText = candidateText;
      continue;
    }

    lines.push(createLine(currentText, currentStart, fontFamily, fontSize, fontStyle, options, spacing));

    if (token.whitespace) {
      currentText = "";
      continue;
    }

    const tokenWidth = measureTextWidth(
      {
        text: tokenText,
        fontFamily,
        fontSize,
        fontStyle,
        letterSpacing: spacing.letterSpacing,
        wordSpacing: spacing.wordSpacing,
      },
      options?.provider,
    );

    if (tokenWidth > width) {
      lines.push(...splitOversetToken(token, width, fontFamily, fontSize, fontStyle, options, spacing));
      currentText = "";
      continue;
    }

    currentText = tokenText;
    currentStart = token.start;
  }

  if (currentText) {
    lines.push(createLine(currentText, currentStart, fontFamily, fontSize, fontStyle, options, spacing));
  }

  return lines;
};

const limitLines = (lines: TypographyLine[], input: TypographyInput) => {
  const lineHeightPx = getLineHeightPx(input.fontSize, input.lineHeight);
  const maxByHeight =
    typeof input.maxHeight === "number" ? Math.floor(input.maxHeight / lineHeightPx) : undefined;
  const maxLineCount = Math.min(input.maxLines ?? Infinity, maxByHeight ?? Infinity);

  if (!Number.isFinite(maxLineCount)) {
    return lines;
  }

  return lines.slice(0, Math.max(0, maxLineCount));
};

export const measureCharacter = (
  text: string,
  fontFamily: string,
  fontSize: number,
  fontStyleOrOptions?: string | TextMeasureOptions,
  options?: TextMeasureOptions,
) => {
  const fontStyle = typeof fontStyleOrOptions === "string" ? fontStyleOrOptions : undefined;
  const resolvedOptions = typeof fontStyleOrOptions === "string" ? options : fontStyleOrOptions;

  return measureTextWidth({ text, fontFamily, fontSize, fontStyle }, resolvedOptions?.provider);
};

export const measureWord = measureCharacter;

export const measureLine = measureCharacter;

export const measureParagraph = (
  input: TypographyInput,
  options?: TextMeasureOptions,
): TypographyResult => {
  const normalized = normalizeInput(input);
  const allLines = wrapText(normalized, options);
  const visibleLines = limitLines(allLines, normalized);
  const lineHeightPx = getLineHeightPx(normalized.fontSize, normalized.lineHeight);
  const consumedWidth = visibleLines.reduce((max, line) => Math.max(max, line.width), 0);
  const paragraphWidth = allLines.reduce((max, line) => Math.max(max, line.width), 0);
  const consumedHeight = visibleLines.length * lineHeightPx;
  const paragraphHeight = allLines.length * lineHeightPx;

  return {
    lines: visibleLines,
    wrappedLines: visibleLines.map((line) => line.text),
    lineCount: visibleLines.length,
    consumedHeight,
    consumedWidth,
    paragraphWidth,
    paragraphHeight,
    overflow: visibleLines.length < allLines.length,
    fullLineCount: allLines.length,
  };
};

export const wrap = measureParagraph;

export { balanceHeadline };

export const createHeadlineFitResult = (
  result: HeadlineBalanceResult,
  fontSize: number,
  lineHeight: number,
): HeadlineFitResult => {
  const lineHeightPx = getLineHeightPx(fontSize, lineHeight);

  return {
    lines: result.lines,
    wrappedLines: result.wrappedLines,
    lineCount: result.lineCount,
    consumedHeight: result.lineCount * lineHeightPx,
    consumedWidth: result.consumedWidth,
    paragraphWidth: result.consumedWidth,
    paragraphHeight: result.lineCount * lineHeightPx,
    overflow: result.overflow,
    fullLineCount: result.lineCount,
    fontSize,
    visualBalanceScore: result.visualBalanceScore,
    balanceScore: result.balanceScore,
    selectedCandidateScore: result.selectedCandidateScore,
    selectedCandidateType: result.selectedCandidateType,
    selectedCandidateReason: result.selectedCandidateReason,
    selectedLayout: result.selectedLayout,
    candidateLayouts: result.candidateLayouts,
    topCandidateScores: result.topCandidateScores,
  };
};

export const fitHeadline = (
  input: HeadlineFitInput,
  options?: TextMeasureOptions,
): HeadlineFitResult => {
  const requestedMaxFontSize = Math.max(input.minFontSize, input.maxFontSize);
  const requestedMinFontSize = Math.min(input.minFontSize, input.maxFontSize);
  const maxFontSize = Math.max(requestedMaxFontSize, Math.ceil(requestedMaxFontSize * 1.05));
  const minFontSize = Math.max(1, requestedMinFontSize);
  const preferredLineCount = input.maxLines >= 2 ? 2 : 1;
  const headlineLayoutMode = input.headlineLayoutMode ?? "newspaper-fill";
  let best = createHeadlineFitResult(
    balanceHeadline(
      {
        headline: input.text,
        availableWidth: input.width,
        fontFamily: input.fontFamily,
        fontSize: minFontSize,
        fontStyle: input.fontStyle,
        maxLines: input.maxLines,
        autoBalance: input.autoBalance,
        enableHyphenation: input.enableHyphenation,
        forceFullWidth: input.forceFullWidth,
        headlineLayoutMode,
      },
      options,
    ),
    minFontSize,
    input.lineHeight,
  );
  let bestFontSize = minFontSize;
  let bestScore = Infinity;

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
    const balanced = balanceHeadline(
      {
        headline: input.text,
        availableWidth: input.width,
        fontFamily: input.fontFamily,
        fontSize,
        fontStyle: input.fontStyle,
        maxLines: input.maxLines,
        autoBalance: input.autoBalance,
        enableHyphenation: input.enableHyphenation,
        forceFullWidth: input.forceFullWidth,
        headlineLayoutMode,
      },
      options,
    );
    const result = createHeadlineFitResult(balanced, fontSize, input.lineHeight);
    const sizeDistancePenalty =
      fontSize > requestedMaxFontSize
        ? (fontSize - requestedMaxFontSize) * 0.35
        : (requestedMaxFontSize - fontSize) * 0.12;
    const lineCountPenalty =
      result.lineCount === preferredLineCount
        ? 0
        : result.lineCount === 3 && preferredLineCount === 2
          ? 3
          : Math.abs(result.lineCount - preferredLineCount) * 1.25;
    const line1Fill = (result.lines[0]?.width ?? 0) / Math.max(1, input.width);
    const line2Fill = (result.lines[1]?.width ?? 0) / Math.max(1, input.width);
    const line1WordCount = countWords(result.wrappedLines[0] ?? "");
    const unusedPixels = result.lines.reduce((sum, line) => sum + Math.max(0, input.width - line.width), 0);
    const looseLinePenalty = getHeadlineLooseLinePenalty(result, input.width);
    const fillGoalBonus = headlineMeetsFillGoal(result, input.width) ? -7_500 : 0;
    const newspaperLineCountPenalty =
      result.lineCount === preferredLineCount
        ? 0
        : result.lineCount === 1 && preferredLineCount === 2
          ? 60_000
          : result.lineCount === 3 && preferredLineCount === 2
            ? 12_000
            : Math.abs(result.lineCount - preferredLineCount) * 20_000;
    const newspaperFitScore =
      newspaperLineCountPenalty -
      line1WordCount * 3_000 -
      line1Fill * 1_000 -
      line2Fill * 400 +
      Math.pow(Math.max(0, 0.9 - line1Fill), 2) * 8_000 +
      looseLinePenalty * 120_000 +
      fillGoalBonus +
      unusedPixels * 0.25 +
      sizeDistancePenalty * 12 +
      balanced.score * 0.01;
    const editorialScore =
      headlineLayoutMode === "newspaper-fill"
        ? newspaperFitScore
        : balanced.score + looseLinePenalty * 120 + sizeDistancePenalty + lineCountPenalty;

    if (!result.overflow && result.lineCount <= input.maxLines && editorialScore < bestScore) {
      best = result;
      bestFontSize = fontSize;
      bestScore = editorialScore;
    }
  }

  if (Number.isFinite(bestScore) && !best.overflow && best.lines.every((l) => l.width <= input.width + 0.5)) {
    if (shouldPreferSingleLineShortHeadline(input, best)) {
      const singleLine = getLargestSingleLineHeadlineFit(
        input,
        Math.min(bestFontSize, requestedMaxFontSize),
        minFontSize,
        headlineLayoutMode,
        options,
      );

      if (singleLine && !singleLine.overflow && singleLine.lines.every((l) => l.width <= input.width + 0.5)) {
        return singleLine;
      }
    }

    return {
      ...best,
      fontSize: clamp(bestFontSize, minFontSize, maxFontSize),
      wrappedLines: best.wrappedLines,
    };
  }

  // 6-Pass Fallback: Reduce font size in 0.5pt steps down to 8pt to guarantee 100% containment
  for (let fs = Math.min(maxFontSize, minFontSize); fs >= 8; fs -= 0.5) {
    const balanced = balanceHeadline(
      {
        headline: input.text,
        availableWidth: input.width,
        fontFamily: input.fontFamily,
        fontSize: fs,
        fontStyle: input.fontStyle,
        maxLines: input.maxLines,
        autoBalance: input.autoBalance,
        enableHyphenation: input.enableHyphenation,
        forceFullWidth: input.forceFullWidth,
        headlineLayoutMode,
      },
      options,
    );
    const res = createHeadlineFitResult(balanced, fs, input.lineHeight);
    const fitsWidth = res.lines.every((line) => line.width <= input.width + 0.5);
    if (!res.overflow && fitsWidth && res.lineCount <= input.maxLines) {
      return res;
    }
  }

  // Pass 6: Allow one additional line if maxLines permits
  for (let fs = Math.min(maxFontSize, minFontSize); fs >= 8; fs -= 0.5) {
    const balanced = balanceHeadline(
      {
        headline: input.text,
        availableWidth: input.width,
        fontFamily: input.fontFamily,
        fontSize: fs,
        fontStyle: input.fontStyle,
        maxLines: input.maxLines + 1,
        autoBalance: input.autoBalance,
        enableHyphenation: input.enableHyphenation,
        forceFullWidth: input.forceFullWidth,
        headlineLayoutMode,
      },
      options,
    );
    const res = createHeadlineFitResult(balanced, fs, input.lineHeight);
    const fitsWidth = res.lines.every((line) => line.width <= input.width + 0.5);
    if (!res.overflow && fitsWidth) {
      return res;
    }
  }

  // Final fallback to absolute minimum size 8pt
  const absoluteFallback = balanceHeadline(
    {
      headline: input.text,
      availableWidth: input.width,
      fontFamily: input.fontFamily,
      fontSize: 8,
      fontStyle: input.fontStyle,
      maxLines: input.maxLines + 1,
      autoBalance: input.autoBalance,
      enableHyphenation: input.enableHyphenation,
      forceFullWidth: input.forceFullWidth,
      headlineLayoutMode,
    },
    options,
  );

  return createHeadlineFitResult(absoluteFallback, 8, input.lineHeight);
};

export const TypographyEngine = {
  balanceHeadline,
  measureCharacter,
  measureWord,
  measureLine,
  measureParagraph,
  wrap,
  fitHeadline,
};
