/**
 * Youth UPDATE inside-page compact promo strip.
 *
 * This is intentionally different from the front masthead's four-image teaser
 * strip. Inside pages use the reference row: one author badge on the left,
 * then two promo cards with heading/body copy and one square image each.
 */

import { NEWSPAPER_PAGE, POINTS_PER_INCH } from "@/utils/page";
import {
  YOUTH_UPDATE_INSIDE_HEADER_HEIGHT_PT,
  YOUTH_UPDATE_INSIDE_TEASER_HEIGHT_PT,
} from "./YouthUpdateInsideHeaderGeometry";

const REFERENCE_IMAGE_WIDTH_PX = 1024;
const REFERENCE_IMAGE_HEIGHT_PX = 1536;
const PAGE_ASPECT = NEWSPAPER_PAGE.heightInches / NEWSPAPER_PAGE.widthInches;

const scaleX = (pageWidth: number, px: number) => (px / REFERENCE_IMAGE_WIDTH_PX) * pageWidth;
const scaleY = (pageWidth: number, px: number) =>
  (px / REFERENCE_IMAGE_HEIGHT_PX) * (pageWidth * PAGE_ASPECT);

const REFERENCE_PAGE_WIDTH_PT = NEWSPAPER_PAGE.widthInches * POINTS_PER_INCH;

const CONTENT_LEFT_PX = 34;
const CONTENT_RIGHT_PX = 990;
const TEASER_TOP_PX = 76;
const AUTHOR_WIDTH_PX = 128;
const AUTHOR_TO_CARD_GAP_PX = 14;
const CARD_GAP_PX = 14;
const CARD_PADDING_X_PX = 10;
const CARD_PADDING_Y_PX = 5;
const IMAGE_GAP_PX = 18;
const NAMEPLATE_HEIGHT_PX = 29;
const ORANGE_STRIP_WIDTH_PX = 12;

const TEASER_BODY_WORD_LIMIT = 86;

const endWithFullStop = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

const makeCompactBody = (text: string): string => {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const firstPeriodIdx = normalized.indexOf(".");
  if (firstPeriodIdx !== -1) {
    const firstSentence = normalized.slice(0, firstPeriodIdx + 1);
    const wordCount = firstSentence.split(" ").filter(Boolean).length;
    // If it's a short dateline (4 words or fewer), replace the period with a pipe
    if (wordCount <= 4) {
      const rest = normalized.slice(firstPeriodIdx + 1).trim();
      return firstSentence.slice(0, -1) + " | " + rest;
    }
  }

  return normalized;
};

export const YOUTH_UPDATE_INSIDE_TEASER_STRIP_HEIGHT_PT = YOUTH_UPDATE_INSIDE_TEASER_HEIGHT_PT;

export type YouthUpdateInsideAuthor = {
  imageUrl: string;
  name: string;
  designation: string;
};

export type YouthUpdateInsideAuthorGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  photo: { x: number; y: number; width: number; height: number };
  nameplate: { x: number; y: number; width: number; height: number };
  accent: { x: number; y: number; width: number; height: number };
  name: { x: number; y: number; width: number; height: number; text: string };
  designation: { x: number; y: number; width: number; height: number; text: string };
  imageUrl: string;
};

export type YouthUpdateInsideTeaserBox = {
  headline: { x: number; y: number; width: number; height: number; text: string };
  dropCap: { x: number; y: number; width: number; height: number; text: string };
  body: { x: number; y: number; width: number; height: number; text: string };
  photo: { x: number; y: number; width: number; height: number };
  imageUrl: string;
};

export type YouthUpdateInsideTeaserStripGeometry = {
  y: number;
  height: number;
  author: YouthUpdateInsideAuthorGeometry;
  boxes: YouthUpdateInsideTeaserBox[];
  dividerXs: number[];
  bottomRule: { y: number; x1: number; x2: number };
};

export type YouthUpdateInsideTeaserStripInput = {
  pageWidth: number;
  headlines: [string, string, string, string];
  labels: [string, string, string, string];
  imageUrls: [string, string, string, string];
  author: YouthUpdateInsideAuthor;
};

export const getYouthUpdateInsideTeaserStripGeometry = (
  input: YouthUpdateInsideTeaserStripInput,
): YouthUpdateInsideTeaserStripGeometry => {
  const { pageWidth } = input;
  const contentLeft = scaleX(pageWidth, CONTENT_LEFT_PX);
  const contentRight = scaleX(pageWidth, CONTENT_RIGHT_PX);
  const authorWidth = scaleX(pageWidth, AUTHOR_WIDTH_PX);
  const authorGap = scaleX(pageWidth, AUTHOR_TO_CARD_GAP_PX);
  const cardGap = scaleX(pageWidth, CARD_GAP_PX);
  const y = scaleY(pageWidth, TEASER_TOP_PX);
  const height = YOUTH_UPDATE_INSIDE_TEASER_STRIP_HEIGHT_PT * (pageWidth / REFERENCE_PAGE_WIDTH_PT);
  const cardStartX = contentLeft + authorWidth + authorGap;
  const cardWidth = (contentRight - cardStartX - cardGap) / 2;
  const paddingX = scaleX(pageWidth, CARD_PADDING_X_PX);
  const paddingY = scaleY(pageWidth, CARD_PADDING_Y_PX);
  const imageGap = scaleX(pageWidth, IMAGE_GAP_PX);
  const imageWidth = Math.max(1, Math.min(cardWidth * 0.42, height * 0.82));
  const headlineHeight = height * 0.14;
  const headlineToBodyGap = height * 0.004;
  const bodyTop = y + paddingY + headlineHeight + headlineToBodyGap;
  const imageRowHeight = Math.max(1, y + height - paddingY - bodyTop);
  const imageHeight = Math.max(1, height - paddingY * 2);
  const nameplateHeight = scaleY(pageWidth, NAMEPLATE_HEIGHT_PX);
  const accentWidth = scaleX(pageWidth, ORANGE_STRIP_WIDTH_PX);
  const authorPhotoHeight = Math.max(1, height - nameplateHeight);
  const textInset = accentWidth + scaleX(pageWidth, 6);

  const author: YouthUpdateInsideAuthorGeometry = {
    x: contentLeft,
    y,
    width: authorWidth,
    height,
    photo: {
      x: contentLeft,
      y,
      width: authorWidth,
      height: authorPhotoHeight,
    },
    nameplate: {
      x: contentLeft,
      y: y + authorPhotoHeight,
      width: authorWidth,
      height: nameplateHeight,
    },
    accent: {
      x: contentLeft,
      y: y + authorPhotoHeight,
      width: accentWidth,
      height: nameplateHeight,
    },
    name: {
      x: contentLeft + textInset,
      y: y + authorPhotoHeight + nameplateHeight * 0.15,
      width: authorWidth - textInset - scaleX(pageWidth, 4),
      height: nameplateHeight * 0.4,
      text: input.author.name,
    },
    designation: {
      x: contentLeft + textInset,
      y: y + authorPhotoHeight + nameplateHeight * 0.58,
      width: authorWidth - textInset - scaleX(pageWidth, 4),
      height: nameplateHeight * 0.28,
      text: input.author.designation,
    },
    imageUrl: input.author.imageUrl,
  };

  const boxes: YouthUpdateInsideTeaserBox[] = Array.from({ length: 2 }, (_, i) => {
    const x = cardStartX + i * (cardWidth + cardGap);
    const textX = x + paddingX;
    const imageX = x + cardWidth - paddingX - imageWidth;
    const bodyTextWidth = Math.max(1, imageX - imageGap - textX);
    const compactBody = makeCompactBody(input.labels[i]);
    const bodyText = compactBody.trim();

    return {
      headline: {
        x: textX,
        // The photo sits at this card's top-right corner (`photo.y` below is
        // the same y as this headline) and runs nearly the card's full
        // height, so the headline's measure has to stop short of it exactly
        // the way the body's already does. It used to be handed the whole
        // card width instead, which laid the headline straight across the
        // picture -- the two collided on any headline long enough to reach.
        width: bodyTextWidth,
        y: y + paddingY,
        height: headlineHeight,
        text: input.headlines[i],
      },
      dropCap: {
        x: textX,
        y: bodyTop,
        width: 0,
        height: 0,
        text: "",
      },
      body: {
        x: textX,
        y: bodyTop + scaleY(pageWidth, 2),
        width: bodyTextWidth,
        height: imageRowHeight,
        text: bodyText,
      },
      photo: {
        x: imageX,
        y: y + paddingY,
        width: imageWidth,
        height: imageHeight,
      },
      imageUrl: input.imageUrls[i] ?? "",
    };
  });

  const dividerXs = [cardStartX + cardWidth + cardGap / 2];
  const bottomRule = { y: y + height + scaleY(pageWidth, 3), x1: contentLeft, x2: contentRight };

  return { y, height, author, boxes, dividerXs, bottomRule };
};

/** Re-exported so callers don't need a second import for the header's own height. */
export const YOUTH_UPDATE_INSIDE_HEADER_HEIGHT = YOUTH_UPDATE_INSIDE_HEADER_HEIGHT_PT;

const countWrappedLines = (
  text: string,
  width: number,
  measure: (value: string) => number,
) => {
  const words = text.trim().split(/\s+/u).filter(Boolean);
  let lines = words.length > 0 ? 1 : 0;
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && measure(candidate) > width) {
      lines += 1;
      current = word;
    } else {
      current = candidate;
    }
  }

  return lines;
};

/**
 * Fits a teaser card's headline into the measure beside its photo without
 * ever dropping words.
 *
 * The card gives the headline a fixed depth, so a headline too long for it
 * was being cut with an ellipsis. A newspaper sets the line tighter instead:
 * take up to two points off the size first, and only if that still will not
 * hold, condense the type horizontally -- the same condensing the kicker and
 * the masthead wordmark already use, and which both renderers honour.
 *
 * `measure` takes the text and a size and returns its natural width, so the
 * Konva preview and the PDF canvas can each pass their own measurement and
 * still land on identical numbers.
 */
export const fitYouthUpdateInsideTeaserHeadline = ({
  text,
  width,
  height,
  baseFontSize,
  measure,
}: {
  text: string;
  width: number;
  height: number;
  baseFontSize: number;
  measure: (value: string, fontSize: number) => number;
}): { fontSize: number; scaleX: number; width: number } => {
  const lineHeight = 1.05;
  const maxLines = Math.max(1, Math.floor(height / (baseFontSize * lineHeight)));

  for (const drop of [0, 0.5, 1, 1.5, 2]) {
    const fontSize = baseFontSize - drop;
    if (countWrappedLines(text, width, (value) => measure(value, fontSize)) <= maxLines) {
      return { fontSize, scaleX: 1, width };
    }
  }

  // Still over: hold at the smallest allowed size and squeeze horizontally.
  // Wrapping happens at the pre-squeeze measure (width / scaleX) so that once
  // the line is drawn condensed it lands exactly on the real measure.
  const fontSize = baseFontSize - 2;
  for (let scaleX = 0.98; scaleX >= 0.82; scaleX -= 0.02) {
    const wrapWidth = width / scaleX;
    if (countWrappedLines(text, wrapWidth, (value) => measure(value, fontSize)) <= maxLines) {
      return { fontSize, scaleX, width: wrapWidth };
    }
  }

  return { fontSize, scaleX: 0.82, width: width / 0.82 };
};
