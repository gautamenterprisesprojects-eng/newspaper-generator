import "regenerator-runtime/runtime";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  PROTOTYPE_BORDERS,
  PROTOTYPE_COLOURS,
  type PrototypeArticleBox,
  type PrototypeLayout,
  type RectPt,
} from "./geometry";

const hexToRgb = (hex: string) => {
  const value = hex.replace("#", "");
  const n = Number.parseInt(value, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const topLeftToPdf = (pageHeight: number, box: RectPt) => ({
  x: box.x,
  y: pageHeight - box.y - box.height,
  width: box.width,
  height: box.height,
});

const drawRect = (
  page: PDFPage,
  pageHeight: number,
  box: RectPt,
  options: { fill?: string; stroke?: string; strokeWidth?: number },
) => {
  const pdfBox = topLeftToPdf(pageHeight, box);
  if (options.fill) {
    page.drawRectangle({
      ...pdfBox,
      color: hexToRgb(options.fill),
    });
  }
  if (options.stroke) {
    page.drawRectangle({
      ...pdfBox,
      borderColor: hexToRgb(options.stroke),
      borderWidth: options.strokeWidth ?? 1,
    });
  }
};

const wrapLines = (font: PDFFont, text: string, size: number, width: number, maxLines: number) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) <= width) {
      current = trial;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
};

const drawWrapped = (
  page: PDFPage,
  pageHeight: number,
  font: PDFFont,
  box: RectPt,
  text: string,
  size: number,
  columns: number,
) => {
  const colCount = Math.max(1, columns);
  const gap = 7;
  const colWidth = (box.width - gap * (colCount - 1)) / colCount;
  const leading = size + 2.4;
  const linesPerCol = Math.max(1, Math.floor(box.height / leading));
  const allLines = wrapLines(font, text, size, colWidth, linesPerCol * colCount);
  for (let column = 0; column < colCount; column += 1) {
    const colLines = allLines.slice(column * linesPerCol, (column + 1) * linesPerCol);
    const colX = box.x + column * (colWidth + gap);
    colLines.forEach((line, index) => {
      const y = pageHeight - (box.y + size + index * leading);
      page.drawText(line, {
        x: colX,
        y,
        size,
        font,
        color: hexToRgb(PROTOTYPE_COLOURS.ink),
        maxWidth: colWidth,
      });
    });
  }
};

const drawArticle = (
  page: PDFPage,
  pageHeight: number,
  fonts: { sans: PDFFont; serif: PDFFont; sansBold: PDFFont },
  article: PrototypeArticleBox,
  nested: boolean,
) => {
  drawRect(page, pageHeight, article.outer, {
    fill: nested ? PROTOTYPE_COLOURS.nestedFill : article.role === "cartoon" ? PROTOTYPE_COLOURS.cartoonFill : PROTOTYPE_COLOURS.paper,
    stroke: PROTOTYPE_COLOURS.ink,
    strokeWidth: nested ? PROTOTYPE_BORDERS.nested : PROTOTYPE_BORDERS.outer,
  });

  if (article.kicker) {
    drawRect(page, pageHeight, article.kicker, { fill: article.kicker.fill });
    page.drawText(article.kicker.text, {
      x: article.kicker.x + 5,
      y: pageHeight - (article.kicker.y + 12),
      size: 8,
      font: fonts.sansBold,
      color: hexToRgb(article.kicker.color),
    });
  }

  if (article.headline) {
    const lines = wrapLines(
      fonts.sansBold,
      article.headline.text,
      article.headline.fontSize,
      article.headline.width,
      Math.max(1, Math.floor(article.headline.height / (article.headline.fontSize * 1.1))),
    );
    lines.forEach((line, index) => {
      page.drawText(line, {
        x: article.headline!.x,
        y: pageHeight - (article.headline!.y + article.headline!.fontSize + index * article.headline!.fontSize * 1.12),
        size: article.headline!.fontSize,
        font: fonts.sansBold,
        color: hexToRgb(PROTOTYPE_COLOURS.ink),
      });
    });
  }

  if (article.role !== "rail") {
    drawRect(page, pageHeight, article.inner, {
      fill: PROTOTYPE_COLOURS.innerFill,
      stroke: PROTOTYPE_COLOURS.ink,
      strokeWidth: PROTOTYPE_BORDERS.inner,
    });
  }

  if (article.image) {
    drawRect(page, pageHeight, article.image, {
      fill: PROTOTYPE_COLOURS.imageFill,
      stroke: PROTOTYPE_COLOURS.imageStroke,
      strokeWidth: PROTOTYPE_BORDERS.image,
    });
    page.drawText(article.image.label, {
      x: article.image.x + 6,
      y: pageHeight - (article.image.y + article.image.height / 2),
      size: 8,
      font: fonts.sans,
      color: hexToRgb("#5c564c"),
    });
  }

  if (article.caption) {
    drawRect(page, pageHeight, article.caption, { fill: PROTOTYPE_COLOURS.captionFill });
    page.drawText(article.caption.text, {
      x: article.caption.x + 3,
      y: pageHeight - (article.caption.y + 8),
      size: article.caption.fontSize,
      font: fonts.sans,
      color: hexToRgb("#3d3933"),
    });
  }

  if (article.role !== "rail") {
    drawWrapped(page, pageHeight, fonts.serif, article.body, article.body.text, article.body.fontSize, article.body.columns);
  }
  for (const extra of article.extraBodies ?? []) {
    drawWrapped(page, pageHeight, fonts.serif, extra, extra.text, extra.fontSize, extra.columns);
  }
  for (const stacked of article.stackedInners ?? []) {
    drawArticle(page, pageHeight, fonts, stacked, true);
  }
  for (const child of article.nested ?? []) {
    drawArticle(page, pageHeight, fonts, child, true);
  }
};

export const buildReferenceLayoutPrototypePdf = async (layout: PrototypeLayout): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontsDir = path.join(process.cwd(), "public", "fonts");
  const [sansBytes, sansBoldBytes, serifBytes] = await Promise.all([
    readFile(path.join(fontsDir, "NotoSansDevanagari-Regular.ttf")),
    readFile(path.join(fontsDir, "NotoSansDevanagari-Bold.ttf")),
    readFile(path.join(fontsDir, "NotoSerifDevanagari-Regular.ttf")),
  ]);
  const sans = await pdf.embedFont(sansBytes);
  const sansBold = await pdf.embedFont(sansBoldBytes);
  const serif = await pdf.embedFont(serifBytes);
  const page = pdf.addPage([layout.page.width, layout.page.height]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: layout.page.width,
    height: layout.page.height,
    color: rgb(1, 1, 1),
  });

  const liveHeaderPng = await readFile(path.join(process.cwd(), "tmp_pdf_analysis", "live-header.png")).catch(() => null);
  if (liveHeaderPng) {
    const image = await pdf.embedPng(liveHeaderPng);
    page.drawImage(image, {
      x: layout.header.x,
      y: layout.page.height - layout.header.y - layout.header.height,
      width: layout.header.width,
      height: layout.header.height,
    });
  } else {
    drawRect(page, layout.page.height, layout.header, { fill: "#f4efe6" });
    page.drawText(layout.header.label, {
      x: 18,
      y: layout.page.height - 24,
      size: 9,
      font: sansBold,
      color: hexToRgb(PROTOTYPE_COLOURS.ink),
    });
  }

  for (const article of layout.articles) {
    drawArticle(page, layout.page.height, { sans, serif, sansBold }, article, false);
  }

  for (const bar of layout.pressBar.bars) {
    page.drawRectangle({
      x: bar.x,
      y: layout.page.height - bar.y - bar.height,
      width: bar.width,
      height: bar.height,
      color: hexToRgb(bar.fill),
    });
  }
  for (const dot of layout.pressBar.dots) {
    page.drawCircle({
      x: dot.x,
      y: layout.page.height - dot.y,
      size: dot.radius,
      color: hexToRgb(dot.fill),
    });
  }

  return pdf.save();
};
