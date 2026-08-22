import { measureParagraph } from "@/engines/TypographyEngine/TypographyEngine";
import { measureTextWidth } from "@/engines/TypographyEngine/TextMeasure";
import { justifyNewspaperLine } from "@/engines/NewspaperJustification/NewspaperJustificationEngine";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import {
  createBaselineGrid,
  createBaselineTextMetrics,
} from "@/engines/BaselineGridEngine/BaselineGridEngine";
import { richTextToPlainText } from "@/engines/RichText/RichTextUtils";
import {
  createRichLinesFromWrappedLines,
  measureRichTextParagraph,
} from "@/engines/RichText/RichTextTypographyEngine";
import {
  applyContainerStyleToTextBlock,
  normalizeContainerStyles,
} from "@/engines/ContainerBackground/ContainerBackgroundEngine";
import type { TextMeasureOptions, TypographyResult } from "@/engines/TypographyEngine/TypographyTypes";
import type {
  ArticleLayoutTextBlock,
  ArticleLayoutTextLine,
  ArticleObjectContainerStyles,
  ArticlePullQuoteData,
  ArticleTextStyle,
  PullQuoteLayout,
  PullQuoteTheme,
  UniversalTypographyControls,
} from "@/types/editor";

export type PullQuoteInput = {
  data: ArticlePullQuoteData;
  x: number;
  y: number;
  width: number;
  baselineGridSize?: number;
  theme?: PullQuoteTheme;
  typography?: UniversalTypographyControls;
  containerStyles?: ArticleObjectContainerStyles;
};

const PULL_QUOTE_PADDING = 10;
const MAX_PULL_QUOTE_LINES = 4;

const pullQuoteStyle: ArticleTextStyle = {
  align: "center",
  fill: "#1d1710",
  fontFamily: getNewspaperFontStack("serif"),
  fontSize: 18,
  fontStyle: "700",
  lineHeight: 1.15,
  wrap: "none",
};

const normalizeText = (value: Parameters<typeof richTextToPlainText>[0]) =>
  richTextToPlainText(value).replace(/\s+/gu, " ").trim();

const getLineHeightPx = (style: ArticleTextStyle) => style.fontSize * style.lineHeight;

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

const expandLineForNewspaperJustification = (
  text: string,
  targetWidth: number,
  style: ArticleTextStyle,
  justify: boolean,
  typography?: UniversalTypographyControls,
) => {
  return justifyNewspaperLine({
    text,
    targetWidth,
    style,
    justify,
    engineMode: typography?.bodyJustifyEngineMode ?? typography?.justifyEngineMode ?? "newspaper",
  }).text;
};

const createLineBoxes = (
  x: number,
  width: number,
  wrappedLines: string[],
  style: ArticleTextStyle,
  linePositions: number[],
  lineAdvance: number,
  richLines?: ReturnType<typeof createRichLinesFromWrappedLines>,
  typography?: UniversalTypographyControls,
): ArticleLayoutTextLine[] => {
  return wrappedLines.map((line, index) => {
    const richLine = richLines?.[index];
    const renderText = expandLineForNewspaperJustification(
      line,
      width,
      style,
      style.align === "justify" &&
        (typography?.bodyJustifyMode === "justify-all-lines" || index < wrappedLines.length - 1),
      typography,
    );
    const contentWidth = richLine?.width ?? measureRenderedTextWidth(renderText, style);
    const lineX = getAlignedX(x, width, contentWidth, style.align);

    return {
      x,
      y: linePositions[index],
      width,
      height: lineAdvance,
      text: renderText,
      style,
      segments: richLine?.segments.map((segment) => {
      let segmentX = lineX;

      for (const previous of richLine.segments) {
        if (previous === segment) {
          break;
        }

        segmentX += previous.width;
      }

      return {
        x: segmentX,
        y: linePositions[index],
        width: segment.width,
        height: lineAdvance,
          text: segment.text,
          style: segment.style,
        };
      }),
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
  baselineGridSize: number,
  richLines?: ReturnType<typeof createRichLinesFromWrappedLines>,
  typography?: UniversalTypographyControls,
): ArticleLayoutTextBlock => {
  const baselineMetrics = createBaselineTextMetrics({
    y,
    lineCount: metrics.wrappedLines.length,
    lineHeight: getLineHeightPx(style),
    baselineGrid: createBaselineGrid(baselineGridSize),
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
    lineBoxes: createLineBoxes(
      x,
      width,
      metrics.wrappedLines,
      style,
      baselineMetrics.linePositions,
      baselineMetrics.lineAdvance,
      richLines,
      typography,
    ),
  };
};

export const composePullQuote = (
  { data, x, y, width, baselineGridSize = 12, theme, typography, containerStyles: inputContainerStyles }: PullQuoteInput,
  options?: TextMeasureOptions,
): PullQuoteLayout | null => {
  const text = normalizeText(data.text);

  if (!text) {
    return null;
  }

  const contentX = x + PULL_QUOTE_PADDING;
  const contentY = y + PULL_QUOTE_PADDING;
  const contentWidth = Math.max(1, width - PULL_QUOTE_PADDING * 2);
  const containerStyles = normalizeContainerStyles(inputContainerStyles);
  const resolvedPullQuoteStyle = {
    ...pullQuoteStyle,
    align: typography?.pullQuoteAlignment ?? pullQuoteStyle.align,
    fill: theme?.textColor ?? pullQuoteStyle.fill,
    wordSpacing: typography?.wordSpacing ?? 0,
  };
  const metrics: TypographyResult =
    typeof data.text === "string"
      ? measureParagraph(
          {
            text,
            width: contentWidth,
            fontFamily: resolvedPullQuoteStyle.fontFamily,
            fontSize: resolvedPullQuoteStyle.fontSize,
            lineHeight: resolvedPullQuoteStyle.lineHeight,
            maxLines: MAX_PULL_QUOTE_LINES,
            script: "mixed",
          },
          options,
        )
      : (() => {
          const richMetrics = measureRichTextParagraph({
            content: data.text,
            width: contentWidth,
            baseStyle: resolvedPullQuoteStyle,
            maxLines: MAX_PULL_QUOTE_LINES,
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
        })();
  const textBlock = applyContainerStyleToTextBlock(createTextBlock(
    contentX,
    contentY,
    contentWidth,
    text,
    resolvedPullQuoteStyle,
    metrics,
    baselineGridSize,
    typeof data.text === "string"
      ? undefined
      : createRichLinesFromWrappedLines(data.text, metrics.wrappedLines, resolvedPullQuoteStyle),
    typography,
  ), {
    ...containerStyles.pullQuote,
    containerBackgroundColor: "transparent",
  }, { width: contentWidth, height: metrics.consumedHeight });

  return {
    x,
    y,
    width,
    height: textBlock.height + PULL_QUOTE_PADDING * 2,
    textBlock,
    fill: theme?.backgroundColor ?? "#fff6dc",
    stroke: theme?.borderColor ?? "#b99546",
    strokeWidth: 1,
    padding: PULL_QUOTE_PADDING,
  };
};

export const PullQuoteEngine = {
  composePullQuote,
};
