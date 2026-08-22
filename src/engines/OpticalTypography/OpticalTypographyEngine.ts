import { measureTextWidth } from "@/engines/TypographyEngine/TextMeasure";
import type {
  ArticleLayout,
  ArticleLayoutBodyColumn,
  ArticleLayoutTextBlock,
  ArticleLayoutTextLine,
  ArticleLayoutTextSegment,
  ArticleTextStyle,
  CaptionLayout,
  FactBoxLayout,
  PullQuoteLayout,
} from "@/types/editor";

export type OpticalTypographyDiagnostics = {
  opticalGlyphCount: number;
  leftHangingCount: number;
  rightHangingCount: number;
  averageHangPercent: number;
};

type OpticalTypographyAccumulator = {
  opticalGlyphCount: number;
  leftHangingCount: number;
  rightHangingCount: number;
  hangRatioTotal: number;
};

const zeroDiagnostics: OpticalTypographyDiagnostics = {
  opticalGlyphCount: 0,
  leftHangingCount: 0,
  rightHangingCount: 0,
  averageHangPercent: 0,
};

const leftHangRatios = new Map<string, number>([
  ['"', 0.35],
  ["'", 0.3],
  ["“", 0.4],
  ["‘", 0.35],
  ["(", 0.15],
  ["[", 0.15],
  ["-", 0.15],
  ["–", 0.2],
  ["—", 0.25],
]);

const rightHangRatios = new Map<string, number>([
  ['"', 0.35],
  ["'", 0.3],
  ["”", 0.4],
  ["’", 0.35],
  [",", 0.35],
  [".", 0.35],
  [":", 0.3],
  [";", 0.35],
  ["!", 0.25],
  ["?", 0.25],
  ["-", 0.2],
  ["–", 0.25],
  ["—", 0.3],
  [")", 0.2],
  ["]", 0.2],
  ["%", 0.15],
  ["₹", 0.1],
  ["$", 0.1],
  ["€", 0.1],
  ["°", 0.35],
]);

const measureSegmentText = (text: string, style: ArticleTextStyle) =>
  measureTextWidth({
    text,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontStyle: style.fontStyle,
  });

const round = (value: number) => Math.round(value * 1000) / 1000;

const getAlignedLineStart = (line: ArticleLayoutTextLine) => {
  const measuredWidth = measureSegmentText(line.text, line.style);

  if (line.style.align === "center") {
    return line.x + Math.max(0, line.width - measuredWidth) / 2;
  }

  if (line.style.align === "right") {
    return line.x + Math.max(0, line.width - measuredWidth);
  }

  return line.x;
};

const createLineSegment = (line: ArticleLayoutTextLine): ArticleLayoutTextSegment => ({
  x: getAlignedLineStart(line),
  y: line.y,
  width: measureSegmentText(line.text, line.style),
  height: line.height,
  text: line.text,
  style: {
    ...line.style,
    wrap: "none",
  },
});

const registerLeftHang = (
  segment: ArticleLayoutTextSegment,
  accumulator: OpticalTypographyAccumulator,
) => {
  const firstGlyph = Array.from(segment.text.trimStart())[0];
  const ratio = firstGlyph ? leftHangRatios.get(firstGlyph) : undefined;

  if (!firstGlyph || ratio === undefined) {
    return segment;
  }

  const glyphWidth = measureSegmentText(firstGlyph, segment.style);
  const hang = glyphWidth * ratio;
  accumulator.opticalGlyphCount += 1;
  accumulator.leftHangingCount += 1;
  accumulator.hangRatioTotal += ratio;

  return {
    ...segment,
    x: round(segment.x - hang),
    width: round(segment.width + hang),
  };
};

const splitRightHangingGlyph = (
  segment: ArticleLayoutTextSegment,
  accumulator: OpticalTypographyAccumulator,
): ArticleLayoutTextSegment[] => {
  const glyphs = Array.from(segment.text);
  const lastGlyph = glyphs.at(-1);
  const ratio = lastGlyph ? rightHangRatios.get(lastGlyph) : undefined;

  if (!lastGlyph || ratio === undefined) {
    return [segment];
  }

  const glyphWidth = measureSegmentText(lastGlyph, segment.style);
  const hang = glyphWidth * ratio;
  accumulator.opticalGlyphCount += 1;
  accumulator.rightHangingCount += 1;
  accumulator.hangRatioTotal += ratio;

  if (glyphs.length === 1) {
    return [
      {
        ...segment,
        x: round(segment.x + hang),
        width: round(glyphWidth),
      },
    ];
  }

  const baseText = glyphs.slice(0, -1).join("");
  const baseWidth = measureSegmentText(baseText, segment.style);

  return [
    {
      ...segment,
      text: baseText,
      width: round(baseWidth),
    },
    {
      ...segment,
      x: round(segment.x + baseWidth + hang),
      width: round(glyphWidth),
      text: lastGlyph,
    },
  ];
};

const applyOpticalMarginToLine = (
  line: ArticleLayoutTextLine,
  accumulator: OpticalTypographyAccumulator,
): ArticleLayoutTextLine => {
  if (!line.text) {
    return line;
  }

  let segments =
    line.segments && line.segments.length > 0
      ? line.segments.map((segment) => ({ ...segment, style: { ...segment.style, wrap: "none" as const } }))
      : [createLineSegment(line)];

  if (segments.length === 0) {
    return line;
  }

  segments = [
    registerLeftHang(segments[0], accumulator),
    ...segments.slice(1),
  ];

  const lastIndex = segments.length - 1;
  segments = [
    ...segments.slice(0, lastIndex),
    ...splitRightHangingGlyph(segments[lastIndex], accumulator),
  ];

  return {
    ...line,
    segments,
  };
};

const applyOpticalMarginToTextBlock = (
  block: ArticleLayoutTextBlock,
  accumulator: OpticalTypographyAccumulator,
): ArticleLayoutTextBlock => ({
  ...block,
  lineBoxes: block.lineBoxes.map((line) => applyOpticalMarginToLine(line, accumulator)),
});

const applyOpticalMarginToCaption = (
  caption: CaptionLayout | null,
  accumulator: OpticalTypographyAccumulator,
): CaptionLayout | null =>
  caption
    ? {
        ...caption,
        textBlock: applyOpticalMarginToTextBlock(caption.textBlock, accumulator),
        creditBlock: caption.creditBlock
          ? applyOpticalMarginToTextBlock(caption.creditBlock, accumulator)
          : null,
        sourceBlock: caption.sourceBlock
          ? applyOpticalMarginToTextBlock(caption.sourceBlock, accumulator)
          : null,
      }
    : null;

const applyOpticalMarginToFactBox = (
  factBox: FactBoxLayout | null,
  accumulator: OpticalTypographyAccumulator,
): FactBoxLayout | null =>
  factBox
    ? {
        ...factBox,
        headline: applyOpticalMarginToTextBlock(factBox.headline, accumulator),
        bullets: factBox.bullets.map((bullet) => applyOpticalMarginToTextBlock(bullet, accumulator)),
      }
    : null;

const applyOpticalMarginToPullQuote = (
  pullQuote: PullQuoteLayout | null,
  accumulator: OpticalTypographyAccumulator,
): PullQuoteLayout | null =>
  pullQuote
    ? {
        ...pullQuote,
        textBlock: applyOpticalMarginToTextBlock(pullQuote.textBlock, accumulator),
      }
    : null;

const applyOpticalMarginToBodyColumn = (
  column: ArticleLayoutBodyColumn,
  accumulator: OpticalTypographyAccumulator,
): ArticleLayoutBodyColumn => ({
  ...column,
  lines: column.lines.map((line) => applyOpticalMarginToLine(line, accumulator)),
});

const finalizeDiagnostics = (accumulator: OpticalTypographyAccumulator): OpticalTypographyDiagnostics => ({
  opticalGlyphCount: accumulator.opticalGlyphCount,
  leftHangingCount: accumulator.leftHangingCount,
  rightHangingCount: accumulator.rightHangingCount,
  averageHangPercent:
    accumulator.opticalGlyphCount > 0
      ? Math.round((accumulator.hangRatioTotal / accumulator.opticalGlyphCount) * 1000) / 10
      : 0,
});

export const applyOpticalTypography = (
  layout: ArticleLayout,
  enabled = true,
): { layout: ArticleLayout; diagnostics: OpticalTypographyDiagnostics } => {
  if (!enabled) {
    return {
      layout,
      diagnostics: zeroDiagnostics,
    };
  }

  const accumulator: OpticalTypographyAccumulator = {
    opticalGlyphCount: 0,
    leftHangingCount: 0,
    rightHangingCount: 0,
    hangRatioTotal: 0,
  };

  const opticalLayout: ArticleLayout = {
    ...layout,
    headline: applyOpticalMarginToTextBlock(layout.headline, accumulator),
    caption: applyOpticalMarginToCaption(layout.caption, accumulator),
    factBox: applyOpticalMarginToFactBox(layout.factBox, accumulator),
    pullQuote: applyOpticalMarginToPullQuote(layout.pullQuote, accumulator),
    body: {
      ...layout.body,
      columns: layout.body.columns.map((column) => applyOpticalMarginToBodyColumn(column, accumulator)),
    },
  };

  return {
    layout: {
      ...opticalLayout,
      metrics: {
        ...opticalLayout.metrics,
        ...finalizeDiagnostics(accumulator),
      },
    },
    diagnostics: finalizeDiagnostics(accumulator),
  };
};

