import { measureTextWidth } from "@/engines/TypographyEngine/TextMeasure";
import type { TextMeasureOptions, TypographyLine, TypographyResult } from "@/engines/TypographyEngine/TypographyTypes";
import type { ArticleTextStyle } from "@/types/editor";

export type BodyWordToken = {
  text: string;
  start: number;
  end: number;
  width: number;
};

export type WordBasedLineBreakInput = {
  text: string;
  width: number;
  style: ArticleTextStyle;
  maxLines?: number;
  maxHeight?: number;
  enableEnglishHyphenation?: boolean;
  options?: TextMeasureOptions;
};

const DEFAULT_LINE_HEIGHT = 1.2;

const measure = (text: string, style: ArticleTextStyle, options?: TextMeasureOptions) =>
  measureTextWidth(
    {
      text,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontStyle: style.fontStyle,
      // This is the body copy's line breaker, so tracking has to be included here or the
      // copyfitter's horizontal adjustments are invisible to wrapping: it would widen the
      // text, measure it at the old width, and break lines in exactly the same places —
      // leaving the bottom gap it was trying to close.
      letterSpacing: style.letterSpacing,
      wordSpacing: style.wordSpacing,
    },
    options?.provider,
  );

export const tokenizeBodyWords = (
  text: string,
  style: ArticleTextStyle,
  options?: TextMeasureOptions,
): BodyWordToken[] => {
  const tokens: BodyWordToken[] = [];
  const pattern = /\S+/gu;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const tokenText = match[0].replace(/\n/g, " ");

    tokens.push({
      text: tokenText,
      start: match.index,
      end: match.index + tokenText.length,
      width: measure(tokenText, style, options),
    });
  }

  return tokens;
};

const createLine = (
  tokens: BodyWordToken[],
  style: ArticleTextStyle,
  options?: TextMeasureOptions,
): TypographyLine | null => {
  if (!tokens.length) {
    return null;
  }

  const text = tokens.map((token) => token.text).join(" ");

  return {
    text,
    start: tokens[0].start,
    end: tokens[tokens.length - 1].end,
    width: measure(text, style, options),
  };
};

const splitTrailingPunctuation = (text: string) => {
  const match = text.match(/^([A-Za-z][A-Za-z'-]*[A-Za-z])([,.;:!?)]*)$/u);
  return match ? { word: match[1], punctuation: match[2] } : null;
};

const shouldHyphenateEnglishWord = (text: string) => {
  const parts = splitTrailingPunctuation(text);
  if (!parts) return false;
  const { word } = parts;
  if (word.length < 10 || word.length > 24) return false;
  if (/[0-9]/u.test(word) || /^[A-Z]+$/u.test(word)) return false;
  if (/^[A-Z][a-z]+$/u.test(word)) return false;
  return /[aeiouy]/iu.test(word.slice(3, -3));
};

const getEnglishHyphenationIndexes = (word: string) => {
  const indexes: number[] = [];
  for (let index = 4; index <= word.length - 4; index += 1) {
    const previous = word[index - 1] ?? "";
    const current = word[index] ?? "";
    const beforePrevious = word[index - 2] ?? "";
    if (/[aeiouy]/iu.test(previous) && /[bcdfghjklmnpqrstvwxyz]/iu.test(current)) {
      indexes.push(index);
    } else if (/[bcdfghjklmnpqrstvwxyz]/iu.test(previous) && /[bcdfghjklmnpqrstvwxyz]/iu.test(current) && /[aeiouy]/iu.test(beforePrevious)) {
      indexes.push(index);
    }
  }
  return Array.from(new Set(indexes)).sort((a, b) => b - a);
};

const tryHyphenateIntoLine = ({
  currentTokens,
  token,
  safeWidth,
  style,
  options,
}: {
  currentTokens: BodyWordToken[];
  token: BodyWordToken;
  safeWidth: number;
  style: ArticleTextStyle;
  options?: TextMeasureOptions;
}) => {
  const parts = splitTrailingPunctuation(token.text);
  if (!parts || !shouldHyphenateEnglishWord(token.text)) {
    return null;
  }

  for (const index of getEnglishHyphenationIndexes(parts.word)) {
    const prefixText = `${parts.word.slice(0, index)}-`;
    const suffixText = `${parts.word.slice(index)}${parts.punctuation}`;
    const prefixToken: BodyWordToken = {
      ...token,
      text: prefixText,
      end: token.start + prefixText.length,
      width: measure(prefixText, style, options),
    };
    const candidateLine = createLine([...currentTokens, prefixToken], style, options);

    if (candidateLine && candidateLine.width <= safeWidth) {
      return {
        prefixToken,
        suffixToken: {
          ...token,
          text: suffixText,
          start: prefixToken.end,
          width: measure(suffixText, style, options),
        },
      };
    }
  }

  return null;
};

export const measureWordBasedBodyParagraph = ({
  text,
  width,
  style,
  maxLines,
  maxHeight,
  enableEnglishHyphenation = false,
  options,
}: WordBasedLineBreakInput): TypographyResult => {
  const safeWidth = Math.max(1, width);
  const tokens = tokenizeBodyWords(text, style, options);
  const lines: TypographyLine[] = [];
  let currentTokens: BodyWordToken[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const candidateTokens = [...currentTokens, token];
    const candidateLine = createLine(candidateTokens, style, options);

    if (!currentTokens.length || (candidateLine && candidateLine.width <= safeWidth)) {
      currentTokens = candidateTokens;
      continue;
    }

    if (enableEnglishHyphenation) {
      const hyphenated = tryHyphenateIntoLine({
        currentTokens,
        token,
        safeWidth,
        style,
        options,
      });

      if (hyphenated) {
        const line = createLine([...currentTokens, hyphenated.prefixToken], style, options);
        if (line) {
          lines.push(line);
        }
        currentTokens = [];
        tokens.splice(index + 1, 0, hyphenated.suffixToken);
        continue;
      }
    }

    const line = createLine(currentTokens, style, options);

    if (line) {
      lines.push(line);
    }

    currentTokens = [token];
  }

  const finalLine = createLine(currentTokens, style, options);

  if (finalLine) {
    lines.push(finalLine);
  }

  const lineHeightPx = style.fontSize * (style.lineHeight || DEFAULT_LINE_HEIGHT);
  const maxByHeight = typeof maxHeight === "number" ? Math.floor(maxHeight / Math.max(1, lineHeightPx)) : undefined;
  const maxLineCount = Math.min(maxLines ?? Infinity, maxByHeight ?? Infinity);
  const visibleLines = Number.isFinite(maxLineCount)
    ? lines.slice(0, Math.max(0, maxLineCount))
    : lines;
  const consumedWidth = visibleLines.reduce((max, line) => Math.max(max, line.width), 0);
  const paragraphWidth = lines.reduce((max, line) => Math.max(max, line.width), 0);

  return {
    lines: visibleLines,
    wrappedLines: visibleLines.map((line) => line.text),
    lineCount: visibleLines.length,
    consumedHeight: visibleLines.length * lineHeightPx,
    consumedWidth,
    paragraphWidth,
    paragraphHeight: lines.length * lineHeightPx,
    overflow: visibleLines.length < lines.length,
    fullLineCount: lines.length,
  };
};

export const DevanagariLineBreakEngine = {
  tokenizeBodyWords,
  measureWordBasedBodyParagraph,
};
