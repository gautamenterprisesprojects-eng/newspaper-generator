import "regenerator-runtime/runtime";
import fontkit from "@pdf-lib/fontkit";
import {
  clip,
  cmyk,
  endPath,
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFName,
  PDFPage,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  StandardFonts,
} from "pdf-lib";
import { computeImageCoverCrop } from "@/engines/ImagePlacement/computeImageCoverCrop";
import type {
  ArticleLayoutTextBlock,
  ArticleLayoutTextLine,
  ArticleTextStyle,
  EditorialLabelLayout,
  FactBoxLayout,
  PullQuoteLayout,
} from "@/types/editor";
import { layoutFrameTextBlock } from "@/engines/FrameLayout/FrameLayoutEngine";
import type {
  PrintPDFArticle,
  PrintPDFColor,
  PrintPDFDocumentInput,
  PrintPDFImageAsset,
  PrintPDFImageMetric,
  PrintPDFOptions,
  PrintPDFPreflightIssue,
  PrintPDFResult,
} from "./PrintPDFTypes";

const defaultOptions: PrintPDFOptions = {
  bleed: 18,
  cropMarkLength: 18,
  cropMarkOffset: 6,
  cropMarkStrokeWidth: 0.5,
  minimumImageDpi: 300,
  subsetFonts: true,
  allowStandardFontFallback: false,
};

const registrationBlack: PrintPDFColor = {
  cyan: 0,
  magenta: 0,
  yellow: 0,
  key: 1,
};

const paperWhite: PrintPDFColor = {
  cyan: 0,
  magenta: 0,
  yellow: 0,
  key: 0,
};

const clampUnit = (value: number) => Math.min(Math.max(value, 0), 1);

const toCmyk = ({ cyan, magenta, yellow, key }: PrintPDFColor) =>
  cmyk(clampUnit(cyan), clampUnit(magenta), clampUnit(yellow), clampUnit(key));

const parseHexColor = (value: string) => {
  const normalized = value.trim();

  if (!normalized.startsWith("#")) {
    return null;
  }

  const hex = normalized.slice(1);
  const expanded =
    hex.length === 3
      ? hex
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : hex;

  if (expanded.length !== 6) {
    return null;
  }

  const red = Number.parseInt(expanded.slice(0, 2), 16) / 255;
  const green = Number.parseInt(expanded.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(expanded.slice(4, 6), 16) / 255;

  if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
    return null;
  }

  const key = 1 - Math.max(red, green, blue);

  if (key >= 1) {
    return {
      cyan: 0,
      magenta: 0,
      yellow: 0,
      key: 1,
    };
  }

  return {
    cyan: (1 - red - key) / (1 - key),
    magenta: (1 - green - key) / (1 - key),
    yellow: (1 - blue - key) / (1 - key),
    key,
  };
};

const parseRgbaColor = (value: string) => {
  const match = value
    .trim()
    .match(/^rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)(?:,\s*(\d?(?:\.\d+)?))?\)$/u);

  if (!match) {
    return null;
  }

  const alpha = typeof match[4] === "string" ? Number.parseFloat(match[4]) : 1;

  if (alpha <= 0) {
    return null;
  }

  const rawRed = Number.parseFloat(match[1]);
  const rawGreen = Number.parseFloat(match[2]);
  const rawBlue = Number.parseFloat(match[3]);
  // Composite semi-transparent RGBA tints against paper white (255, 254, 249) for CMYK conversion
  const effectiveRed = alpha < 1 ? rawRed * alpha + 255 * (1 - alpha) : rawRed;
  const effectiveGreen = alpha < 1 ? rawGreen * alpha + 254 * (1 - alpha) : rawGreen;
  const effectiveBlue = alpha < 1 ? rawBlue * alpha + 249 * (1 - alpha) : rawBlue;

  const red = clampUnit(effectiveRed / 255);
  const green = clampUnit(effectiveGreen / 255);
  const blue = clampUnit(effectiveBlue / 255);
  const key = 1 - Math.max(red, green, blue);

  if (key >= 1) {
    return {
      cyan: 0,
      magenta: 0,
      yellow: 0,
      key: 1,
    };
  }

  return {
    cyan: (1 - red - key) / (1 - key),
    magenta: (1 - green - key) / (1 - key),
    yellow: (1 - blue - key) / (1 - key),
    key,
  };
};

export const parsePrintColor = (value?: string): PrintPDFColor | null => {
  if (!value || value === "transparent") {
    return null;
  }

  return parseHexColor(value) ?? parseRgbaColor(value) ?? registrationBlack;
};

const toPdfY = (mediaHeight: number, trimOffset: number, y: number, height: number) =>
  mediaHeight - trimOffset - y - height;

const getFontRole = (style: ArticleTextStyle) => {
  const family = style.fontFamily.toLowerCase();

  if (family.includes("serif")) {
    return "serif";
  }

  if (family.includes("mono") || family.includes("courier")) {
    return "mono";
  }

  return "sans";
};

const getLineTextY = (
  mediaHeight: number,
  trimOffset: number,
  line: ArticleLayoutTextLine,
  style: ArticleTextStyle,
) => {
  const lineBottom = toPdfY(mediaHeight, trimOffset, line.y ?? 0, line.height ?? style.fontSize);
  const text = line.text ?? "";
  const isDisplayText =
    /[\u0900-\u097F]/u.test(text) &&
    (style.fontSize >= 13 ||
      /\b(600|700|800|900|bold)\b/i.test(style.fontStyle ?? "") ||
      Boolean(style.backgroundColor && style.backgroundColor !== "transparent"));
  const devanagariTopSafety = isDisplayText ? Math.min(6, Math.max(2.2, style.fontSize * 0.16)) : 0;
  const displayInkShiftY = isDisplayText ? Math.min(4, Math.max(2, style.fontSize * 0.1)) : 0;

  return lineBottom +
    Math.max(0, ((line.height ?? style.fontSize) - style.fontSize) / 2) -
    devanagariTopSafety -
    displayInkShiftY;
};

const getTextX = (
  line: ArticleLayoutTextLine,
  font: PDFFont,
  style: ArticleTextStyle,
) => {
  if (style.align !== "center" && style.align !== "right") {
    return line.x;
  }

  const textWidth =
    line.measuredWidth ??
    (font.widthOfTextAtSize(line.text, style.fontSize) +
      Math.max(0, line.text.length - 1) * (style.letterSpacing ?? 0));
  const remainingWidth = Math.max(0, line.width - textWidth);

  if (style.align === "right") {
    return line.x + remainingWidth;
  }

  return line.x + remainingWidth / 2;
};

const createFontFallback = async (pdfDoc: PDFDocument) => ({
  serif: await pdfDoc.embedFont(StandardFonts.TimesRoman),
  sans: await pdfDoc.embedFont(StandardFonts.Helvetica),
  mono: await pdfDoc.embedFont(StandardFonts.Courier),
});

const embedFonts = async (
  pdfDoc: PDFDocument,
  input: PrintPDFDocumentInput,
  options: PrintPDFOptions,
  issues: PrintPDFPreflightIssue[],
) => {
  if (input.fonts.length === 0 && options.allowStandardFontFallback) {
    return {
      fontsByRole: await createFontFallback(pdfDoc),
      embeddedFontIds: ["standard-serif", "standard-sans", "standard-mono"],
    };
  }

  if (input.fonts.length === 0) {
    issues.push({
      code: "missing-font",
      severity: "error",
      message: "PrintPDFEngine requires embedded font assets for print-ready output.",
    });
  }

  const fontsByRole = new Map<string, PDFFont>();
  const embeddedFontIds: string[] = [];

  for (const font of input.fonts) {
    const embeddedFont = await pdfDoc.embedFont(font.data, {
      subset: options.subsetFonts,
    });

    fontsByRole.set(font.role, embeddedFont);
    embeddedFontIds.push(font.id);
  }

  if (fontsByRole.size === 0 && options.allowStandardFontFallback) {
    const fallback = await createFontFallback(pdfDoc);

    return {
      fontsByRole: fallback,
      embeddedFontIds: ["standard-serif", "standard-sans", "standard-mono"],
    };
  }

  for (const role of ["serif", "sans", "mono"]) {
    if (!fontsByRole.has(role)) {
      issues.push({
        code: "missing-font",
        severity: "error",
        message: `Missing embedded ${role} font asset.`,
      });
    }
  }

  return {
    fontsByRole: {
      serif: fontsByRole.get("serif"),
      sans: fontsByRole.get("sans"),
      mono: fontsByRole.get("mono"),
    },
    embeddedFontIds,
  };
};

const embedImages = async (
  pdfDoc: PDFDocument,
  images: PrintPDFImageAsset[] = [],
) => {
  const imageMap = new Map<string, PDFImage>();
  const debugImages = typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEBUG_PDF_IMAGES === "true";

  for (const image of images) {
    if (debugImages) console.log(`[ImageExportDiagnostic] Processing PrintPDFImageAsset: id=${image.id}, mimeType=${image.mimeType}, byteLength=${image.data?.byteLength}`);
    try {
      const embeddedImage =
        image.mimeType === "image/png"
          ? await pdfDoc.embedPng(image.data)
          : await pdfDoc.embedJpg(image.data);
      if (debugImages) console.log(`[ImageExportDiagnostic] Successfully embedded image id=${image.id} in PDF`);
      imageMap.set(image.id, embeddedImage);
    } catch (e) {
      if (debugImages) console.error(`[ImageExportDiagnostic] Failed to embed image id=${image.id} in PDF:`, e);
    }
  }

  return imageMap;
};

const drawTrimAndBleedBoxes = (
  pdfDoc: PDFDocument,
  page: PDFPage,
  width: number,
  height: number,
  trimOffset: number,
  bleed: number,
) => {
  page.node.set(
    PDFName.of("TrimBox"),
    pdfDoc.context.obj([trimOffset, trimOffset, trimOffset + width, trimOffset + height]),
  );
  page.node.set(
    PDFName.of("BleedBox"),
    pdfDoc.context.obj([
      trimOffset - bleed,
      trimOffset - bleed,
      trimOffset + width + bleed,
      trimOffset + height + bleed,
    ]),
  );
};

const drawCropMarks = (
  page: PDFPage,
  trimWidth: number,
  trimHeight: number,
  trimOffset: number,
  options: PrintPDFOptions,
) => {
  const color = toCmyk(registrationBlack);
  const left = trimOffset;
  const right = trimOffset + trimWidth;
  const bottom = trimOffset;
  const top = trimOffset + trimHeight;
  const outside = options.cropMarkOffset;
  const length = options.cropMarkLength;
  const thickness = options.cropMarkStrokeWidth;
  const drawLine = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    page.drawLine({
      start,
      end,
      thickness,
      color,
    });
  };

  drawLine({ x: left - outside - length, y: bottom }, { x: left - outside, y: bottom });
  drawLine({ x: left, y: bottom - outside - length }, { x: left, y: bottom - outside });
  drawLine({ x: right + outside, y: bottom }, { x: right + outside + length, y: bottom });
  drawLine({ x: right, y: bottom - outside - length }, { x: right, y: bottom - outside });
  drawLine({ x: left - outside - length, y: top }, { x: left - outside, y: top });
  drawLine({ x: left, y: top + outside }, { x: left, y: top + outside + length });
  drawLine({ x: right + outside, y: top }, { x: right + outside + length, y: top });
  drawLine({ x: right, y: top + outside }, { x: right, y: top + outside + length });
};

const drawRectangle = ({
  page,
  mediaHeight,
  trimOffset,
  x,
  y,
  width,
  height,
  fill,
  stroke,
  strokeWidth,
  dash,
  opacity,
}: {
  page: PDFPage;
  mediaHeight: number;
  trimOffset: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: number[];
  opacity?: number;
}) => {
  const fillColor = parsePrintColor(fill);
  const strokeColor = parsePrintColor(stroke);

  if (!fillColor && !strokeColor) {
    return;
  }

  page.drawRectangle({
    x: trimOffset + x,
    y: toPdfY(mediaHeight, trimOffset, y, height),
    width,
    height,
    color: fillColor ? toCmyk(fillColor) : undefined,
    borderColor: strokeColor ? toCmyk(strokeColor) : undefined,
    borderWidth: strokeColor ? strokeWidth ?? 1 : undefined,
    borderDashArray: dash && dash.length > 0 ? dash : undefined,
    opacity: typeof opacity === "number" ? clampUnit(opacity) : undefined,
  });
};

const drawLayoutLine = ({
  page,
  mediaHeight,
  trimOffset,
  points,
  stroke,
  strokeWidth,
  articleX,
  articleY,
}: {
  page: PDFPage;
  mediaHeight: number;
  trimOffset: number;
  points: number[];
  stroke: string;
  strokeWidth: number;
  articleX: number;
  articleY: number;
}) => {
  if (points.length < 4) {
    return;
  }

  const color = parsePrintColor(stroke) ?? registrationBlack;
  const [startX, startY, endX, endY] = points;

  page.drawLine({
    start: {
      x: trimOffset + articleX + startX,
      y: mediaHeight - trimOffset - articleY - startY,
    },
    end: {
      x: trimOffset + articleX + endX,
      y: mediaHeight - trimOffset - articleY - endY,
    },
    thickness: strokeWidth,
    color: toCmyk(color),
  });
};

const drawTextLine = ({
  page,
  mediaHeight,
  trimOffset,
  line,
  articleX,
  articleY,
  font,
}: {
  page: PDFPage;
  mediaHeight: number;
  trimOffset: number;
  line: ArticleLayoutTextLine;
  articleX: number;
  articleY: number;
  font: PDFFont;
}) => {
  const color = parsePrintColor(line.style.fill) ?? registrationBlack;
  const printableText = sanitizeRenderedText(line.text);

  if (!printableText) {
    return;
  }

  page.drawText(printableText, {
    x: trimOffset + articleX + getTextX(line, font, line.style),
    y: getLineTextY(mediaHeight, trimOffset, { ...line, y: articleY + line.y }, line.style),
    size: line.style.fontSize,
    font,
    color: toCmyk(color),
    characterSpacing: line.style.letterSpacing ?? 0,
  } as Parameters<PDFPage["drawText"]>[1] & { characterSpacing?: number });
};

export const sanitizePdfRenderedText = (text: string) =>
  text
    .replace(/_*BYLINE[\s_-]*DOT_*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const sanitizeRenderedText = sanitizePdfRenderedText;

const drawTextSegmentLine = ({
  page,
  mediaHeight,
  trimOffset,
  line,
  articleX,
  articleY,
  fontsByRole,
  justifySegments = false,
  blockX,
  blockWidth,
}: {
  page: PDFPage;
  mediaHeight: number;
  trimOffset: number;
  line: ArticleLayoutTextLine;
  articleX: number;
  articleY: number;
  fontsByRole: {
    serif?: PDFFont;
    sans?: PDFFont;
    mono?: PDFFont;
  };
  justifySegments?: boolean;
  blockX?: number;
  blockWidth?: number;
}) => {
  if (!line.segments || line.segments.length === 0) {
    return false;
  }

  const isBylineSegmentLine = line.segments.some((segment) => segment.role === "byline-dot");
  if (isBylineSegmentLine) {
    const textSegments = line.segments.filter((segment) => segment.role !== "byline-dot");
    const dotSegment = line.segments.find((segment) => segment.role === "byline-dot");
    if (textSegments.length >= 2 && dotSegment) {
      const creditSegment = textSegments[0];
      const placeSegment = textSegments[1];
      const creditText = sanitizeRenderedText(creditSegment.text);
      const placeText = sanitizeRenderedText(placeSegment.text);
      const creditFont = fontsByRole[getFontRole(creditSegment.style)] ?? fontsByRole.sans;
      const placeFont = fontsByRole[getFontRole(placeSegment.style)] ?? fontsByRole.sans;
      const dotColor = parsePrintColor(dotSegment.style.fill) ?? registrationBlack;
      if (!creditFont || !placeFont || !creditText || !placeText) {
        return true;
      }

      const fitFontSizeToSlot = (
        font: PDFFont,
        text: string,
        baseSize: number,
        slotWidth: number,
      ) => {
        const pdfWidth = font.widthOfTextAtSize(text, baseSize);
        return slotWidth > 0 && pdfWidth > slotWidth
          ? Math.max(baseSize * 0.74, baseSize * (slotWidth / Math.max(1, pdfWidth)))
          : baseSize;
      };

      const creditFontSize = fitFontSizeToSlot(creditFont, creditText, creditSegment.style.fontSize, line.width);
      const placeFontSize = fitFontSizeToSlot(placeFont, placeText, placeSegment.style.fontSize, line.width);
      const creditPdfWidth = creditFont.widthOfTextAtSize(creditText, creditFontSize);
      const placePdfWidth = placeFont.widthOfTextAtSize(placeText, placeFontSize);
      const dotRadius = Math.max(1.8, dotSegment.style.fontSize * 0.22);
      const dotDiameter = dotRadius * 2;
      const gap = Math.max(2.2, Math.min(3.8, line.style.fontSize * 0.24));
      const totalPdfWidth = creditPdfWidth + gap + dotDiameter + gap + placePdfWidth;
      const centerX = blockX !== undefined && blockWidth !== undefined
        ? blockX + blockWidth / 2
        : line.x + line.width / 2;
      const startX = trimOffset + articleX + centerX - totalPdfWidth / 2;
      const lineY = articleY + (line.y ?? creditSegment.y);
      const creditTextY = getLineTextY(
        mediaHeight,
        trimOffset,
        { ...line, y: lineY },
        { ...creditSegment.style, fontSize: creditFontSize },
      );
      const placeTextY = getLineTextY(
        mediaHeight,
        trimOffset,
        { ...line, y: lineY },
        { ...placeSegment.style, fontSize: placeFontSize },
      );
      const dotCenterY = toPdfY(mediaHeight, trimOffset, lineY, line.height) + line.height * 0.56;

      page.drawText(creditText, {
        x: startX,
        y: creditTextY,
        size: creditFontSize,
        font: creditFont,
        color: toCmyk(parsePrintColor(creditSegment.style.fill) ?? registrationBlack),
        characterSpacing: creditSegment.style.letterSpacing ?? 0,
      } as Parameters<PDFPage["drawText"]>[1] & { characterSpacing?: number });
      page.drawCircle({
        x: startX + creditPdfWidth + gap + dotRadius,
        y: dotCenterY,
        size: dotRadius,
        color: toCmyk(dotColor),
        opacity: dotSegment.style.opacity ?? 1,
      });
      page.drawText(placeText, {
        x: startX + creditPdfWidth + gap + dotDiameter + gap,
        y: placeTextY,
        size: placeFontSize,
        font: placeFont,
        color: toCmyk(parsePrintColor(placeSegment.style.fill) ?? registrationBlack),
        characterSpacing: placeSegment.style.letterSpacing ?? 0,
      } as Parameters<PDFPage["drawText"]>[1] & { characterSpacing?: number });

      return true;
    }
  }

  const segmentStart = line.segments[0]?.x ?? line.x ?? 0;
  const segmentEnd = line.segments.reduce(
    (end, segment) => Math.max(end, (segment.x ?? line.x ?? 0) + (segment.width ?? 0)),
    segmentStart,
  );
  const segmentGapCount = Math.max(0, line.segments.length - 1);
  const extraGap = justifySegments && line.justify && segmentGapCount > 0
    ? Math.max(0, line.width - (segmentEnd - segmentStart)) / segmentGapCount
    : 0;

  for (const [segmentIndex, segment] of line.segments.entries()) {
    const segmentText = segment.text.trim();
    const color = parsePrintColor(segment.style.fill) ?? registrationBlack;
    const segmentX = (segment.x ?? line.x ?? 0) + extraGap * segmentIndex;
    const segmentY = segment.y ?? line.y ?? 0;
    const segmentWidth = segment.width ?? 0;
    const segmentHeight = segment.height ?? segment.style.fontSize;
    const x = trimOffset + articleX + segmentX;

    if (segment.role === "byline-dot" || segmentText === "\u2022" || /_*BYLINE[\s_-]*DOT_*/i.test(segmentText)) {
      const dotRadius = Math.max(2.1, segment.style.fontSize * 0.28);
      page.drawCircle({
        x: x + segmentWidth / 2,
        y: toPdfY(mediaHeight, trimOffset, articleY + segmentY, segmentHeight) + segmentHeight * 0.5,
        size: dotRadius,
        color: toCmyk(color),
        opacity: segment.style.opacity ?? 1,
      });
      continue;
    }

    const font = fontsByRole[getFontRole(segment.style)] ?? fontsByRole.sans;

    const printableText = sanitizeRenderedText(segment.text);

    if (!font || !printableText) {
      continue;
    }

    const pdfTextWidth = font.widthOfTextAtSize(printableText, segment.style.fontSize);
    const shouldFitToSegment = isBylineSegmentLine || segment.constrainWidth === true;
    const fittedFontSize =
      shouldFitToSegment && segmentWidth > 0 && pdfTextWidth > segmentWidth
        ? Math.max(segment.style.fontSize * 0.74, segment.style.fontSize * (segmentWidth / Math.max(1, pdfTextWidth)))
        : segment.style.fontSize;
    const fittedStyle = fittedFontSize === segment.style.fontSize
      ? segment.style
      : { ...segment.style, fontSize: fittedFontSize };
    const fittedTextWidth = font.widthOfTextAtSize(printableText, fittedFontSize);
    const textX =
      isBylineSegmentLine && segmentWidth > fittedTextWidth
        ? x + (segmentWidth - fittedTextWidth) / 2
        : x;
    const backgroundColor = parsePrintColor(segment.style.backgroundColor);
    const y = getLineTextY(
      mediaHeight,
      trimOffset,
      { ...line, ...segment, x: segmentX, y: articleY + segmentY, width: segmentWidth, height: segmentHeight },
      fittedStyle,
    );

    if (backgroundColor) {
      page.drawRectangle({
        x,
        y: toPdfY(mediaHeight, trimOffset, articleY + segmentY, segmentHeight),
        width: segmentWidth,
        height: segmentHeight,
        color: toCmyk(backgroundColor),
      });
    }

    page.drawText(printableText, {
      x: textX,
      y,
      size: fittedFontSize,
      font,
      color: toCmyk(color),
      characterSpacing: segment.style.letterSpacing ?? 0,
    } as Parameters<PDFPage["drawText"]>[1] & { characterSpacing?: number });

    if (segment.style.textDecoration === "underline") {
      page.drawLine({
        start: { x, y: y - segment.style.fontSize * 0.14 },
        end: { x: x + segmentWidth, y: y - segment.style.fontSize * 0.14 },
        thickness: Math.max(0.35, segment.style.fontSize * 0.045),
        color: toCmyk(color),
      });
    }
  }

  return true;
};

const drawTextBlock = ({
  block,
  page,
  mediaHeight,
  trimOffset,
  articleX,
  articleY,
  fontsByRole,
}: {
  block: ArticleLayoutTextBlock;
  page: PDFPage;
  mediaHeight: number;
  trimOffset: number;
  articleX: number;
  articleY: number;
  fontsByRole: {
    serif?: PDFFont;
    sans?: PDFFont;
    mono?: PDFFont;
  };
}) => {
  const frameLayout = layoutFrameTextBlock(block);
  const displayBlock = frameLayout.block;
  const frameBounds = frameLayout.frameBounds;

  if (displayBlock.containerStyle && frameBounds) {
    drawRectangle({
      page,
      mediaHeight,
      trimOffset,
      x: articleX + frameBounds.x,
      y: articleY + frameBounds.y,
      width: frameBounds.width,
      height: frameBounds.height,
      fill:
        displayBlock.containerStyle.containerBackgroundColor === "transparent"
          ? undefined
          : displayBlock.containerStyle.containerBackgroundColor,
      stroke:
        displayBlock.containerStyle.containerBorderWidth > 0
          ? displayBlock.containerStyle.containerBorderColor
          : undefined,
      strokeWidth: displayBlock.containerStyle.containerBorderWidth,
      dash: frameLayout.borderDash,
      opacity: displayBlock.containerStyle.containerOpacity,
    });
  }

  for (const line of displayBlock.lineBoxes) {
    if (drawTextSegmentLine({
      page,
      mediaHeight,
      trimOffset,
      line,
      articleX,
      articleY,
      fontsByRole,
      blockX: displayBlock.x,
      blockWidth: displayBlock.width,
    })) {
      continue;
    }

    const font = fontsByRole[getFontRole(line.style)] ?? fontsByRole.sans;

    if (!font) {
      continue;
    }

    drawTextLine({
      page,
      mediaHeight,
      trimOffset,
      line,
      articleX,
      articleY,
      font,
    });
  }
};

const shiftTextBlockX = (block: ArticleLayoutTextBlock, deltaX: number): ArticleLayoutTextBlock => ({
  ...block,
  x: block.x + deltaX,
  layoutBounds: block.layoutBounds
    ? {
        ...block.layoutBounds,
        x: block.layoutBounds.x + deltaX,
      }
    : block.layoutBounds,
  lineBoxes: block.lineBoxes.map((line) => ({
    ...line,
    x: line.x + deltaX,
    segments: line.segments?.map((segment) => ({
      ...segment,
      x: segment.x + deltaX,
    })),
  })),
});

const clampBylineBlockForPdf = (
  block: ArticleLayoutTextBlock,
  articleWidth: number,
): ArticleLayoutTextBlock => {
  if (block.lineBoxes.some((line) => line.segments?.some((segment) => segment.role === "byline-dot"))) {
    return block;
  }

  const segmentBounds = block.lineBoxes.flatMap((line) =>
    line.segments && line.segments.length > 0
      ? line.segments.map((segment) => ({
          left: segment.x,
          right: segment.x + segment.width,
        }))
      : [{ left: line.x, right: line.x + line.width }],
  );
  const left = Math.min(block.x, ...segmentBounds.map((bound) => bound.left));
  const right = Math.max(block.x + block.width, ...segmentBounds.map((bound) => bound.right));
  const padding = 1;
  const contentWidth = right - left;
  const usableWidth = Math.max(1, articleWidth - padding * 2);
  let deltaX =
    contentWidth >= usableWidth
      ? padding - left
      : Math.min(Math.max(padding - left, 0), articleWidth - padding - right);

  if (left + deltaX < block.x) {
    deltaX = Math.max(0, block.x - left);
  }

  return deltaX === 0 ? block : shiftTextBlockX(block, deltaX);
};

const drawFactBox = (
  factBox: FactBoxLayout,
  page: PDFPage,
  mediaHeight: number,
  trimOffset: number,
  articleX: number,
  articleY: number,
  fontsByRole: { serif?: PDFFont; sans?: PDFFont; mono?: PDFFont },
) => {
  drawRectangle({
    page,
    mediaHeight,
    trimOffset,
    x: articleX + factBox.x,
    y: articleY + factBox.y,
    width: factBox.width,
    height: factBox.height,
    fill: factBox.fill,
    stroke: factBox.stroke,
    strokeWidth: factBox.strokeWidth,
  });
  drawTextBlock({ block: factBox.headline, page, mediaHeight, trimOffset, articleX, articleY, fontsByRole });

  for (const bullet of factBox.bullets) {
    drawTextBlock({ block: bullet, page, mediaHeight, trimOffset, articleX, articleY, fontsByRole });
  }
};

const drawPullQuote = (
  pullQuote: PullQuoteLayout,
  page: PDFPage,
  mediaHeight: number,
  trimOffset: number,
  articleX: number,
  articleY: number,
  fontsByRole: { serif?: PDFFont; sans?: PDFFont; mono?: PDFFont },
) => {
  drawRectangle({
    page,
    mediaHeight,
    trimOffset,
    x: articleX + pullQuote.x,
    y: articleY + pullQuote.y,
    width: pullQuote.width,
    height: pullQuote.height,
    fill: pullQuote.fill,
    stroke: pullQuote.stroke,
    strokeWidth: pullQuote.strokeWidth,
  });
  drawTextBlock({ block: pullQuote.textBlock, page, mediaHeight, trimOffset, articleX, articleY, fontsByRole });
};

const drawEditorialLabel = (
  label: EditorialLabelLayout,
  page: PDFPage,
  mediaHeight: number,
  trimOffset: number,
  articleX: number,
  articleY: number,
  fontsByRole: { serif?: PDFFont; sans?: PDFFont; mono?: PDFFont },
) => {
  drawRectangle({
    page,
    mediaHeight,
    trimOffset,
    x: articleX + label.x,
    y: articleY + label.y,
    width: label.width,
    height: label.height,
    fill: label.fill,
    stroke: label.stroke,
    strokeWidth: label.strokeWidth,
  });
  drawTextBlock({ block: label.textBlock, page, mediaHeight, trimOffset, articleX, articleY, fontsByRole });
};

const drawCaption = (
  caption: NonNullable<PrintPDFArticle["layout"]["caption"]>,
  page: PDFPage,
  mediaHeight: number,
  trimOffset: number,
  articleX: number,
  articleY: number,
  fontsByRole: { serif?: PDFFont; sans?: PDFFont; mono?: PDFFont },
) => {
  if (caption.fill || (caption.strokeWidth && caption.strokeWidth > 0)) {
    drawRectangle({
      page,
      mediaHeight,
      trimOffset,
      x: articleX + caption.x,
      y: articleY + caption.y,
      width: caption.width,
      height: caption.height,
      fill: caption.fill,
      stroke: caption.stroke,
      strokeWidth: caption.strokeWidth,
    });
  }

  drawTextBlock({ block: caption.textBlock, page, mediaHeight, trimOffset, articleX, articleY, fontsByRole });

  if (caption.creditBlock) {
    drawTextBlock({ block: caption.creditBlock, page, mediaHeight, trimOffset, articleX, articleY, fontsByRole });
  }

  if (caption.sourceBlock) {
    drawTextBlock({ block: caption.sourceBlock, page, mediaHeight, trimOffset, articleX, articleY, fontsByRole });
  }
};

const getImageDpi = (
  asset: PrintPDFImageAsset,
  placedWidth: number,
  placedHeight: number,
): PrintPDFImageMetric => ({
  imageId: asset.id,
  effectiveDpiX: placedWidth > 0 ? asset.pixelWidth / (placedWidth / 72) : 0,
  effectiveDpiY: placedHeight > 0 ? asset.pixelHeight / (placedHeight / 72) : 0,
  placedWidth,
  placedHeight,
});

const drawArticle = ({
  article,
  page,
  mediaHeight,
  trimOffset,
  fontsByRole,
  imageMap,
  imageAssetsById,
  imageMetrics,
  issues,
  options,
}: {
  article: PrintPDFArticle;
  page: PDFPage;
  mediaHeight: number;
  trimOffset: number;
  fontsByRole: { serif?: PDFFont; sans?: PDFFont; mono?: PDFFont };
  imageMap: Map<string, PDFImage>;
  imageAssetsById: Map<string, PrintPDFImageAsset>;
  imageMetrics: PrintPDFImageMetric[];
  issues: PrintPDFPreflightIssue[];
  options: PrintPDFOptions;
}) => {
  const { articleBox, layout } = article;
  const articleX = articleBox.x;
  const articleY = articleBox.y;

  drawRectangle({
    page,
    mediaHeight,
    trimOffset,
    x: articleX,
    y: articleY,
    width: articleBox.width,
    height: articleBox.height,
    fill:
      layout.containerStyles?.article?.containerBackgroundColor &&
      layout.containerStyles.article.containerBackgroundColor !== "transparent"
        ? layout.containerStyles.article.containerBackgroundColor
        : "#fffef9",
    stroke: layout.containerStyles?.article?.containerBorderWidth ? (layout.containerStyles.article.containerBorderColor || "#000000") : undefined,
    strokeWidth: layout.containerStyles?.article?.containerBorderWidth || 0,
  });

  if (layout.kicker) {
    drawEditorialLabel(layout.kicker, page, mediaHeight, trimOffset, articleX, articleY, fontsByRole);
  }

  if (layout.strap) {
    drawEditorialLabel(layout.strap, page, mediaHeight, trimOffset, articleX, articleY, fontsByRole);
  }

  drawTextBlock({ block: layout.headline, page, mediaHeight, trimOffset, articleX, articleY, fontsByRole });
  if (layout.subheadlineBackground) {
    drawRectangle({
      page,
      mediaHeight,
      trimOffset,
      x: articleX + layout.subheadlineBackground.x,
      y: articleY + layout.subheadlineBackground.y,
      width: layout.subheadlineBackground.width,
      height: layout.subheadlineBackground.height,
      fill: layout.subheadlineBackground.fill,
      stroke: layout.subheadlineBackground.stroke,
      strokeWidth: layout.subheadlineBackground.strokeWidth,
    });
  }
  const debugSubheadings =
    typeof process !== "undefined" &&
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DEBUG_SUBHEADINGS === "true";
  if (debugSubheadings && layout.subheadline && layout.subheadline.lineBoxes.length > 0) {
    console.log(`[SubheadingDiagnostic] PDF drawing subheadline block at x=${articleX}, y=${articleY}`);
    layout.subheadline.lineBoxes.forEach((l: { y: number; height: number; text: string }, i: number) => {
      console.log(`[SubheadingDiagnostic] PDF Line ${i}: y=${l.y}, height=${l.height}, text=${l.text}`);
    });
  }
  drawTextBlock({ block: layout.subheadline, page, mediaHeight, trimOffset, articleX, articleY, fontsByRole });
  if (layout.inlineSubheadline) {
    for (const bulletBlock of layout.inlineSubheadline) {
      drawTextBlock({ block: bulletBlock, page, mediaHeight, trimOffset, articleX, articleY, fontsByRole });
    }
  }
  drawTextBlock({
    block: clampBylineBlockForPdf(layout.byline, articleBox.width),
    page,
    mediaHeight,
    trimOffset,
    articleX,
    articleY,
    fontsByRole,
  });

  if (layout.image && article.imageAssetId) {
    const image = imageMap.get(article.imageAssetId);
    const asset = imageAssetsById.get(article.imageAssetId);
    const debugImages = typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEBUG_PDF_IMAGES === "true";
    
    if (debugImages) console.log(`[ImageExportDiagnostic] Rendering image layout for article.imageAssetId=${article.imageAssetId}. image (PDFImage) resolved=${!!image}, asset (PrintPDFImageAsset) resolved=${!!asset}`);

    if (!image || !asset) {
      if (debugImages) console.log(`[ImageExportDiagnostic] Missing resolved image or asset for ${article.imageAssetId}. Drawing placeholder instead.`);
      issues.push({
        code: "missing-image",
        severity: "error",
        message: `Missing image asset '${article.imageAssetId}'.`,
      });
      // Fallback to placeholder if we missed it
      drawRectangle({
        page,
        mediaHeight,
        trimOffset,
        x: articleX + layout.image.x,
        y: articleY + layout.image.y,
        width: layout.image.width,
        height: layout.image.height,
        fill: layout.image.fill,
        stroke: layout.image.stroke,
        strokeWidth: layout.image.strokeWidth,
      });
    } else {
      const metric = getImageDpi(asset, layout.image.width, layout.image.height);
      imageMetrics.push(metric);

      if (
        metric.effectiveDpiX < options.minimumImageDpi ||
        metric.effectiveDpiY < options.minimumImageDpi
      ) {
        issues.push({
          code: "low-image-dpi",
          severity: "warning",
          message: `Image '${asset.id}' is below ${options.minimumImageDpi} DPI at placed size.`,
        });
      }

      const frameX = trimOffset + articleX + layout.image.x;
      const frameY = toPdfY(mediaHeight, trimOffset, articleY + layout.image.y, layout.image.height);
      const frameW = layout.image.width;
      const frameH = layout.image.height;

      const sourceW = asset.pixelWidth > 0 ? asset.pixelWidth : image.width;
      const sourceH = asset.pixelHeight > 0 ? asset.pixelHeight : image.height;
      
      if (debugImages) console.log(`[ImageExportDiagnostic] Image dimensions: sourceW=${sourceW}, sourceH=${sourceH}, frameW=${frameW}, frameH=${frameH}`);

      const isPureAd =
        (article as any)?.role === "advertisement" ||
        (layout.image.coverCropWidth && Math.abs(layout.image.coverCropWidth - sourceW) < 2);

      const crop = isPureAd
        ? {
            sourceX: 0,
            sourceY: 0,
            sourceWidth: sourceW,
            sourceHeight: sourceH,
            scale: Math.min(frameW / Math.max(1, sourceW), frameH / Math.max(1, sourceH)),
          }
        : computeImageCoverCrop({
            sourceWidth: sourceW,
            sourceHeight: sourceH,
            frameWidth: frameW,
            frameHeight: frameH,
            // Matches composeArticleBox.ts's own bias -- keeps the top of
            // the subject from being cut off by a dead-centre crop.
            focalPointY: 0.3,
          });

      const scaledW = sourceW * crop.scale;
      const scaledH = sourceH * crop.scale;
      const imgX = frameX - crop.sourceX * crop.scale;
      const imgY = frameY + frameH - scaledH + crop.sourceY * crop.scale;
      
      if (debugImages) console.log(`[ImageExportDiagnostic] Image clipping rectangle: frameX=${frameX}, frameY=${frameY}, frameW=${frameW}, frameH=${frameH}`);

      // Safe graphics-state restoration
      let graphicsStatePushed = false;
      try {
        page.pushOperators(pushGraphicsState());
        graphicsStatePushed = true;
        
        page.pushOperators(
          rectangle(frameX, frameY, frameW, frameH),
          clip(),
          endPath(),
        );

        page.drawImage(image, {
          x: imgX,
          y: imgY,
          width: scaledW,
          height: scaledH,
        });
        if (debugImages) console.log(`[ImageExportDiagnostic] Successfully executed page.drawImage for imageAssetId=${article.imageAssetId}`);
      } catch (e) {
        if (debugImages) console.error(`[ImageExportDiagnostic] Failed during PDF graphics clipping or image drawing for ${article.imageAssetId}:`, e);
      } finally {
        if (graphicsStatePushed) {
          page.pushOperators(popGraphicsState());
          if (debugImages) console.log(`[ImageExportDiagnostic] Successfully popped graphics state for ${article.imageAssetId}`);
        }
      }
    }
  } else if (layout.image) {
    const debugImages = typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEBUG_PDF_IMAGES === "true";
    if (debugImages) console.log(`[ImageExportDiagnostic] layout.image exists but no article.imageAssetId. Drawing placeholder. fill=${layout.image.fill}`);
    drawRectangle({
      page,
      mediaHeight,
      trimOffset,
      x: articleX + layout.image.x,
      y: articleY + layout.image.y,
      width: layout.image.width,
      height: layout.image.height,
      fill: layout.image.fill,
      stroke: layout.image.stroke,
      strokeWidth: layout.image.strokeWidth,
    });
  }

  if (layout.image?.label) {
    drawTextBlock({ block: layout.image.label, page, mediaHeight, trimOffset, articleX, articleY, fontsByRole });
  }
  if (layout.caption) {
    drawCaption(layout.caption, page, mediaHeight, trimOffset, articleX, articleY, fontsByRole);
  }

  if (layout.factBox) {
    drawFactBox(layout.factBox, page, mediaHeight, trimOffset, articleX, articleY, fontsByRole);
  }

  for (const column of layout.body.columns) {
    for (const line of column.lines) {
      if (drawTextSegmentLine({ page, mediaHeight, trimOffset, line, articleX, articleY, fontsByRole, justifySegments: true })) {
        continue;
      }

      const font = fontsByRole[getFontRole(line.style)] ?? fontsByRole.sans;

      if (font) {
        drawTextLine({ page, mediaHeight, trimOffset, line, articleX, articleY, font });
      }
    }
  }

  if (layout.body.dropCap) {
    const font = fontsByRole[getFontRole(layout.body.dropCap.style)] ?? fontsByRole.sans;

    if (font) {
      page.drawText(layout.body.dropCap.text, {
        x: trimOffset + articleX + layout.body.dropCap.x,
        y: toPdfY(
          mediaHeight,
          trimOffset,
          articleY + layout.body.dropCap.y,
          layout.body.dropCap.style.fontSize,
        ),
        size: layout.body.dropCap.style.fontSize,
        font,
        color: toCmyk(parsePrintColor(layout.body.dropCap.style.fill) ?? registrationBlack),
        characterSpacing: layout.body.dropCap.style.letterSpacing ?? 0,
      } as Parameters<PDFPage["drawText"]>[1] & { characterSpacing?: number });
    }
  }

  if (layout.pullQuote) {
    drawPullQuote(layout.pullQuote, page, mediaHeight, trimOffset, articleX, articleY, fontsByRole);
  }

  // Subtle editorial divider lines.
  if (layout.decorativeDividers && layout.decorativeDividers.length > 0) {
    const captionTextTop = layout.caption?.textBlock.lineBoxes.reduce(
      (top, line) => Math.min(top, line.y),
      layout.caption.textBlock.y,
    );
    const captionTextBottom = layout.caption?.textBlock.lineBoxes.reduce(
      (bottom, line) => Math.max(bottom, line.y + line.height),
      layout.caption.textBlock.y,
    );
    for (const divider of layout.decorativeDividers) {
      if (
        layout.caption &&
        captionTextTop !== undefined &&
        captionTextBottom !== undefined &&
        divider.x < layout.caption.x + layout.caption.width &&
        divider.x + divider.width > layout.caption.x &&
        divider.y >= captionTextTop - 1 &&
        divider.y <= captionTextBottom + 1
      ) {
        continue;
      }
      const dividerX = trimOffset + articleX + divider.x;
      const dividerY = toPdfY(mediaHeight, trimOffset, articleY + divider.y, 0);

      if (divider.style === "solid") {
        page.drawLine({
          start: { x: dividerX, y: dividerY },
          end: { x: dividerX + divider.width, y: dividerY },
          thickness: divider.strokeWidth,
          color: toCmyk(parsePrintColor(divider.color) ?? { cyan: 0, magenta: 0, yellow: 0, key: 0.85 }),
        });
      } else {
        const dotW = divider.dotSize;
        const gap = divider.dotSpacing;
        const stepW = dotW + gap;
        const totalW = divider.width;
        let cursor = 0;
        while (cursor + dotW <= totalW + 0.5) {
          const segEnd = Math.min(cursor + dotW, totalW);
          page.drawLine({
            start: { x: dividerX + cursor, y: dividerY },
            end: { x: dividerX + segEnd, y: dividerY },
            thickness: divider.strokeWidth,
            color: toCmyk(parsePrintColor(divider.color) ?? { cyan: 0, magenta: 0, yellow: 0, key: 0.85 }),
            lineCap: "Round" as unknown as import("pdf-lib").LineCapStyle,
          });
          cursor += stepW;
        }
      }
    }
  }
};

const validatePageBoundaries = (
  input: PrintPDFDocumentInput,
  issues: PrintPDFPreflightIssue[],
) => {
  for (const [pageIndex, page] of input.pages.entries()) {
    for (const article of page.articles) {
      const { articleBox } = article;

      if (
        articleBox.x < 0 ||
        articleBox.y < 0 ||
        articleBox.x + articleBox.width > page.width ||
        articleBox.y + articleBox.height > page.height
      ) {
        issues.push({
          code: "page-boundary",
          severity: "error",
          message: `Article box exceeds page ${pageIndex + 1} trim boundaries.`,
        });
      }
    }
  }
};

export const generatePrintPDF = async (
  input: PrintPDFDocumentInput,
): Promise<PrintPDFResult> => {
  const options = {
    ...defaultOptions,
    ...input.options,
  };
  const issues: PrintPDFPreflightIssue[] = [];

  if (input.pages.length === 0) {
    issues.push({
      code: "empty-document",
      severity: "error",
      message: "PrintPDFEngine requires at least one page.",
    });
  }

  validatePageBoundaries(input, issues);

  const firstPage = input.pages[0] ?? {
    width: 0,
    height: 0,
    articles: [],
  };
  const trimOffset = options.bleed + options.cropMarkOffset + options.cropMarkLength;
  const mediaWidth = firstPage.width + trimOffset * 2;
  const mediaHeight = firstPage.height + trimOffset * 2;
  const pdfDoc = await PDFDocument.create();

  pdfDoc.registerFontkit(fontkit);
  pdfDoc.setProducer("Newspaper Generator PrintPDFEngine");
  pdfDoc.setCreator("Newspaper Generator");

  const { fontsByRole, embeddedFontIds } = await embedFonts(pdfDoc, input, options, issues);
  const images = input.images ?? [];
  const imageMap = await embedImages(pdfDoc, images);
  const imageAssetsById = new Map(images.map((image) => [image.id, image]));
  const imageMetrics: PrintPDFImageMetric[] = [];

  for (const printPage of input.pages) {
    const pageMediaWidth = printPage.width + trimOffset * 2;
    const pageMediaHeight = printPage.height + trimOffset * 2;
    const page = pdfDoc.addPage([pageMediaWidth, pageMediaHeight]);

    drawTrimAndBleedBoxes(pdfDoc, page, printPage.width, printPage.height, trimOffset, options.bleed);
    page.drawRectangle({
      x: trimOffset - options.bleed,
      y: trimOffset - options.bleed,
      width: printPage.width + options.bleed * 2,
      height: printPage.height + options.bleed * 2,
      color: toCmyk(paperWhite),
    });

    for (const article of printPage.articles) {
      drawArticle({
        article,
        page,
        mediaHeight: pageMediaHeight,
        trimOffset,
        fontsByRole,
        imageMap,
        imageAssetsById,
        imageMetrics,
        issues,
        options,
      });
    }

    drawCropMarks(page, printPage.width, printPage.height, trimOffset, options);
  }

  const pdfBytes = await pdfDoc.save({
    useObjectStreams: false,
  });
  const printReady = issues.every((issue) => issue.severity !== "error");

  return {
    pdfBytes,
    pageCount: input.pages.length,
    trimSize: {
      width: firstPage.width,
      height: firstPage.height,
    },
    mediaSize: {
      width: mediaWidth,
      height: mediaHeight,
    },
    preflight: {
      printReady,
      issues,
      embeddedFontIds,
      imageMetrics,
    },
  };
};

export const PrintPDFEngine = {
  generatePrintPDF,
  parsePrintColor,
};
