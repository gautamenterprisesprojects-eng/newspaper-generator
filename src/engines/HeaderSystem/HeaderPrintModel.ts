import type { NewspaperDocument } from "@/types/document";
import type { ResolvedHeaderSlot } from "@/types/header";
import { getHeaderBannerSource } from "./HeaderGeometry";
import { resolvePageHeader } from "./HeaderResolver";
import { getFrontHeaderOverlayGeometry, getInsideHeaderOverlayGeometry } from "./HeaderSlotGeometry";
import { isLiveHeaderSvgUrl, resolveFrontHeaderSvgSource, resolveInsideHeaderSvgSource } from "./HeaderSvgTemplate";

export type HeaderPrintTextOperation = {
  kind: "text";
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  fontFamily: "serif" | "sans" | "condensed";
  fontSize: number;
  fontWeight: "normal" | "bold";
  color: string;
  align: "left" | "center" | "right";
};

export type HeaderPrintRuleOperation = {
  kind: "rule";
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
};

export type HeaderPrintImageOperation = {
  kind: "image";
  id: string;
  source: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fit: "contain";
};

export type HeaderPrintRectOperation = {
  kind: "rect";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

export type HeaderPrintOperation =
  | HeaderPrintTextOperation
  | HeaderPrintRuleOperation
  | HeaderPrintImageOperation
  | HeaderPrintRectOperation;

export type HeaderPrintModel = {
  pageId: string;
  pageNumber: number;
  headerKind: "front" | "inside";
  reservedHeight: number;
  operations: HeaderPrintOperation[];
};

const textOp = (
  id: string,
  slot: ResolvedHeaderSlot,
  x: number,
  y: number,
  width: number,
): HeaderPrintTextOperation | null =>
  slot.text
    ? {
        kind: "text",
        id,
        text: slot.text,
        x,
        y,
        width,
        fontFamily: slot.fontFamily,
        fontSize: slot.fontSize,
        fontWeight: slot.fontWeight,
        color: slot.color,
        align: slot.align,
      }
    : null;

const ruleOp = (
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
): HeaderPrintRuleOperation => ({
  kind: "rule",
  id,
  x1,
  y1,
  x2,
  y2,
  color,
  width,
});

const rectOp = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): HeaderPrintRectOperation => ({
  kind: "rect",
  id,
  x,
  y,
  width,
  height,
  color,
});

const imageOp = (
  id: string,
  source: string | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
): HeaderPrintImageOperation | null =>
  source
    ? {
        kind: "image",
        id,
        source,
        x,
        y,
        width,
        height,
        fit: "contain",
      }
    : null;

/** Builds deterministic header drawing operations for print/PDF export. */
export const buildHeaderPrintModel = async (
  document: NewspaperDocument,
  pageId: string,
): Promise<HeaderPrintModel | null> => {
  const header = resolvePageHeader(document, pageId);
  const page = document.pages.find((candidate) => candidate.id === pageId);

  if (!header || !page) {
    return null;
  }

  const pageWidth = page.masterPage.width * 72;
  const headerHeight = header.reservedHeight;
  const headerBannerSource =
    header.header.headerImageUrl ?? getHeaderBannerSource(header.header.kind);
  // A live SVG template's own <text> elements already carry the correct
  // values once substituted — the banner image itself is the update, so no
  // mask/overlay text operations are emitted below for this case (see
  // HeaderSvgTemplate.ts).
  const isLiveFrontSvg = header.header.kind === "front" && isLiveHeaderSvgUrl(headerBannerSource);
  const isLiveInsideSvg = header.header.kind === "inside" && isLiveHeaderSvgUrl(headerBannerSource);
  const resolvedBannerSource = isLiveFrontSvg && header.header.kind === "front"
    ? await resolveFrontHeaderSvgSource(headerBannerSource, {
        place: header.header.eyebrowLeft.text,
        day: header.header.eyebrowRight.text,
        dateNumber: header.header.skyline.text,
        monthYear: header.header.footerLine.text,
        year: header.header.leftEar.text,
        volume: header.header.rightEar.text,
        issue: header.issueLabel,
      }).catch(() => headerBannerSource)
    : isLiveInsideSvg && header.header.kind === "inside"
      ? await resolveInsideHeaderSvgSource(headerBannerSource, {
          category: header.header.left.text,
          placeAndDate: header.header.right.text,
          pageNumber: String(header.pageNumber),
        }).catch(() => headerBannerSource)
      : headerBannerSource;

  const operations: HeaderPrintOperation[] = [];
  const headerBannerOp = imageOp("header-banner", resolvedBannerSource, 0, 0, pageWidth, headerHeight);
  if (headerBannerOp) {
    operations.push(headerBannerOp);
  }

  // Day/date (and on the front page, issue/price) painted over the banner
  // artwork so they stay current every issue without the publisher ever
  // re-uploading their header image. The masthead nameplate itself is never
  // drawn here — it's part of whichever banner image is showing.
  if (header.header.kind === "front" && !isLiveFrontSvg) {
    const geometry = getFrontHeaderOverlayGeometry(pageWidth, headerHeight, header.header.maskColors);

    geometry.maskBands.forEach((band, index) => {
      operations.push(rectOp(`header-mask-${index}`, band.x, band.y, band.width, band.height, band.fill));
    });

    const eyebrowLeftOp = textOp(
      "header-eyebrow-left",
      header.header.eyebrowLeft,
      geometry.eyebrowLeft.x,
      geometry.eyebrowLeft.y,
      geometry.eyebrowLeft.width,
    );
    if (eyebrowLeftOp) operations.push(eyebrowLeftOp);

    const eyebrowRightOp = textOp(
      "header-eyebrow-right",
      header.header.eyebrowRight,
      geometry.eyebrowRight.x,
      geometry.eyebrowRight.y,
      geometry.eyebrowRight.width,
    );
    if (eyebrowRightOp) operations.push(eyebrowRightOp);

    const dateNumberOp = textOp(
      "header-date-number",
      header.header.skyline,
      geometry.dateNumber.x,
      geometry.dateNumber.y,
      geometry.dateNumber.width,
    );
    if (dateNumberOp) operations.push(dateNumberOp);

    const monthYearOp = textOp(
      "header-month-year",
      header.header.footerLine,
      geometry.monthYear.x,
      geometry.monthYear.y,
      geometry.monthYear.width,
    );
    if (monthYearOp) operations.push(monthYearOp);

    const yearOp = textOp(
      "header-year-block",
      header.header.leftEar,
      geometry.yearBlock.x,
      geometry.yearBlock.y,
      geometry.yearBlock.width,
    );
    if (yearOp) operations.push(yearOp);

    const volumeOp = textOp(
      "header-volume-block",
      header.header.rightEar,
      geometry.volumeBlock.x,
      geometry.volumeBlock.y,
      geometry.volumeBlock.width,
    );
    if (volumeOp) operations.push(volumeOp);
  } else if (header.header.kind === "inside" && !isLiveInsideSvg) {
    const geometry = getInsideHeaderOverlayGeometry(pageWidth, headerHeight, header.header.maskColors);

    geometry.maskBands.forEach((band, index) => {
      operations.push(rectOp(`header-mask-${index}`, band.x, band.y, band.width, band.height, band.fill));
    });

    const datelineOp = textOp(
      "header-dateline",
      header.header.right,
      geometry.dateline.x,
      geometry.dateline.y,
      geometry.dateline.width,
    );
    if (datelineOp) operations.push(datelineOp);
  }

  return {
    pageId,
    pageNumber: header.pageNumber,
    headerKind: header.header.kind,
    reservedHeight: header.reservedHeight,
    operations,
  };
};
