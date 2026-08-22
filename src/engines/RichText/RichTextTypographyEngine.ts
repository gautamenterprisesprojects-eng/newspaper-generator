import { measureTextWidth } from "@/engines/TypographyEngine/TextMeasure";
import type { TextMeasureOptions } from "@/engines/TypographyEngine/TypographyTypes";
import type { ArticleTextStyle } from "@/types/editor";
import type { RichTextContent, RichTextDocument, RichTextSpan } from "@/types/RichText";
import { applyRichTextColorStyle } from "./RichTextColorRenderingEngine";
import { normalizeRichText, richTextToPlainText } from "./RichTextUtils";

export type RichTextTypographySegment = {
  text: string;
  width: number;
  style: ArticleTextStyle;
  start: number;
  end: number;
};

export type RichTextTypographyLine = {
  text: string;
  width: number;
  start: number;
  end: number;
  segments: RichTextTypographySegment[];
};

export type RichTextTypographyResult = {
  lines: RichTextTypographyLine[];
  wrappedLines: string[];
  lineCount: number;
  consumedHeight: number;
  consumedWidth: number;
  paragraphWidth: number;
  paragraphHeight: number;
  overflow: boolean;
  fullLineCount: number;
};

export type RichTextTypographyInput = {
  content: RichTextContent;
  width: number;
  baseStyle: ArticleTextStyle;
  maxLines?: number;
  maxHeight?: number;
  options?: TextMeasureOptions;
};

type RichToken = {
  text: string;
  start: number;
  end: number;
  whitespace: boolean;
  style: ArticleTextStyle;
};

const DEFAULT_LINE_HEIGHT = 1.2;

const getLineHeightPx = (style: ArticleTextStyle) =>
  style.fontSize * (style.lineHeight || DEFAULT_LINE_HEIGHT);

const getNumericWeight = (fontStyle?: string) => {
  if (!fontStyle) {
    return undefined;
  }

  if (/bold/i.test(fontStyle)) {
    return 700;
  }

  const match = fontStyle.match(/[1-9]00/u);

  return match ? Number(match[0]) : undefined;
};

const getResolvedFontStyle = (baseStyle: ArticleTextStyle, span: RichTextSpan) => {
  const italic = span.italic || /italic/i.test(baseStyle.fontStyle ?? "");
  const weight = span.fontWeight ?? (span.bold ? 700 : getNumericWeight(baseStyle.fontStyle));
  const parts: string[] = [];

  if (italic) {
    parts.push("italic");
  }

  if (weight) {
    parts.push(String(weight));
  } else if (baseStyle.fontStyle && !/italic/i.test(baseStyle.fontStyle)) {
    parts.push(baseStyle.fontStyle);
  }

  return parts.join(" ") || undefined;
};

export const resolveRichTextSpanStyle = (
  baseStyle: ArticleTextStyle,
  span: RichTextSpan,
): ArticleTextStyle =>
  applyRichTextColorStyle(
    {
      ...baseStyle,
      fontSize: span.fontSize ?? baseStyle.fontSize,
      fontStyle: getResolvedFontStyle(baseStyle, span),
      textDecoration: span.underline ? "underline" : baseStyle.textDecoration,
    },
    span,
  );

const measureSegment = (text: string, style: ArticleTextStyle, options?: TextMeasureOptions) =>
  measureTextWidth({
    text,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontStyle: style.fontStyle,
  }, options?.provider);

const tokenizeRichText = (document: RichTextDocument, baseStyle: ArticleTextStyle): RichToken[] => {
  const tokens: RichToken[] = [];
  let absoluteOffset = 0;

  for (const span of document.spans) {
    const style = resolveRichTextSpanStyle(baseStyle, span);
    const pattern = /(\s+|\S+)/gu;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(span.text)) !== null) {
      const text = match[0].replace(/\n/g, " ");
      const start = absoluteOffset + match.index;

      tokens.push({
        text,
        start,
        end: start + text.length,
        whitespace: /^\s+$/u.test(text),
        style,
      });
    }

    absoluteOffset += span.text.length;
  }

  return tokens;
};

const mergeCompatibleSegments = (segments: RichTextTypographySegment[]) => {
  const merged: RichTextTypographySegment[] = [];

  for (const segment of segments) {
    const previous = merged.at(-1);

    if (
      previous &&
      previous.style.fontFamily === segment.style.fontFamily &&
      previous.style.fontSize === segment.style.fontSize &&
      previous.style.fontStyle === segment.style.fontStyle &&
      previous.style.fill === segment.style.fill &&
      previous.style.backgroundColor === segment.style.backgroundColor &&
      previous.style.textDecoration === segment.style.textDecoration &&
      previous.end === segment.start
    ) {
      previous.text += segment.text;
      previous.end = segment.end;
      previous.width += segment.width;
    } else {
      merged.push({ ...segment });
    }
  }

  return merged;
};

const createSegmentsFromTokens = (tokens: RichToken[], options?: TextMeasureOptions): RichTextTypographySegment[] =>
  mergeCompatibleSegments(
    tokens.map((token) => ({
      text: token.text,
      start: token.start,
      end: token.end,
      style: token.style,
      width: measureSegment(token.text, token.style, options),
    })),
  );

const measureTokens = (tokens: RichToken[], options?: TextMeasureOptions) =>
  createSegmentsFromTokens(tokens, options).reduce((sum, segment) => sum + segment.width, 0);

const trimLineTokens = (tokens: RichToken[]) => {
  let startIndex = 0;
  let endIndex = tokens.length;

  while (startIndex < endIndex && tokens[startIndex].whitespace) {
    startIndex += 1;
  }

  while (endIndex > startIndex && tokens[endIndex - 1].whitespace) {
    endIndex -= 1;
  }

  return tokens.slice(startIndex, endIndex);
};

const createLine = (tokens: RichToken[], options?: TextMeasureOptions): RichTextTypographyLine | null => {
  const trimmedTokens = trimLineTokens(tokens);

  if (trimmedTokens.length === 0) {
    return null;
  }

  const segments = createSegmentsFromTokens(trimmedTokens, options);
  const text = segments.map((segment) => segment.text).join("");
  const width = segments.reduce((sum, segment) => sum + segment.width, 0);

  return {
    text,
    width,
    start: segments[0].start,
    end: segments[segments.length - 1].end,
    segments,
  };
};

const wrapRichTokens = (tokens: RichToken[], width: number, options?: TextMeasureOptions) => {
  const lines: RichTextTypographyLine[] = [];
  let currentTokens: RichToken[] = [];

  for (const token of tokens) {
    if (currentTokens.length === 0 && token.whitespace) {
      continue;
    }

    const nextTokens = [...currentTokens, token];
    const nextWidth = measureTokens(trimLineTokens(nextTokens), options);

    if (currentTokens.length === 0 || nextWidth <= width || token.whitespace) {
      currentTokens = nextTokens;
      continue;
    }

    const line = createLine(currentTokens, options);

    if (line) {
      lines.push(line);
    }

    currentTokens = token.whitespace ? [] : [token];
  }

  const finalLine = createLine(currentTokens, options);

  if (finalLine) {
    lines.push(finalLine);
  }

  return lines;
};

export const measureRichText = (
  content: RichTextContent,
  baseStyle: ArticleTextStyle,
  options?: TextMeasureOptions,
) => {
  const document = normalizeRichText(content);

  return document.spans.reduce((sum, span) => {
    const style = resolveRichTextSpanStyle(baseStyle, span);

    return sum + measureSegment(span.text, style, options);
  }, 0);
};

export const measureRichTextParagraph = ({
  content,
  width,
  baseStyle,
  maxLines,
  maxHeight,
  options,
}: RichTextTypographyInput): RichTextTypographyResult => {
  const safeWidth = Math.max(0, width);
  const lineHeightPx = getLineHeightPx(baseStyle);
  const tokens = tokenizeRichText(normalizeRichText(content), baseStyle);
  const allLines = wrapRichTokens(tokens, safeWidth, options);
  const maxByHeight =
    typeof maxHeight === "number" ? Math.floor(maxHeight / Math.max(1, lineHeightPx)) : undefined;
  const maxLineCount = Math.min(maxLines ?? Infinity, maxByHeight ?? Infinity);
  const visibleLines = Number.isFinite(maxLineCount)
    ? allLines.slice(0, Math.max(0, maxLineCount))
    : allLines;
  const consumedWidth = visibleLines.reduce((max, line) => Math.max(max, line.width), 0);
  const paragraphWidth = allLines.reduce((max, line) => Math.max(max, line.width), 0);

  return {
    lines: visibleLines,
    wrappedLines: visibleLines.map((line) => line.text),
    lineCount: visibleLines.length,
    consumedHeight: visibleLines.length * lineHeightPx,
    consumedWidth,
    paragraphWidth,
    paragraphHeight: allLines.length * lineHeightPx,
    overflow: visibleLines.length < allLines.length,
    fullLineCount: allLines.length,
  };
};

export const createRichLinesFromWrappedLines = (
  content: RichTextContent,
  wrappedLines: string[],
  baseStyle: ArticleTextStyle,
  options?: TextMeasureOptions,
) => {
  const plainText = richTextToPlainText(content);
  let cursor = 0;

  return wrappedLines.map((lineText) => {
    const start = plainText.indexOf(lineText, cursor);
    const safeStart = start >= 0 ? start : cursor;
    const end = safeStart + lineText.length;
    cursor = end;

    const segments: RichTextTypographySegment[] = [];
    let spanCursor = 0;

    for (const span of normalizeRichText(content).spans) {
      const spanStart = spanCursor;
      const spanEnd = spanCursor + span.text.length;
      spanCursor = spanEnd;

      const segmentStart = Math.max(safeStart, spanStart);
      const segmentEnd = Math.min(end, spanEnd);

      if (segmentStart >= segmentEnd) {
        continue;
      }

      const text = span.text.slice(segmentStart - spanStart, segmentEnd - spanStart);
      const style = resolveRichTextSpanStyle(baseStyle, span);

      segments.push({
        text,
        start: segmentStart,
        end: segmentEnd,
        style,
        width: measureSegment(text, style, options),
      });
    }

    const merged = mergeCompatibleSegments(segments);

    return {
      text: lineText,
      start: safeStart,
      end,
      segments: merged,
      width: merged.reduce((sum, segment) => sum + segment.width, 0),
    };
  });
};

export const RichTextTypographyEngine = {
  createRichLinesFromWrappedLines,
  measureRichText,
  measureRichTextParagraph,
  resolveRichTextSpanStyle,
};
