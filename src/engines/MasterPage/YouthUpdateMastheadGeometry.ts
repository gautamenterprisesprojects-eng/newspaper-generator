/**
 * The custom front-page masthead built for exactly one publisher — Youth
 * UPDATE (publisher_id 85a50d12-8aa3-4f88-93aa-8153443c1c98) — reproducing
 * their real print masthead: the "Youth"/"UPDATE" wordmark with its red dot,
 * a four-teaser strip (cutout photo + dotted divider + headline/category),
 * and a blue issue/price info bar.
 *
 * Unlike PressColourBarGeometry's measurements (taken off a real printed
 * sheet), the numbers here are read off the publisher's own reference
 * mockup image (`public/youthupdate header.jpeg`, 1600x469) with a pixel
 * probe (see scratch/ scripts from that session) rather than a physical
 * measurement -- expect to nudge them further once compared against a live
 * render using the publisher's own real content.
 *
 * Gated entirely by templateId (see TemplateRegistry's
 * YOUTH_UPDATE_FRONT_TEMPLATE_ID) — this file is never imported by anything
 * that runs for another publisher's page.
 */

import { POINTS_PER_INCH } from "@/utils/page";

export const YOUTH_UPDATE_WORDMARK_FONT_FAMILY = "Anton";

/**
 * Every band below is sized as a fraction of the page width rather than a
 * fraction of the masthead's total height -- sizing off the total height
 * was circular (a taller masthead made every band inside it taller too),
 * and the reserved height was a flat guess disconnected from where the
 * info bar actually ended, leaving a dead gap above the first story). This
 * template is only ever laid out on the generator's one fixed broadsheet
 * master, so a page-width-relative constant is safe here.
 */
const REFERENCE_PAGE_WIDTH_PT = 13 * POINTS_PER_INCH;

const REFERENCE_IMAGE_WIDTH_PX = 1600;
const REFERENCE_MASTHEAD_HEIGHT_PX = 469;

const scaleFromReference = (pageWidth: number, px: number) =>
  (px / REFERENCE_IMAGE_WIDTH_PX) * pageWidth;

const YOUTH_UPDATE_REFERENCE_TEASERS = [
  { photo: [22, 286, 210, 144], headline: [235, 291, 122, 92], label: [259, 408, 126], dividerX: 382 },
  { photo: [431, 286, 224, 144], headline: [681, 296, 108, 88], label: [681, 408, 126], dividerX: 806 },
  { photo: [855, 286, 204, 144], headline: [1070, 274, 102, 110], label: [1072, 408, 128], dividerX: 1204 },
  { photo: [1208, 286, 220, 144], headline: [1444, 271, 130, 112], label: [1424, 408, 152], dividerX: null },
] as const;

/**
 * "Youth"/"UPDATE" glyph widths in the Anton font, measured via
 * canvas.measureText() at a 218px reference size (scratch/yu-anton-measure.mjs)
 * -- Anton's own metrics don't match the reference image's font, so the
 * reference's raw pixel positions can't be reused for centring or for where
 * the dot needs to sit; everything below is a ratio of the font size instead,
 * calibrated to what this app actually renders.
 */
export const YOUTH_BASE_WIDTH_TO_FONT_SIZE = 491.032 / 218;
const UPDATE_BASE_WIDTH_TO_FONT_SIZE = 592.688 / 218;
const YOUTH_CHAR_COUNT = 5;
const UPDATE_CHAR_COUNT = 6;
// "You" ends at 314.33px, "Yout" at 380.86px (both /218 for a font-size
// ratio) -- the dot centres over that span, i.e. over the "t", not the "h"
// after it.
const YOU_BASE_WIDTH_TO_FONT_SIZE = 314.333 / 218;
const YOUT_BASE_WIDTH_TO_FONT_SIZE = 380.861 / 218;
/**
 * Extra tracking within "Youth" and "UPDATE" -- set as measured, the
 * wordmark only fills ~70% of the page width; the reference's own wordmark
 * runs almost edge to edge (~8% clear margin either side). Widening the
 * letterforms themselves (rather than just the word-gap) is what actually
 * closes that gap -- see fillCanvasText's per-character advance, the PDF
 * twin of this same spacing.
 */
const WORDMARK_LETTER_SPACING_TO_FONT_SIZE = 0.096;
// A visible word-gap between "Youth" and "UPDATE" -- the reference's own
// gap (9/218) reads as the two words touching once set in Anton, which is
// a different, more condensed font than the reference's own.
const WORDMARK_GAP_TO_FONT_SIZE = 0.14;

/**
 * Anton's capital letters render with visible ink starting *above* the
 * nominal "top" of the em box used for textBaseline="top" positioning --
 * measured via canvas actualBoundingBoxAscent at the reference font size
 * (scratch/yu-tagline-overlap-probe.mjs: 17.656px of overshoot at a 218px
 * reference font size, identical for "Youth" and "UPDATE"). Anything meant
 * to clear the wordmark vertically must subtract this, not just wordmarkY
 * itself -- the tagline previously sat only 9px above wordmarkY, which the
 * overshoot alone eats 17.66px of, so "UPDATE" (painted after, on top)
 * visually swallowed most of the tagline text.
 */
const WORDMARK_CAP_OVERSHOOT_TO_FONT_SIZE = 17.656 / 218;

/** Reference-px font size for the italic tagline -- shared with both render
 * paths (YouthUpdateMasthead.tsx, EditorCanvas.tsx) so the two can't drift
 * apart the way wordmarkY/taglineY did. */
export const YOUTH_UPDATE_TAGLINE_FONT_SIZE_REF_PX = 18;

/**
 * The tagline's own measured ink height (ascent+descent) at
 * YOUTH_UPDATE_TAGLINE_FONT_SIZE_REF_PX, same probe as above (its fixed
 * text -- "A Bilingual Daily News Paper" -- makes this a stable number, not
 * a guess): descent 17.734 minus ascent -0.734 = 18.47px of 18px font size.
 */
const TAGLINE_INK_HEIGHT_TO_FONT_SIZE = 18.47 / 18;

const naturalWordmarkMetrics = (pageWidth: number) => {
  const wordmarkY = scaleFromReference(pageWidth, 50);
  const wordmarkFontSize = scaleFromReference(pageWidth, 218);
  return { wordmarkY, wordmarkFontSize };
};

/**
 * The masthead's true height: wherever the info bar's own bottom edge lands,
 * plus a small clearance -- not a round number picked in advance. Computed
 * once at the reference page width and exported as a constant because
 * `getPageKindContentBounds` (editorStore.ts) needs a plain number to
 * reserve, not a function of a page it hasn't laid out yet.
 */
const naturalMastheadHeight = (pageWidth: number) => {
  return scaleFromReference(pageWidth, REFERENCE_MASTHEAD_HEIGHT_PX);
};

export const YOUTH_UPDATE_MASTHEAD_HEIGHT_PT = naturalMastheadHeight(REFERENCE_PAGE_WIDTH_PT);
export const YOUTH_UPDATE_MASTHEAD_HEIGHT_IN = YOUTH_UPDATE_MASTHEAD_HEIGHT_PT / POINTS_PER_INCH;

const COLORS = {
  // Same blue used for both the "Youth" half of the wordmark and the info
  // bar fill in the reference -- measured as rgb(31,135,234)/rgb(33,137,226).
  wordmarkDark: "#1f87ea",
  wordmarkLight: "#8bedee",
  dot: "#fc370c",
  tagline: "#333333",
  divider: "#1f87ea",
  teaserHeadline: "#1f87ea",
  teaserLabel: "#1a1a1a",
  infoBarFill: "#1f87ea",
  infoBarText: "#ffffff",
  // Body-page accent (right-edge/section dividers) -- not part of the
  // masthead itself, but kept in this one shared palette so every Youth
  // UPDATE-only colour lives in a single place.
  bodyDivider: "#1f87ea",
} as const;

export type YouthUpdateTeaserGeometry = {
  /** The cutout photo's box -- bottom-aligned, "contain"-fit inside it, no background fill. */
  photo: { x: number; y: number; width: number; height: number };
  headline: { x: number; y: number; width: number; height: number; text: string };
  label: { x: number; y: number; width: number; text: string };
  /** Image URL for this slot -- empty string means nothing uploaded yet. */
  imageUrl: string;
};

export type YouthUpdateDividerDots = {
  x: number;
  /** Y position of each dot's centre, top to bottom. */
  ys: number[];
  radius: number;
};

export type YouthUpdateInfoBarSegment = {
  x: number;
  width: number;
  align: "left" | "center" | "right";
  text: string;
};

export type YouthUpdateMastheadGeometry = {
  height: number;
  tagline: { x: number; y: number; text: string };
  wordmark: {
    y: number;
    fontSize: number;
    letterSpacing: number;
    youth: { x: number; text: string; color: string };
    update: { x: number; text: string; color: string };
  };
  dot: { x: number; y: number; radius: number };
  teaserRow: { y: number; height: number };
  teasers: YouthUpdateTeaserGeometry[];
  dividerDots: YouthUpdateDividerDots[];
  infoBar: { x: number; y: number; width: number; height: number; segments: YouthUpdateInfoBarSegment[] };
};

export type YouthUpdateMastheadInput = {
  pageWidth: number;
  /** Four short teaser headlines, left to right -- publisher-editable, daily. */
  teaserHeadlines: [string, string, string, string];
  teaserLabels: [string, string, string, string];
  /** Four cutout-photo URLs, left to right -- empty string = not uploaded yet. */
  teaserImageUrls: [string, string, string, string];
  volumeLabel: string;
  issueLabel: string;
  registrationNumber: string;
  city: string;
  dayName: string;
  dateLabel: string;
  pageCount: number;
  /** Just the numeric cover price (e.g. "2.00") -- the ₹ glyph is added here, once, so a pre-formatted "Rs. X" from the shared profile default never doubles up. */
  price: string;
};

export const getYouthUpdateMastheadGeometry = (input: YouthUpdateMastheadInput): YouthUpdateMastheadGeometry => {
  const { pageWidth } = input;
  const { wordmarkY, wordmarkFontSize } = naturalWordmarkMetrics(pageWidth);
  // Placed just above the wordmark's real ink top (accounting for Anton's
  // cap overshoot), not a fixed reference pixel -- see
  // WORDMARK_CAP_OVERSHOOT_TO_FONT_SIZE above for why a flat "41" silently
  // landed underneath "UPDATE" once the wordmark grew to its current size.
  const wordmarkInkTop = wordmarkY - wordmarkFontSize * WORDMARK_CAP_OVERSHOOT_TO_FONT_SIZE;
  const taglineFontSize = scaleFromReference(pageWidth, YOUTH_UPDATE_TAGLINE_FONT_SIZE_REF_PX);
  const taglineClearanceGap = scaleFromReference(pageWidth, 6);
  const taglineY = wordmarkInkTop - taglineClearanceGap - taglineFontSize * TAGLINE_INK_HEIGHT_TO_FONT_SIZE;

  const teaserRowY = scaleFromReference(pageWidth, 228);
  const teaserRowHeight = scaleFromReference(pageWidth, 202);

  const teaserCount = 4;

  const teasers: YouthUpdateTeaserGeometry[] = Array.from({ length: teaserCount }, (_, i) => {
    const reference = YOUTH_UPDATE_REFERENCE_TEASERS[i];
    const [photoX, photoY, photoWidth, photoHeight] = reference.photo;
    const [headlineX, headlineY, headlineWidth, headlineHeight] = reference.headline;
    const [labelX, labelY, labelWidth] = reference.label;

    return {
      photo: {
        x: scaleFromReference(pageWidth, photoX),
        y: scaleFromReference(pageWidth, photoY),
        width: scaleFromReference(pageWidth, photoWidth),
        height: scaleFromReference(pageWidth, photoHeight),
      },
      headline: {
        x: scaleFromReference(pageWidth, headlineX),
        y: scaleFromReference(pageWidth, headlineY),
        width: scaleFromReference(pageWidth, headlineWidth),
        height: scaleFromReference(pageWidth, headlineHeight),
        text: input.teaserHeadlines[i],
      },
      label: {
        x: scaleFromReference(pageWidth, labelX),
        y: scaleFromReference(pageWidth, labelY),
        width: scaleFromReference(pageWidth, labelWidth),
        text: input.teaserLabels[i],
      },
      imageUrl: input.teaserImageUrls[i] ?? "",
    };
  });

  // One dotted divider between each pair of teasers (3 for 4 slots), spanning
  // the text block's own height -- not the taller, variable-height photo.
  const dotSpacing = scaleFromReference(pageWidth, 8);
  const dotRadius = scaleFromReference(pageWidth, 1.6);
  const dividerDots: YouthUpdateDividerDots[] = YOUTH_UPDATE_REFERENCE_TEASERS.flatMap((reference) => {
    if (reference.dividerX === null) return [];
    const x = scaleFromReference(pageWidth, reference.dividerX);
    const yTop = scaleFromReference(pageWidth, 278);
    // Stops above the category labels instead of running to 419, which is
    // below where the labels start (408) -- the dotted rule printed through
    // "ENTERTAINMENT-P7" and friends. Teaser 1 also collides horizontally
    // (label 259..385 against a divider at 382), so clearing the band
    // vertically is what fixes every slot rather than only the wide ones.
    // Derived from the labels themselves so moving one moves the rule too.
    const labelBandTop = Math.min(...YOUTH_UPDATE_REFERENCE_TEASERS.map((t) => t.label[1]));
    const yBottom = scaleFromReference(pageWidth, labelBandTop - 6);
    const ys: number[] = [];
    for (let y = yTop; y <= yBottom; y += dotSpacing) {
      ys.push(y);
    }
    return { x, ys, radius: dotRadius };
  });

  const infoBarY = scaleFromReference(pageWidth, 431);
  const infoBarHeight = scaleFromReference(pageWidth, 38);

  const yearIssue = `YEAR- ${input.volumeLabel}, ISSUE-${input.issueLabel}`;
  const dateline = `${input.city.toUpperCase()}, ${input.dayName.toUpperCase()}, ${input.dateLabel}`;
  // Exactly one ₹ glyph, always. input.price is meant to be just the numeric
  // amount, but the shared profile default is the pre-formatted string
  // "Rs. 5" -- naively stripping non-digits would leave the "." from "Rs."
  // behind (producing ".5"), so this matches the actual number instead.
  const priceAmount = input.price.match(/\d+(\.\d+)?/)?.[0] || "2.00";
  const pagePrice = `${String(input.pageCount).padStart(2, "0")} PAGE, ₹ ${priceAmount}`;

  const infoBar = {
    x: 0,
    y: infoBarY,
    width: pageWidth,
    height: infoBarHeight,
    segments: [
      { x: scaleFromReference(pageWidth, 42), width: scaleFromReference(pageWidth, 260), align: "left" as const, text: yearIssue },
      { x: scaleFromReference(pageWidth, 354), width: scaleFromReference(pageWidth, 300), align: "left" as const, text: input.registrationNumber },
      { x: scaleFromReference(pageWidth, 662), width: scaleFromReference(pageWidth, 470), align: "left" as const, text: dateline },
      { x: scaleFromReference(pageWidth, 1392), width: scaleFromReference(pageWidth, 166), align: "right" as const, text: pagePrice },
    ],
  };

  // "Youth UPDATE" as one block, centred on the page -- the reference's own
  // wordmark sits almost exactly centred (measured: ~8% clear margin on
  // both sides), not left-anchored at a fixed inset. Extra per-letter
  // tracking (not just the word-gap) is what actually closes the gap
  // between our ~70%-wide default and the reference's ~84%.
  const letterSpacing = wordmarkFontSize * WORDMARK_LETTER_SPACING_TO_FONT_SIZE;
  const youthWidth = wordmarkFontSize * YOUTH_BASE_WIDTH_TO_FONT_SIZE + YOUTH_CHAR_COUNT * letterSpacing;
  const updateWidth = wordmarkFontSize * UPDATE_BASE_WIDTH_TO_FONT_SIZE + UPDATE_CHAR_COUNT * letterSpacing;
  const wordmarkGap = wordmarkFontSize * WORDMARK_GAP_TO_FONT_SIZE;
  const totalWordmarkWidth = youthWidth + wordmarkGap + updateWidth;
  const youthX = (pageWidth - totalWordmarkWidth) / 2;
  const updateX = youthX + youthWidth + wordmarkGap;
  // Where the "t" glyph itself starts and ends, tracking-aware: "You" (3
  // letters, 3 gaps including its own trailing one) is exactly where "t"
  // starts, but "t"'s own visual end has only the 3 gaps *inside* "Yout"
  // (Y-o, o-u, u-t) -- not a 4th trailing one, which would land the centre
  // point half a letter-gap into the "t"-"h" gap instead of on "t" itself
  // (confirmed against fillCanvasText's own per-character advance).
  const tGlyphStart = wordmarkFontSize * YOU_BASE_WIDTH_TO_FONT_SIZE + 3 * letterSpacing;
  const tGlyphEnd = wordmarkFontSize * YOUT_BASE_WIDTH_TO_FONT_SIZE + 3 * letterSpacing;

  return {
    height: scaleFromReference(pageWidth, REFERENCE_MASTHEAD_HEIGHT_PX),
    // Right-aligned to sit directly above "UPDATE", matching the reference --
    // dynamic off updateX + updateWidth rather than a fixed inset, so it
    // tracks the wordmark's own (now centred) position instead of drifting
    // away from it.
    tagline: { x: updateX + updateWidth, y: taglineY, text: "A Bilingual Daily News Paper" },
    wordmark: {
      y: wordmarkY,
      fontSize: wordmarkFontSize,
      letterSpacing,
      youth: { x: youthX, text: "Youth", color: COLORS.wordmarkDark },
      update: {
        x: updateX,
        text: "UPDATE",
        color: COLORS.wordmarkLight,
      },
    },
    // Floats above the wordmark, centred over the "t" in Youth (between
    // where "You" ends and "Yout" ends) -- in the reference it reads as a
    // stylised dotted-letter accent, not a separator between the two words.
    dot: {
      x: youthX + (tGlyphStart + tGlyphEnd) / 2,
      // Rests ON the "t" rather than covering it: the dot's lower edge is set
      // against the wordmark's real ink top (the same measured figure the
      // tagline clears against), then tucked a little way in so it reads as
      // touching the letter instead of hovering over a gap. This used to be a
      // flat scaled 64px nudged by eye, which sat below the cap line and
      // printed across the glyph.
      // Clamped so the disc's own top edge always stays inside the masthead:
      // resting it against the cap line alone pushed it past y=0 and the top
      // of the dot was clipped off. Where there is room the first term wins
      // and it sits on the "t" as intended; where there is not, it settles to
      // the lowest position that still prints whole.
      y: Math.max(
        wordmarkInkTop - scaleFromReference(pageWidth, 25.5) * 0.82,
        scaleFromReference(pageWidth, 25.5) + scaleFromReference(pageWidth, 4),
      ),
      radius: scaleFromReference(pageWidth, 25.5),
    },
    teaserRow: { y: teaserRowY, height: teaserRowHeight },
    teasers,
    dividerDots,
    infoBar,
  };
};

export const YOUTH_UPDATE_COLORS = COLORS;
