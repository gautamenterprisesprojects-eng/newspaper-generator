/**
 * The section name and dateline printed on the editorial page's folio strip.
 *
 * Page 8's strip reads, left to right:
 *
 *   www.thecliffnews.com │ अभिव्यक्ति │ THE CLIFF NEWS │ Bhopal, Saturday 8 August 2026 │ 08
 *
 * The URL, the masthead and the page number are baked into the banner artwork
 * the folio band draws (`/header paper.jpg`), so they are already there. The two
 * that are not — the section name and the dateline — are printed over the band
 * as furniture, in the gaps the artwork leaves either side of the masthead.
 *
 * EDITORIAL PAGE ONLY. Inside pages keep the bare strip they have always had.
 */

import { INSIDE_HEADER_HEIGHT_PT } from "@/engines/HeaderSystem/HeaderGeometry";
import { EDITORIAL_COLOURS } from "./EditorialPageStyle";

/** The masthead's own footprint on the band, as a share of the page width. */
const MASTHEAD_LEFT_FRACTION = 0.54;
const MASTHEAD_RIGHT_FRACTION = 0.79;

/** Left edge of the URL already printed on the artwork, so the label clears it. */
const URL_RIGHT_FRACTION = 0.2;

/** The page number sits in its own red tab at the far right. */
const PAGE_NUMBER_LEFT_FRACTION = 0.95;

export type EditorialFolioText = {
  text: string;
  /** Centre of the text box, in page points. */
  centreX: number;
  /** Baseline top, in page points. */
  y: number;
  width: number;
  fontSize: number;
  colour: string;
  bold: boolean;
};

export type EditorialFolio = {
  section: EditorialFolioText;
  dateline: EditorialFolioText;
};

const SECTION_FONT_SIZE = 15;
const DATELINE_FONT_SIZE = 9;

/**
 * Where the two labels go, given the sheet width.
 *
 * Both are vertically centred on the band rather than pinned to a baseline: the
 * artwork's own type is centred, and matching it is what stops the added labels
 * reading as an overlay.
 */
export const getEditorialFolio = ({
  pageWidth,
  sectionName,
  dateline,
}: {
  pageWidth: number;
  sectionName: string;
  dateline: string;
}): EditorialFolio => {
  const bandHeight = INSIDE_HEADER_HEIGHT_PT;

  const sectionLeft = pageWidth * URL_RIGHT_FRACTION;
  const sectionRight = pageWidth * MASTHEAD_LEFT_FRACTION;
  const datelineLeft = pageWidth * MASTHEAD_RIGHT_FRACTION;
  const datelineRight = pageWidth * PAGE_NUMBER_LEFT_FRACTION;

  return {
    section: {
      text: sectionName,
      centreX: (sectionLeft + sectionRight) / 2,
      y: (bandHeight - SECTION_FONT_SIZE) / 2,
      width: Math.max(1, sectionRight - sectionLeft),
      fontSize: SECTION_FONT_SIZE,
      // White. The section name sits on the band's red field, so the accent
      // colour would print red on red and vanish; only the dateline, which
      // falls on the white part of the artwork, takes ink.
      colour: EDITORIAL_COLOURS.onAccent,
      bold: true,
    },
    dateline: {
      text: dateline,
      centreX: (datelineLeft + datelineRight) / 2,
      y: (bandHeight - DATELINE_FONT_SIZE) / 2,
      width: Math.max(1, datelineRight - datelineLeft),
      fontSize: DATELINE_FONT_SIZE,
      colour: EDITORIAL_COLOURS.ink,
      bold: false,
    },
  };
};

/** The page's section name, as page 8 prints it. */
export const EDITORIAL_SECTION_NAME = "अभिव्यक्ति";

/** "Bhopal, Saturday 8 August 2026" — the form the printed strip uses. */
export const formatEditorialDateline = (city: string, date: Date) => {
  const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
  const day = date.getDate();
  const month = date.toLocaleDateString("en-GB", { month: "long" });

  return `${city}, ${weekday} ${day} ${month} ${date.getFullYear()}`;
};
