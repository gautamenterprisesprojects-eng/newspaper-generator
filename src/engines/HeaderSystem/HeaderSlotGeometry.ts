/**
 * HeaderSlotGeometry
 *
 * Where the day/date/issue/price overlay sits on top of the header banner
 * image (publisher-uploaded or the built-in default), and the mask bands
 * painted first to cover whatever the underlying artwork already has printed
 * in those same zones.
 *
 * Pure functions of the header box's own width/height only — never of page
 * content or which publisher is active — so every publisher gets the same
 * fixed layout (per product decision: every publisher's header art already
 * follows this same date-block-top-left / accent-bar-bottom-left layout).
 * The mask *colour* is the one thing that does vary per publisher — callers
 * pass in colours sampled from that publisher's own image (see
 * sampleImageColorsAt in @/lib/sampleImageColors) and these functions fall
 * back to the Cliff News reference colours only when none are supplied.
 *
 * The masthead name itself is deliberately not part of this geometry: it is
 * baked into the banner artwork (that's what a publisher uploads their own
 * header image for), and drawing text over it would blank out their actual
 * nameplate. Only the fields that change per issue are covered: front page
 * gets city, day+date, a Year-N/issue block, and price; inside pages get
 * only day+date.
 */

export type HeaderOverlayTextSlot = {
  x: number;
  y: number;
  width: number;
  height: number;
  align: "left" | "center" | "right";
};

export type HeaderMaskBand = {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
};

export type FrontHeaderOverlayGeometry = {
  maskBands: HeaderMaskBand[];
  eyebrowLeft: HeaderOverlayTextSlot;
  eyebrowRight: HeaderOverlayTextSlot;
  // The day-of-month's own big number, separate from the month/year line
  // below it — the reference PSD (front header.psd) draws these as two
  // distinct text layers, not one combined date string.
  dateNumber: HeaderOverlayTextSlot;
  monthYear: HeaderOverlayTextSlot;
  yearBlock: HeaderOverlayTextSlot;
  volumeBlock: HeaderOverlayTextSlot;
};

export type InsideHeaderOverlayGeometry = {
  maskBands: HeaderMaskBand[];
  dateline: HeaderOverlayTextSlot;
};

type MaskBandFraction = { x: number; y: number; width: number; height: number };

// Sampled directly from the reference artwork (/header front.jpg, /header
// paper.jpg) — the fallback used only when a publisher's own image couldn't
// be sampled (broken upload, cross-origin fetch without CORS, etc).
const MASK_WHITE = "#fcfeff";
const MASK_RED = "#e10c15";

// Fractions of the header box (0-1). Shared between the mask-band geometry
// below and getHeaderMaskSamplePoints, so "where we mask" and "where we
// sample the publisher's own colour from" can never drift apart.
//
// Derived directly from /front header.psd's own layer bounds (canvas
// 3900x768px), not eyeballed — see FRONT_TEXT_SLOTS below for how. Each mask
// band is sized to just cover its cluster of text layers plus a small
// margin, not the wider guessed rectangles used before, so page/price
// artwork sitting just past the Year/Volume cluster on the same bar is left
// alone rather than being blanked out along with it.
const FRONT_MASK_BAND_FRACTIONS: MaskBandFraction[] = [
  // Top-left date block: city + day + date-number + month/year.
  { x: 0, y: 0, width: 0.14, height: 0.73 },
  // Bottom-left Year + Volume cluster only — not the full bar, so the
  // page/price artwork further along the same red bar stays untouched.
  { x: 0, y: 0.79, width: 0.13, height: 0.1 },
];
const FRONT_MASK_DEFAULT_FILLS = [MASK_WHITE, MASK_RED];

const INSIDE_MASK_BAND_FRACTIONS: MaskBandFraction[] = [
  // The confirmed-clear gap between the masthead nameplate and the page
  // number box on the reference art's thin folio strip.
  { x: 0.685, y: 0, width: 0.255, height: 1 },
];
const INSIDE_MASK_DEFAULT_FILLS = [MASK_WHITE];

const buildMaskBands = (
  fractions: MaskBandFraction[],
  defaultFills: string[],
  pageWidth: number,
  headerHeight: number,
  maskColors?: string[],
): HeaderMaskBand[] =>
  fractions.map((band, index) => ({
    x: pageWidth * band.x,
    y: headerHeight * band.y,
    width: pageWidth * band.width,
    height: headerHeight * band.height,
    fill: maskColors?.[index] || defaultFills[index],
  }));

/** Normalised (0-1) sample point for each mask band's centre, in image-pixel-fraction space — the banner image is always stretched to exactly fill the header box, so a fraction of the box is the same fraction of the image. */
export const getHeaderMaskSamplePoints = (kind: "front" | "inside"): { x: number; y: number }[] =>
  (kind === "front" ? FRONT_MASK_BAND_FRACTIONS : INSIDE_MASK_BAND_FRACTIONS).map((band) => ({
    x: band.x + band.width / 2,
    y: band.y + band.height / 2,
  }));

/**
 * Every fraction below is `layer.bounds / canvasSize` read directly out of
 * /public/front header.psd (canvas 3900x768px) with a PSD-parsing library,
 * not eyeballed — the same "banner image always fills the header box, so a
 * fraction of the box is a fraction of the image" assumption the mask bands
 * already relied on. Layer names in the PSD, for anyone re-deriving these:
 *   place              -> eyebrowLeft (city)
 *   day                -> eyebrowRight
 *   date               -> dateNumber (just the day-of-month digits)
 *   "month and year "  -> monthYear
 *   "publishing Year"  -> yearBlock
 *   Volume             -> volumeBlock
 */
export const getFrontHeaderOverlayGeometry = (
  pageWidth: number,
  headerHeight: number,
  maskColors?: string[],
): FrontHeaderOverlayGeometry => ({
  maskBands: buildMaskBands(FRONT_MASK_BAND_FRACTIONS, FRONT_MASK_DEFAULT_FILLS, pageWidth, headerHeight, maskColors),
  eyebrowLeft: { x: pageWidth * 0.0387, y: headerHeight * 0.0898, width: pageWidth * 0.0736, height: headerHeight * 0.0716, align: "left" },
  eyebrowRight: { x: pageWidth * 0.0364, y: headerHeight * 0.2604, width: pageWidth * 0.0802, height: headerHeight * 0.0716, align: "left" },
  dateNumber: { x: pageWidth * 0.0569, y: headerHeight * 0.4557, width: pageWidth * 0.0187, height: headerHeight * 0.0703, align: "center" },
  monthYear: { x: pageWidth * 0.0246, y: headerHeight * 0.6146, width: pageWidth * 0.1069, height: headerHeight * 0.0885, align: "left" },
  yearBlock: { x: pageWidth * 0.01256, y: headerHeight * 0.8073, width: pageWidth * 0.0349, height: headerHeight * 0.0391, align: "left" },
  volumeBlock: { x: pageWidth * 0.0521, y: headerHeight * 0.8073, width: pageWidth * 0.0523, height: headerHeight * 0.0391, align: "left" },
});

export const getInsideHeaderOverlayGeometry = (
  pageWidth: number,
  headerHeight: number,
  maskColors?: string[],
): InsideHeaderOverlayGeometry => ({
  maskBands: buildMaskBands(INSIDE_MASK_BAND_FRACTIONS, INSIDE_MASK_DEFAULT_FILLS, pageWidth, headerHeight, maskColors),
  dateline: { x: pageWidth * 0.695, y: headerHeight * 0.28, width: pageWidth * 0.235, height: headerHeight * 0.44, align: "right" },
});
