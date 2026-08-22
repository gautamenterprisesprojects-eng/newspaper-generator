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
  ArticleFactBoxData,
  ArticleObjectContainerStyles,
  FactBoxTheme,
  ArticleLayoutTextBlock,
  ArticleLayoutTextLine,
  ArticleTextStyle,
  FactBoxLayout,
  UniversalTypographyControls,
} from "@/types/editor";

export type FactBoxInput = {
  data: ArticleFactBoxData;
  x: number;
  y: number;
  width: number;
  baselineGridSize?: number;
  theme?: FactBoxTheme;
  typography?: UniversalTypographyControls;
  containerStyles?: ArticleObjectContainerStyles;
};

const FACT_BOX_PADDING = 8;
const BULLET_PREFIX = "• ";

const headlineStyle: ArticleTextStyle = {
  fill: "#16130f",
  fontFamily: getNewspaperFontStack("sans"),
  fontSize: 11,
  fontStyle: "bold",
  lineHeight: 1.25,
  wrap: "none",
};

const bulletStyle: ArticleTextStyle = {
  fill: "#4a443b",
  fontFamily: getNewspaperFontStack("sans"),
  fontSize: 9.5,
  lineHeight: 1.25,
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
    engineMode: typography?.factBoxContentJustifyEngineMode ?? typography?.justifyEngineMode ?? "newspaper",
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
        (typography?.factBoxContentJustifyMode === "justify-all-lines" || index < wrappedLines.length - 1),
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

const measureFactBoxParagraph = (
  content: ArticleFactBoxData["headline"] | ArticleFactBoxData["bullets"][number],
  text: string,
  width: number,
  style: ArticleTextStyle,
  maxLines: number,
  options?: TextMeasureOptions,
): TypographyResult => {
  if (typeof content !== "string") {
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

  return measureParagraph(
    {
      text,
      width,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      maxLines,
      script: "mixed",
    },
    options,
  );
};

export const composeFactBox = (
  { data, x, y, width, baselineGridSize = 12, theme, typography, containerStyles: inputContainerStyles }: FactBoxInput,
  options?: TextMeasureOptions,
): FactBoxLayout | null => {
  const headline = normalizeText(data.headline);
  const bullets = data.bullets
    .map((content) => ({
      content,
      text: normalizeText(content),
    }))
    .filter((bullet) => Boolean(bullet.text));

  if (!headline && bullets.length === 0) {
    return null;
  }

  const contentX = x + FACT_BOX_PADDING;
  const contentY = y + FACT_BOX_PADDING;
  const contentWidth = Math.max(1, width - FACT_BOX_PADDING * 2);
  const containerStyles = normalizeContainerStyles(inputContainerStyles);
  const resolvedHeadlineStyle = {
    ...headlineStyle,
    fill: theme?.headerColor ?? headlineStyle.fill,
    align: typography?.factBoxHeadlineAlignment ?? "left",
  };
  const resolvedBulletStyle = {
    ...bulletStyle,
    fill: theme?.textColor ?? bulletStyle.fill,
    align: typography?.factBoxContentAlignment ?? "left",
    wordSpacing: typography?.wordSpacing ?? 0,
  };
  const headlineMetrics = measureFactBoxParagraph(data.headline, headline, contentWidth, resolvedHeadlineStyle, 2, options);
  const headlineBlock = applyContainerStyleToTextBlock(createTextBlock(
    contentX,
    contentY,
    contentWidth,
    headline,
    resolvedHeadlineStyle,
    headlineMetrics,
    baselineGridSize,
    typeof data.headline === "string"
      ? undefined
      : createRichLinesFromWrappedLines(data.headline, headlineMetrics.wrappedLines, resolvedHeadlineStyle),
    typography,
  ), {
    ...containerStyles.factBoxHeading,
    containerBackgroundColor: theme?.headerColor ?? containerStyles.factBoxHeading.containerBackgroundColor,
  }, { width: contentWidth, height: headlineMetrics.consumedHeight });
  const bulletStartY = headline
    ? headlineBlock.y + headlineBlock.height + 6
    : contentY;
  const bulletBlocks: ArticleLayoutTextBlock[] = [];

  for (const bullet of bullets) {
    const previous = bulletBlocks.at(-1) ?? null;
    const bulletY = previous ? previous.y + previous.height + 4 : bulletStartY;
    const showBullet = theme?.name !== "custom";
    const text = showBullet ? `${BULLET_PREFIX}${bullet.text}` : bullet.text;
    const bulletContent =
      typeof bullet.content === "string"
        ? text
        : {
            spans: showBullet
              ? [{ text: BULLET_PREFIX }, ...bullet.content.spans]
              : bullet.content.spans,
          };
    const metrics = measureFactBoxParagraph(bulletContent, text, contentWidth, resolvedBulletStyle, 10, options);

    bulletBlocks.push(
      applyContainerStyleToTextBlock(createTextBlock(
        contentX,
        bulletY,
        contentWidth,
        text,
        resolvedBulletStyle,
        metrics,
        baselineGridSize,
        typeof bulletContent === "string"
          ? undefined
          : createRichLinesFromWrappedLines(bulletContent, metrics.wrappedLines, resolvedBulletStyle),
        typography,
      ), containerStyles.factBoxContent, { width: contentWidth, height: metrics.consumedHeight }),
    );
  }
  const lastBlock = bulletBlocks.at(-1) ?? headlineBlock;
  const height = lastBlock.y + lastBlock.height - y + FACT_BOX_PADDING;

  return {
    x,
    y,
    width,
    height,
    headline: headlineBlock,
    bullets: bulletBlocks,
    fill: theme?.background ?? "#f6f1e6",
    stroke: theme?.border ?? "#b4a995",
    strokeWidth: 1,
    padding: FACT_BOX_PADDING,
    borderRadius: theme?.name === "custom" ? 12 : undefined,
  };
};

export const FactBoxEngine = {
  composeFactBox,
};
