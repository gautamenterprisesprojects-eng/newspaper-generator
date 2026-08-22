/**
 * The custom inside-page header built for exactly one publisher — Youth
 * UPDATE (publisher_id 85a50d12-8aa3-4f88-93aa-8153443c1c98) — a compact
 * strip (small wordmark, city bar, date/page-number box) reproducing their
 * reference layout.
 *
 * Numbers below are read off the publisher's own reference mockup image
 * (`public/youth-update/inside layout.jpeg`, 1024x1536 -- a full inside
 * page, not just a header crop) with a pixel probe (see scratch/ scripts
 * from this feature's build): border-line rows/columns were scanned
 * directly rather than eyeballed. Horizontal measurements scale off the
 * reference's own width (1024px); vertical measurements scale off its own
 * height (1536px) via the page's fixed 13x21in aspect ratio -- unlike the
 * front masthead's reference (a width-only banner crop), this reference is
 * a whole page, so both axes carry real proportion.
 *
 * Gated entirely by templateId (see YouthUpdateConfig's
 * YOUTH_UPDATE_INSIDE_TEMPLATE_ID) — this file is never imported by
 * anything that runs for another publisher's page.
 */

import { NEWSPAPER_PAGE, POINTS_PER_INCH } from "@/utils/page";
import {
  YOUTH_UPDATE_WORDMARK_FONT_FAMILY,
  YOUTH_UPDATE_COLORS,
  YOUTH_BASE_WIDTH_TO_FONT_SIZE,
} from "./YouthUpdateMastheadGeometry";

const REFERENCE_IMAGE_WIDTH_PX = 1024;
const REFERENCE_IMAGE_HEIGHT_PX = 1536;
const PAGE_ASPECT = NEWSPAPER_PAGE.heightInches / NEWSPAPER_PAGE.widthInches;

const scaleX = (pageWidth: number, px: number) => (px / REFERENCE_IMAGE_WIDTH_PX) * pageWidth;
const scaleY = (pageWidth: number, px: number) =>
  (px / REFERENCE_IMAGE_HEIGHT_PX) * (pageWidth * PAGE_ASPECT);

/**
 * The header strip's own height: wherever its bottom border actually lands
 * in the reference, not a round number picked in advance -- same
 * self-consistency requirement as YOUTH_UPDATE_MASTHEAD_HEIGHT_PT, computed
 * once at the reference page width and exported as a plain number because
 * getPageKindContentBounds needs one to reserve before any page has been
 * laid out.
 */
const REFERENCE_HEADER_BOTTOM_PX = 75;
const REFERENCE_TEASER_FULL_BOTTOM_PX = 329;
const INSIDE_AUTHOR_STRIP_SCALE = 0.6;
const REFERENCE_TEASER_BOTTOM_PX =
  REFERENCE_HEADER_BOTTOM_PX + (REFERENCE_TEASER_FULL_BOTTOM_PX - REFERENCE_HEADER_BOTTOM_PX) * INSIDE_AUTHOR_STRIP_SCALE;

const REFERENCE_PAGE_WIDTH_PT = NEWSPAPER_PAGE.widthInches * POINTS_PER_INCH;

export const YOUTH_UPDATE_INSIDE_HEADER_HEIGHT_PT = scaleY(REFERENCE_PAGE_WIDTH_PT, REFERENCE_HEADER_BOTTOM_PX);
export const YOUTH_UPDATE_INSIDE_TEASER_HEIGHT_PT =
  scaleY(REFERENCE_PAGE_WIDTH_PT, REFERENCE_TEASER_BOTTOM_PX) - YOUTH_UPDATE_INSIDE_HEADER_HEIGHT_PT;
/** What editorStore.ts's getPageKindContentBounds reserves in total. */
export const YOUTH_UPDATE_INSIDE_RESERVED_HEIGHT_PT =
  scaleY(REFERENCE_PAGE_WIDTH_PT, REFERENCE_TEASER_BOTTOM_PX) + scaleY(REFERENCE_PAGE_WIDTH_PT, 4);
export const YOUTH_UPDATE_INSIDE_HEADER_ONLY_RESERVED_HEIGHT_PT =
  YOUTH_UPDATE_INSIDE_HEADER_HEIGHT_PT + scaleY(REFERENCE_PAGE_WIDTH_PT, 4);
export const YOUTH_UPDATE_INSIDE_RESERVED_HEIGHT_IN = YOUTH_UPDATE_INSIDE_RESERVED_HEIGHT_PT / POINTS_PER_INCH;
export const YOUTH_UPDATE_INSIDE_HEADER_ONLY_RESERVED_HEIGHT_IN =
  YOUTH_UPDATE_INSIDE_HEADER_ONLY_RESERVED_HEIGHT_PT / POINTS_PER_INCH;

export type YouthUpdateInsideHeaderGeometry = {
  height: number;
  wordmark: { x: number; y: number; fontSize: number; youthWidth: number; youth: string; update: string };
  cityBar: { x: number; y: number; width: number; height: number; text: string };
  dateBox: {
    x: number;
    y: number;
    width: number;
    height: number;
    dateText: string;
    pageNumber: string;
  };
};

export type YouthUpdateInsideHeaderInput = {
  pageWidth: number;
  city: string;
  sectionName?: string;
  dateLabel: string;
  pageNumber: number;
};

export const getYouthUpdateInsideHeaderGeometry = (
  input: YouthUpdateInsideHeaderInput,
): YouthUpdateInsideHeaderGeometry => {
  const { pageWidth } = input;
  const height = scaleY(pageWidth, REFERENCE_HEADER_BOTTOM_PX);
  const wordmarkFontSize = scaleY(pageWidth, 46);
  // Same Anton-font width ratio the front masthead measured off real font
  // metrics (see YouthUpdateMastheadGeometry.ts) -- "UPDATE" is positioned
  // right after "Youth"'s own real width, not a guessed multiplier, so the
  // two never overlap regardless of font size.
  const youthWidth = wordmarkFontSize * YOUTH_BASE_WIDTH_TO_FONT_SIZE;

  return {
    height,
    wordmark: {
      x: scaleX(pageWidth, 34),
      y: scaleY(pageWidth, 14),
      fontSize: wordmarkFontSize,
      youthWidth,
      youth: "Youth",
      update: "UPDATE",
    },
    cityBar: {
      x: scaleX(pageWidth, 328),
      y: scaleY(pageWidth, 8),
      width: scaleX(pageWidth, 367),
      height: scaleY(pageWidth, 60),
      text: (input.sectionName || input.city).toUpperCase(),
    },
    dateBox: {
      x: scaleX(pageWidth, 696),
      y: scaleY(pageWidth, 8),
      width: scaleX(pageWidth, 316),
      height: scaleY(pageWidth, 60),
      dateText: `${input.city.toUpperCase()}, ${input.dateLabel}`,
      pageNumber: String(input.pageNumber),
    },
  };
};

export const YOUTH_UPDATE_INSIDE_COLORS = YOUTH_UPDATE_COLORS;
export const YOUTH_UPDATE_INSIDE_WORDMARK_FONT_FAMILY = YOUTH_UPDATE_WORDMARK_FONT_FAMILY;
