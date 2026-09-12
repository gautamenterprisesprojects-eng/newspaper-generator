import "regenerator-runtime/runtime";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { cmyk, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { NmsBundleArticle, NmsBundlePayload } from "./nmsBundleTypes";
import { getNumericTargetUserId, textValue } from "./nmsBundleTypes";
import { getNmsGeneratedPdfDir, sanitizeFilePart } from "./nmsBundleStorage";

const PAGE_WIDTH = 936;
const PAGE_HEIGHT = 1440;
const MARGIN = 36;
const COLUMN_GAP = 14;
const BODY_FONT_SIZE = 10;
const BODY_LINE_HEIGHT = 13;
const HEADLINE_FONT_SIZE = 19;
const HEADLINE_LINE_HEIGHT = 24;
const TOP_BAR_HEIGHT = 32;
const STORIES_PER_PAGE = 6;

type NmsRenderArticle = NmsBundleArticle & { nmsFilled?: boolean };

type EmbeddedFonts = {
  headline: PDFFont;
  body: PDFFont;
  bodyBold: PDFFont;
  latin: PDFFont;
};

type LoadedImage = {
  key: string;
  image: PDFImage;
};

const hasDevanagari = (value: string) => /[\u0900-\u097F]/.test(value);

const fontPath = (name: string) => path.join(process.cwd(), "public", "fonts", name);

const embedFonts = async (pdfDoc: PDFDocument): Promise<EmbeddedFonts> => {
  pdfDoc.registerFontkit(fontkit);
  const [headlineBytes, bodyBytes, bodyBoldBytes] = await Promise.all([
    readFile(fontPath("TiroDevanagariHindi-Regular.ttf")),
    readFile(fontPath("NotoSerifDevanagari-ExtraCondensedMedium.ttf")),
    readFile(fontPath("NotoSerifDevanagari-ExtraCondensedSemiBold.ttf")),
  ]);

  return {
    headline: await pdfDoc.embedFont(headlineBytes, { subset: true }),
    body: await pdfDoc.embedFont(bodyBytes, { subset: true }),
    bodyBold: await pdfDoc.embedFont(bodyBoldBytes, { subset: true }),
    latin: await pdfDoc.embedFont(StandardFonts.Helvetica),
  };
};

const wrapText = (text: string, font: PDFFont, size: number, maxWidth: number, maxLines = 100) => {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    }
  }

  if (current && lines.length < maxLines) lines.push(current);
  return lines;
};

const drawTextLines = ({
  page,
  lines,
  x,
  y,
  font,
  size,
  lineHeight,
  color = rgb(0, 0, 0),
}: {
  page: PDFPage;
  lines: string[];
  x: number;
  y: number;
  font: PDFFont;
  size: number;
  lineHeight: number;
  color?: ReturnType<typeof rgb>;
}) => {
  let cursorY = y;
  for (const line of lines) {
    page.drawText(line, { x, y: cursorY, font, size, color });
    cursorY -= lineHeight;
  }
  return cursorY;
};

const getArticleHeadline = (article: NmsRenderArticle) =>
  textValue(article.headline) || textValue(article.originalHeadline) || "Untitled story";

const getArticleBody = (article: NmsRenderArticle) =>
  textValue(article.body) || textValue(article.originalBody) || "";

const getArticlePlace = (article: NmsRenderArticle) => textValue(article.place);
const getArticleCategory = (article: NmsRenderArticle) => textValue(article.category) || "News";

const getArticleImageUrl = (article: NmsRenderArticle) => {
  const coverUrl = textValue(article.coverImage?.url);
  if (coverUrl) return coverUrl;
  const firstImage = Array.isArray(article.images) ? article.images.find((image) => textValue(image.url)) : null;
  return textValue(firstImage?.url);
};

const fetchImageBytes = async (url: string) => {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!/image\/(png|jpe?g)/i.test(contentType) && !/\.(png|jpe?g)(\?|$)/i.test(url)) return null;
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      mimeType: contentType.includes("png") || /\.png(\?|$)/i.test(url) ? "image/png" : "image/jpeg",
    };
  } catch {
    return null;
  }
};

const loadArticleImage = async (pdfDoc: PDFDocument, article: NmsRenderArticle, key: string): Promise<LoadedImage | null> => {
  const url = getArticleImageUrl(article);
  if (!url) return null;
  const fetched = await fetchImageBytes(url);
  if (!fetched) return null;

  try {
    return {
      key,
      image: fetched.mimeType === "image/png" ? await pdfDoc.embedPng(fetched.bytes) : await pdfDoc.embedJpg(fetched.bytes),
    };
  } catch {
    return null;
  }
};

const drawImageCover = (page: PDFPage, image: PDFImage, x: number, y: number, width: number, height: number) => {
  const scale = Math.max(width / image.width, height / image.height);
  const drawnWidth = image.width * scale;
  const drawnHeight = image.height * scale;
  page.drawImage(image, {
    x: x - (drawnWidth - width) / 2,
    y: y - (drawnHeight - height) / 2,
    width: drawnWidth,
    height: drawnHeight,
  });
};

const drawMasthead = (page: PDFPage, fonts: EmbeddedFonts, payload: NmsBundlePayload, pageNumber: number) => {
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - TOP_BAR_HEIGHT, width: PAGE_WIDTH, height: TOP_BAR_HEIGHT, color: cmyk(0, 0.9, 0.85, 0.03) });
  page.drawText("THE CLIFF NEWS", { x: MARGIN, y: PAGE_HEIGHT - 22, font: fonts.latin, size: 16, color: rgb(1, 1, 1) });
  const target = textValue(payload.targetUser?.fullName) || textValue(payload.targetUser?.nameHi) || "NMS Edition";
  page.drawText(`NMS / PageMint: cliffdemo3  •  ${target}`, { x: 260, y: PAGE_HEIGHT - 21, font: fonts.bodyBold, size: 10, color: rgb(1, 1, 1) });
  page.drawText(`Page ${pageNumber}`, { x: PAGE_WIDTH - 88, y: PAGE_HEIGHT - 21, font: fonts.latin, size: 10, color: rgb(1, 1, 1) });
};

const drawArticle = async ({
  pdfDoc,
  page,
  fonts,
  article,
  x,
  y,
  width,
  height,
  articleIndex,
}: {
  pdfDoc: PDFDocument;
  page: PDFPage;
  fonts: EmbeddedFonts;
  article: NmsRenderArticle;
  x: number;
  y: number;
  width: number;
  height: number;
  articleIndex: number;
}) => {
  page.drawRectangle({ x, y: y - height, width, height, borderColor: rgb(0.72, 0.72, 0.72), borderWidth: 0.55 });
  const innerX = x + 8;
  const innerWidth = width - 16;
  let cursorY = y - 18;
  const category = getArticleCategory(article);
  const accent = article.nmsFilled ? rgb(0.1, 0.38, 0.52) : rgb(0.48, 0.08, 0.22);
  page.drawText(category, { x: innerX, y: cursorY, font: fonts.bodyBold, size: 9, color: accent });
  cursorY -= 16;

  const headline = getArticleHeadline(article);
  const headlineFont = hasDevanagari(headline) ? fonts.headline : fonts.latin;
  const headlineLines = wrapText(headline, headlineFont, HEADLINE_FONT_SIZE, innerWidth, 3);
  cursorY = drawTextLines({ page, lines: headlineLines, x: innerX, y: cursorY, font: headlineFont, size: HEADLINE_FONT_SIZE, lineHeight: HEADLINE_LINE_HEIGHT });
  cursorY -= 6;

  const image = await loadArticleImage(pdfDoc, article, `article-${articleIndex}`);
  if (image && height > 245) {
    const imageHeight = Math.min(118, Math.max(76, height * 0.23));
    drawImageCover(page, image.image, innerX, cursorY - imageHeight, innerWidth, imageHeight);
    cursorY -= imageHeight + 11;
  }

  const place = getArticlePlace(article);
  const byline = ["द क्लिफ न्यूज़", place].filter(Boolean).join(" • ");
  if (byline) {
    const bylineLines = wrapText(byline, fonts.bodyBold, 8.5, innerWidth, 1);
    cursorY = drawTextLines({ page, lines: bylineLines, x: innerX, y: cursorY, font: fonts.bodyBold, size: 8.5, lineHeight: 11, color: rgb(0.12, 0.12, 0.12) });
    page.drawLine({ start: { x: innerX, y: cursorY + 4 }, end: { x: innerX + innerWidth, y: cursorY + 4 }, thickness: 0.45, color: rgb(0.65, 0.65, 0.65), dashArray: [1.5, 2.2] });
    cursorY -= 7;
  }

  const body = getArticleBody(article);
  const bodyFont = hasDevanagari(body) ? fonts.body : fonts.latin;
  const maxBodyLines = Math.max(3, Math.floor((cursorY - (y - height + 14)) / BODY_LINE_HEIGHT));
  const bodyLines = wrapText(body, bodyFont, BODY_FONT_SIZE, innerWidth, maxBodyLines);
  drawTextLines({ page, lines: bodyLines, x: innerX, y: cursorY, font: bodyFont, size: BODY_FONT_SIZE, lineHeight: BODY_LINE_HEIGHT });
};

export const generateNmsPdf = async (payload: NmsBundlePayload, articles: NmsRenderArticle[]) => {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setProducer("PageMint NMS PDF Bridge");
  pdfDoc.setCreator("PageMint Newspaper Generator");
  pdfDoc.setTitle(`NMS ${String(payload.bundle_id || payload.job_id || "bundle")}`);
  const fonts = await embedFonts(pdfDoc);

  const totalPages = Math.max(1, Math.ceil(articles.length / STORIES_PER_PAGE));
  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(1, 0.995, 0.975) });
    drawMasthead(page, fonts, payload, pageIndex + 1);

    const pageArticles = articles.slice(pageIndex * STORIES_PER_PAGE, (pageIndex + 1) * STORIES_PER_PAGE);
    const usableTop = PAGE_HEIGHT - TOP_BAR_HEIGHT - 22;
    const usableHeight = usableTop - MARGIN;
    const colWidth = (PAGE_WIDTH - MARGIN * 2 - COLUMN_GAP * 2) / 3;
    const rowHeight = (usableHeight - COLUMN_GAP) / 2;

    for (let index = 0; index < pageArticles.length; index += 1) {
      const col = index % 3;
      const row = Math.floor(index / 3);
      await drawArticle({
        pdfDoc,
        page,
        fonts,
        article: pageArticles[index],
        x: MARGIN + col * (colWidth + COLUMN_GAP),
        y: usableTop - row * (rowHeight + COLUMN_GAP),
        width: colWidth,
        height: rowHeight,
        articleIndex: pageIndex * STORIES_PER_PAGE + index,
      });
    }
  }

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
  const pdfDir = getNmsGeneratedPdfDir();
  await mkdir(pdfDir, { recursive: true });
  const filename = `nms-${sanitizeFilePart(payload.target_user_id)}-${sanitizeFilePart(payload.job_id || payload.bundle_id || Date.now())}.pdf`;
  const pdfPath = path.join(pdfDir, filename);
  await writeFile(pdfPath, pdfBytes);
  await writeFile(`${pdfPath}.json`, `${JSON.stringify({
    job_id: payload.job_id ?? null,
    bundle_id: payload.bundle_id ?? null,
    edition_id: payload.edition_id ?? null,
    target_user_id: getNumericTargetUserId(payload),
    pagemint_user_id: payload.pagemint_user_id ?? null,
    pagemint_target_id: payload.pagemint_target_id ?? null,
    articleCount: articles.length,
    generatedAt: new Date().toISOString(),
  }, null, 2)}\n`, "utf8");

  return { pdfPath, filename };
};

