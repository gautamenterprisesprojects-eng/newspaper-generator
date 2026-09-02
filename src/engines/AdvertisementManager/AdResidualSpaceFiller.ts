/**
 * AdResidualSpaceFiller
 *
 * SPECIAL CONDITION ENGINE — Advertisement Insertion Only.
 *
 * When an advertisement occupies part of a page, the remaining editorial space
 * must be 100% filled with news article frames — zero blank white space.
 *
 * PROFESSIONAL NEWSPAPER LAYOUT — The editorial zones left after ad placement are
 * subdivided using a curated set of professional layout patterns inspired by real
 * newspaper design (Times of India, Dainik Bhaskar, The Hindu, etc.):
 *
 *  ✓ Skyline subtraction — detects ALL remaining rects, not just a top-band + bottom-left band.
 *  ✓ Asymmetric, varied-width column compositions — lead + sidebar, lead + two-col + brief, etc.
 *  ✓ Pattern selection based on available width ratio vs. total content width.
 *  ✓ Tall zones split into two distinct horizontal bands with different compositions per band.
 *  ✓ Fluid fallback for residual sub-pixel widths: last column absorbs remainder.
 *  ✓ isAdResidualSpace: true marker — this logic NEVER bleeds into regular layouts.
 *
 * Locked rules from AGENTS.md enforced here:
 *  • Internal text columns from physical cm (< 8 cm → 1 col, 8–14 cm → 2 cols, > 14 cm → 3 cols)
 *  • Min column width: 4 cm (~113 pt); Max: 8 cm (~227 pt)
 *  • Word-tier selection: 1.5× buffer → 250 | 500 | 1000 words
 */

// ─── Constants ─────────────────────────────────────────────────────────────────
const PT_PER_CM = 72 / 2.54;           // ≈ 28.3465 pt per cm
// Both floors matched to MIN_SUBDIV_COL_W below -- publisher feedback was
// that generated ad-adjacent boxes came out too narrow/short to read
// comfortably. Raising these means a residual zone smaller than either
// floor gets no article box at all rather than an undersized one (checked
// wherever a rect/slot is admitted: computeAdResidualRects's freeW/bandH
// test, applyPattern's colW/bandHeight test, and splitAdResidualRect's own
// MIN_ARTICLE_H checks) -- a bit of unfilled space beside the ad reads
// better than a sliver box no one can read.
const MIN_ARTICLE_H = 140;             // minimum article frame height (pt)
const MIN_ARTICLE_W = 160;             // minimum article frame width (pt)
const TALL_RECT_THRESHOLD = 380;       // split into bands above this height (pt)
const GUTTER = 14;                     // standard newspaper gutter (pt)
/**
 * Minimum column width when subdividing a rect into multiple articles.
 * Raised to 2 × standard column width (~160 pt) so no "brief" column
 * is ever generated for a narrow side-zone. Below this, the zone stays
 * as a single full-width article.
 */
const MIN_SUBDIV_COL_W = 160;          // pt — 2 standard columns minimum per subdivided slot

/**
 * Width-dependent height floor — Advertisement Page only, opt-in.
 *
 * MIN_ARTICLE_H is a flat floor, and that is the wrong shape of rule: what
 * makes a box unreadable is being NARROW, not being short. Page 3 of the
 * 07 Aug 2026 edition carries a Basavaraj Horatti box roughly 4 columns wide
 * and well under 140pt deep, and it reads perfectly well -- a wide, shallow,
 * image-less run of dense type is standard newspaper furniture, used exactly
 * to absorb the band left between an editorial block and an ad block.
 *
 * With a flat 140pt floor any such band is instead discarded and prints as
 * white space. These ramps let a band go shallower the wider it is, so the
 * leftover gets a real filler box rather than nothing. MIN_ARTICLE_W stays
 * hard at 160pt -- narrow boxes remain banned either way.
 *
 * Opt-in via AdResidualOptions because computeAdResidualRects is shared with
 * PageAdvertisementPlacement (front/inside/editorial ad embedding), which
 * must keep its existing behaviour untouched.
 */
/**
 * Floors start from "a headline plus two lines of body, and its padding" --
 * 24pt headline + 2 x 16.5pt leading + 16pt padding = 73pt for a width where
 * the headline fits on one line, +24pt more where it wraps to two.
 *
 * The 4+ column figure is then raised to 1.5in. At the bare 73pt a full-width
 * band comes out about 1.02in deep, and a strip that shallow running across
 * the top of the page reads as a mistake rather than as a filler -- reported
 * from a real page. 108pt is the shallowest that still looks deliberate.
 * Raising it does not cost white space: the arranger scores an unfillable
 * band as blank, so it now avoids leaving one in the first place.
 */
const WIDE_FILLER_FLOORS: ReadonlyArray<{ minWidth: number; minHeight: number }> = [
  { minWidth: 590, minHeight: 108 }, // 4–6 columns — 1.5in
  { minWidth: 440, minHeight: 116 }, // 3 columns
];

export type AdResidualOptions = {
  /**
   * Allow wide bands to fall below MIN_ARTICLE_H, per WIDE_FILLER_FLOORS.
   * Advertisement Page only. Omitted/false reproduces the previous behaviour
   * exactly.
   */
  wideShortFillers?: boolean;
};

/**
 * Width floor — Advertisement Page only, opt-in, same reasoning as the height
 * ramp above.
 *
 * MIN_ARTICLE_W is 160pt, described in MIN_SUBDIV_COL_W's comment as "2
 * standard columns". That arithmetic does not hold on this page master: a
 * standard column is 144.96pt, so 160pt is about 1.1 columns -- a number that
 * happens to sit just above one column and just below two. The practical
 * effect is that a single leftover column (145pt) is always ~15pt too narrow
 * to be filled, and prints blank down the whole page. A 3-column ad beside a
 * 2-column one leaves exactly that.
 *
 * One full column is not a "narrow box" by the page's own grid -- it is one of
 * the six columns, and the reference page carries exactly such a rail down its
 * left edge. So a zone one full column wide is admitted here, but only when it
 * is tall enough to read as a rail rather than a stub. Subdivision still uses
 * the hard MIN_SUBDIV_COL_W, so no pattern ever *splits* a zone this narrow.
 */
const FULL_COLUMN_W = 144;
const COLUMN_RAIL_MIN_H = 400;

function minArticleWidthFor(heightPt: number, options?: AdResidualOptions): number {
  if (!options?.wideShortFillers) return MIN_ARTICLE_W;
  return heightPt >= COLUMN_RAIL_MIN_H ? FULL_COLUMN_W : MIN_ARTICLE_W;
}

function minArticleHeightFor(widthPt: number, options?: AdResidualOptions): number {
  if (!options?.wideShortFillers) return MIN_ARTICLE_H;
  for (const floor of WIDE_FILLER_FLOORS) {
    if (widthPt >= floor.minWidth) return floor.minHeight;
  }
  return MIN_ARTICLE_H;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdResidualRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AdPlacedItem = {
  placedX: number;
  placedY: number;
  displayWidthPt: number;
  displayHeightPt: number;
  placed: boolean;
};

/**
 * A fluid slot produced by the professional layout composer.
 * Uses absolute pixel coordinates — the standard grid is respected wherever
 * possible and broken only when needed to eliminate blank space.
 */
export type AdResidualSlot = {
  x: number;
  y: number;
  width: number;
  height: number;
  columnStart: number;
  columnSpan: number;
  internalTextColumns: number;
  recommendedWordTier: 250 | 500 | 1000;
  /** True = this slot came from advertisement residual filling. */
  isAdResidualSpace: true;
};

// ─── Utility: internal text columns (AGENTS.md §3) ───────────────────────────

function internalTextCols(widthPt: number): number {
  const widthCm = widthPt / PT_PER_CM;
  let cols = 1;
  if (widthCm >= 8 && widthCm <= 14) cols = 2;
  else if (widthCm > 14) cols = 3;
  while (cols > 1 && widthCm / cols < 4.0) cols -= 1;
  while (cols < 4 && widthCm / cols > 8.0) cols += 1;
  return Math.min(Math.max(cols, 1), 4);
}

// ─── Utility: word-tier (AGENTS.md §1) ───────────────────────────────────────

function wordTier(estimatedCapacity: number): 250 | 500 | 1000 {
  const buffered = Math.max(100, Math.round(estimatedCapacity * 1.5));
  if (buffered <= 220) return 250;
  if (buffered <= 450) return 500;
  return 1000;
}

// ─── Utility: estimate word capacity ─────────────────────────────────────────

function estimateWordCapacity(widthPt: number, heightPt: number, itc: number): number {
  const paddingX = 36;
  const headlineH = 38;
  const vertPad = 16;
  const availW = Math.max(40, widthPt - paddingX);
  const availH = Math.max(20, heightPt - headlineH - vertPad);
  const leading = 16.5;
  const fontSize = 12;
  const colGap = 14;
  const colW = Math.max(20, (availW - (itc - 1) * colGap) / Math.max(1, itc));
  const linesPerCol = Math.floor(availH / leading);
  const totalLines = linesPerCol * itc;
  const wordsPerLine = colW / (fontSize * 2.7);
  return Math.max(25, Math.round(totalLines * wordsPerLine));
}

// ─── Professional Layout Pattern Engine ──────────────────────────────────────

/**
 * A "composition pattern" for a horizontal band.
 * Each pattern is an array of width-fractions that sum to 1.0.
 * Fractions are multiplied by the actual band width (minus gutters) to get pixel widths.
 *
 * Patterns are designed by professional newspaper layout rules:
 *  - Always asymmetric (no pure equal-split unless band is very narrow)
 *  - Lead article is always widest (≥ 40% of band width)
 *  - Secondary articles max at ~35% each
 *  - Briefs (narrow sidebars) are 15–25%
 */
type LayoutPattern = {
  /** Human-readable name for debugging */
  name: string;
  /** Width fractions for each article slot, must sum to 1.0 */
  fractions: number[];
  /** Minimum band width (pt) for this pattern to be applicable */
  minWidth: number;
  /** Maximum slots this pattern creates */
  maxSlots: number;
};

/**
 * The curated professional layout pattern library.
 * Patterns are sorted by descending slot count — wider patterns are tried first.
 */
const PROFESSIONAL_PATTERNS: LayoutPattern[] = [
  // ── Wide zones (full-page or nearly full-page width) ───────────────────────
  {
    name: "Lead-4/6 + Two-Briefs-1/6-1/6",
    fractions: [4 / 6, 1 / 6, 1 / 6],
    minWidth: 400,
    maxSlots: 3,
  },
  {
    name: "Lead-3/6 + Secondary-2/6 + Brief-1/6",
    fractions: [3 / 6, 2 / 6, 1 / 6],
    minWidth: 360,
    maxSlots: 3,
  },
  {
    name: "Lead-4/6 + Sidebar-2/6",
    fractions: [4 / 6, 2 / 6],
    minWidth: 300,
    maxSlots: 2,
  },
  {
    name: "Lead-3/5 + Secondary-2/5",
    fractions: [3 / 5, 2 / 5],
    minWidth: 260,
    maxSlots: 2,
  },
  // ── Mid-width zones (2–4 standard columns wide) ────────────────────────────
  {
    name: "Lead-2/3 + Brief-1/3",
    fractions: [2 / 3, 1 / 3],
    minWidth: 200,
    maxSlots: 2,
  },
  {
    name: "Lead-3/4 + Brief-1/4",
    fractions: [3 / 4, 1 / 4],
    minWidth: 220,
    maxSlots: 2,
  },
  // Deliberately no equal-split (50/50) pattern -- publisher feedback was
  // that box widths should always read as an asymmetric lead+secondary
  // composition, the way a real newspaper page is laid out, never a plain
  // even split. "Lead-2/3 + Brief-1/3" just above is this library's
  // closest-to-equal pattern, and it's still a real 67/33 asymmetry.
  // ── Narrow zones (1–2 standard columns wide) ───────────────────────────────
  {
    name: "Single full-width",
    fractions: [1.0],
    minWidth: 0,
    maxSlots: 1,
  },
];

/**
 * Selects the best professional layout pattern for a given band width.
 *
 * Selection criteria (in priority order):
 *  1. Band must be at least `minWidth` wide.
 *  2. Each resulting column must be ≥ MIN_ARTICLE_W.
 *  3. Prefer patterns with more slots (richer visual variety).
 *  4. If the band is very tall, allow more subdivisions.
 */
function selectPattern(bandWidth: number, _bandHeight: number): LayoutPattern {
  // For very narrow bands, always use single column
  if (bandWidth < MIN_SUBDIV_COL_W * 2) {
    return PROFESSIONAL_PATTERNS.find((p) => p.maxSlots === 1)!;
  }

  const isVeryWide = bandWidth > 500;

  for (const pattern of PROFESSIONAL_PATTERNS) {
    if (bandWidth < pattern.minWidth) continue;

    // Every resulting column must be ≥ MIN_SUBDIV_COL_W (not just MIN_ARTICLE_W)
    // This prevents narrow "brief" columns from being created beside ad zones.
    const totalGutters = (pattern.fractions.length - 1) * GUTTER;
    const netWidth = bandWidth - totalGutters;
    const allColumnsWideEnough = pattern.fractions.every(
      (frac) => frac * netWidth >= MIN_SUBDIV_COL_W,
    );

    if (!allColumnsWideEnough) continue;

    // For wide zones: prefer patterns with 3 slots for visual richness
    // For narrower zones: 2 slots is fine
    if (isVeryWide && pattern.maxSlots >= 3) return pattern;
    if (!isVeryWide && pattern.maxSlots <= 2) return pattern;

    return pattern; // fallback: take first valid
  }

  // Ultimate fallback: single column
  return PROFESSIONAL_PATTERNS.find((p) => p.maxSlots === 1)!;
}

/**
 * Applies a layout pattern to a band and returns the resulting article rects.
 * The last column absorbs any sub-pixel remainder so total width is exact.
 */
function applyPattern(
  pattern: LayoutPattern,
  bandX: number,
  bandY: number,
  bandWidth: number,
  bandHeight: number,
): AdResidualRect[] {
  const fractions = pattern.fractions;
  const totalGutters = (fractions.length - 1) * GUTTER;
  const netWidth = bandWidth - totalGutters;

  const results: AdResidualRect[] = [];
  let curX = bandX;

  for (let i = 0; i < fractions.length; i++) {
    const isLast = i === fractions.length - 1;
    // Last column: take remaining width to absorb floating-point remainder
    const colW = isLast
      ? bandX + bandWidth - curX
      : Math.floor(fractions[i]! * netWidth);

    if (colW >= MIN_ARTICLE_W && bandHeight >= MIN_ARTICLE_H) {
      results.push({ x: curX, y: bandY, width: colW, height: bandHeight });
    }
    curX += colW + GUTTER;
  }

  return results;
}

// ─── Core: Professional Rect Subdivider ──────────────────────────────────────

/**
 * `splitAdResidualRect`
 *
 * SPECIAL CONDITION — Advertisement Insertion Only.
 *
 * Subdivides a residual editorial rectangle into professional-looking article
 * slots using curated asymmetric layout patterns (lead + sidebar, lead + two
 * briefs, etc.), exactly as real newspapers like Times of India and Dainik
 * Bhaskar lay out their ad-adjacent editorial zones.
 *
 * Algorithm:
 *  1. If the rect is TALL, split into two horizontal bands at a 55/45 or 60/40
 *     ratio (not equal halves — top band is taller for the lead story).
 *  2. For each band, select the best professional pattern from the library.
 *  3. Apply the pattern to produce asymmetric column widths.
 *  4. The last column in each band absorbs any sub-pixel remainder.
 */
export function splitAdResidualRect(rect: AdResidualRect): AdResidualRect[] {
  if (rect.width < MIN_ARTICLE_W || rect.height < MIN_ARTICLE_H) return [];

  // ── Band splitting ────────────────────────────────────────────────────────
  const bands: Array<{ y: number; height: number; isBand: "top" | "bottom" | "single" }> = [];

  if (rect.height >= TALL_RECT_THRESHOLD) {
    // Professional split: top band is 55% height (lead story zone),
    // bottom band is 45% (secondary story zone). NOT equal halves.
    const topH = Math.round(rect.height * 0.55) - Math.round(GUTTER / 2);
    const botH = rect.height - GUTTER - topH;

    if (topH >= MIN_ARTICLE_H) bands.push({ y: rect.y, height: topH, isBand: "top" });
    if (botH >= MIN_ARTICLE_H) bands.push({ y: rect.y + topH + GUTTER, height: botH, isBand: "bottom" });
  } else {
    bands.push({ y: rect.y, height: rect.height, isBand: "single" });
  }

  // ── Pattern selection and application ─────────────────────────────────────
  const results: AdResidualRect[] = [];

  for (const band of bands) {
    const pattern = selectPattern(rect.width, band.height);
    const bandRects = applyPattern(pattern, rect.x, band.y, rect.width, band.height);
    results.push(...bandRects);
  }

  return results;
}

// ─── Core: Skyline Residual Rectangle Detection ───────────────────────────────

/**
 * `computeAdResidualRects`
 *
 * Computes every non-advertisement rectangular region remaining on the page
 * after ads have been placed, using a horizontal-slice skyline approach.
 *
 * This correctly captures:
 *  • Space above all ads
 *  • Space to the left, right, and between multiple ads
 *  • Narrow pockets beside tall ads
 *
 * All returned rects are guaranteed to be ≥ MIN_ARTICLE_W × MIN_ARTICLE_H.
 */
export function computeAdResidualRects(
  placedAds: AdPlacedItem[],
  contentX: number,
  contentY: number,
  contentW: number,
  contentH: number,
  options?: AdResidualOptions,
): AdResidualRect[] {
  const contentRight = contentX + contentW;
  const contentBottom = contentY + contentH;

  const activePlaced = placedAds.filter((ad) => ad.placed);

  if (activePlaced.length === 0) {
    return [{ x: contentX, y: contentY, width: contentW, height: contentH }];
  }

  // Collect all unique Y breakpoints from ad edges and page boundaries
  const yBreaks = new Set<number>();
  yBreaks.add(contentY);
  yBreaks.add(contentBottom);

  for (const ad of activePlaced) {
    // Snap Y edges to integer pixels outward — floor top edge, ceil bottom edge
    const adTop = Math.floor(ad.placedY);
    const adBottom = Math.ceil(ad.placedY + ad.displayHeightPt);
    if (adTop > contentY && adTop < contentBottom) yBreaks.add(adTop);
    if (adBottom > contentY && adBottom < contentBottom) yBreaks.add(adBottom);
  }

  // Integer-snap Y breakpoints to prevent sub-pixel band boundaries creating hair-thin gaps
  const sortedY = [...yBreaks]
    .map(Math.round)
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => a - b);
  const rawRects: AdResidualRect[] = [];

  for (let yi = 0; yi < sortedY.length - 1; yi++) {
    const bandTop = sortedY[yi]!;
    const bandBottom = sortedY[yi + 1]!;
    const bandH = bandBottom - bandTop;
    if (bandH < 1) continue;

    const adsInBand = activePlaced.filter(
      (ad) => ad.placedY < bandBottom && ad.placedY + ad.displayHeightPt > bandTop,
    );

    // Integer-snap blocked intervals outward (floor left edge, ceil right edge)
    // so float rounding can never leave a sub-pixel gap at an ad boundary.
    const blocked: Array<[number, number]> = adsInBand
      .map((ad) => [
        Math.floor(Math.max(contentX, ad.placedX)),
        Math.ceil(Math.min(contentRight, ad.placedX + ad.displayWidthPt)),
      ] as [number, number])
      .filter(([l, r]) => l < r);

    blocked.sort((a, b) => a[0] - b[0]);
    const mergedBlocked: Array<[number, number]> = [];
    for (const interval of blocked) {
      if (mergedBlocked.length === 0) {
        mergedBlocked.push([...interval]);
      } else {
        const last = mergedBlocked[mergedBlocked.length - 1]!;
        if (interval[0] <= last[1]) {
          last[1] = Math.max(last[1], interval[1]);
        } else {
          mergedBlocked.push([...interval]);
        }
      }
    }

    const freeIntervals: Array<[number, number]> = [];
    let cursor = contentX;
    for (const [bl, br] of mergedBlocked) {
      if (cursor < bl) freeIntervals.push([cursor, bl]);
      cursor = Math.max(cursor, br);
    }
    if (cursor < contentRight) freeIntervals.push([cursor, contentRight]);

    for (const [fl, fr] of freeIntervals) {
      const freeW = fr - fl;
      if (options?.wideShortFillers) {
        // Admit the slice on width alone and let mergeVerticalRects join the
        // slices into a full-height column before anything is judged on size.
        //
        // Bands are cut at every ad edge, so a tall zone beside a stack of ads
        // arrives here as a run of short slices. Applying the height floor per
        // slice threw the whole column away one 108pt slice at a time -- the
        // merge step never saw it. Measured on the reference page's own ad
        // shape, that alone was 13% of the page left blank down the left
        // margin. The real floors are applied once, after merging, at the
        // bottom of mergeVerticalRects.
        if (freeW >= FULL_COLUMN_W) {
          rawRects.push({ x: fl, y: bandTop, width: freeW, height: bandH });
        }
      } else if (freeW >= MIN_ARTICLE_W && bandH >= MIN_ARTICLE_H) {
        rawRects.push({ x: fl, y: bandTop, width: freeW, height: bandH });
      }
    }
  }

  return mergeVerticalRects(rawRects, options);
}

/**
 * Merges vertically adjacent rects sharing the same x and width.
 * Collapses thin stacked bands into tall, clean editorial zones.
 */
function mergeVerticalRects(
  rects: AdResidualRect[],
  options?: AdResidualOptions,
): AdResidualRect[] {
  if (rects.length === 0) return [];

  const groups = new Map<string, AdResidualRect[]>();
  for (const r of rects) {
    const key = `${Math.round(r.x)}_${Math.round(r.width)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const merged: AdResidualRect[] = [];

  for (const group of groups.values()) {
    group.sort((a, b) => a.y - b.y);
    let current: AdResidualRect = { ...group[0]! };

    for (let i = 1; i < group.length; i++) {
      const next = group[i]!;
      const currentBottom = current.y + current.height;
      if (Math.abs(next.y - currentBottom) <= 2) {
        current = { ...current, height: next.y + next.height - current.y };
      } else {
        if (
          current.width >= minArticleWidthFor(current.height, options) &&
          current.height >= minArticleHeightFor(current.width, options)
        ) {
          merged.push(current);
        }
        current = { ...next };
      }
    }

    if (
      current.width >= minArticleWidthFor(current.height, options) &&
      current.height >= minArticleHeightFor(current.width, options)
    ) {
      merged.push(current);
    }
  }

  merged.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));
  return merged;
}

/**
 * Cuts `rect` into exactly `count` tiles that cover it completely.
 *
 * Advertisement Page only. Unlike the pattern library this never leaves part
 * of a zone uncovered and never returns a different number of tiles than was
 * asked for (short of the zone being too small to cut further), which is what
 * the article count needs: N articles, N boxes, no blank remainder.
 *
 * Cuts across the long axis first so boxes stay near newspaper proportions,
 * and biases an even split 55/45 rather than in half, the way a page splits a
 * lead story from its follow.
 */
function guillotineSplit(
  rect: AdResidualRect,
  count: number,
  options?: AdResidualOptions,
): AdResidualRect[] {
  if (count <= 1) return [rect];

  const headCount = Math.ceil(count / 2);
  const tailCount = count - headCount;
  const minH = minArticleHeightFor(rect.width, options);
  const minW = MIN_SUBDIV_COL_W;

  const canCutHorizontally = rect.height >= minH * 2 + GUTTER;
  const canCutVertically = rect.width >= minW * 2 + GUTTER;
  const preferHorizontal = rect.height >= rect.width;

  const cutHorizontally = canCutHorizontally && (preferHorizontal || !canCutVertically);
  const cutVertically = !cutHorizontally && canCutVertically;

  if (!cutHorizontally && !cutVertically) return [rect];

  const bias = headCount === tailCount ? 0.55 : headCount / count;

  if (cutHorizontally) {
    const usable = rect.height - GUTTER;
    let headH = Math.round(usable * bias);
    headH = Math.min(Math.max(headH, minH), usable - minH);
    const head = { x: rect.x, y: rect.y, width: rect.width, height: headH };
    const tail = {
      x: rect.x,
      y: rect.y + headH + GUTTER,
      width: rect.width,
      height: rect.height - headH - GUTTER,
    };
    return [
      ...guillotineSplit(head, headCount, options),
      ...guillotineSplit(tail, tailCount, options),
    ];
  }

  const usable = rect.width - GUTTER;
  let headW = Math.round(usable * bias);
  headW = Math.min(Math.max(headW, minW), usable - minW);
  const head = { x: rect.x, y: rect.y, width: headW, height: rect.height };
  const tail = {
    x: rect.x + headW + GUTTER,
    y: rect.y,
    width: rect.width - headW - GUTTER,
    height: rect.height,
  };
  return [
    ...guillotineSplit(head, headCount, options),
    ...guillotineSplit(tail, tailCount, options),
  ];
}

// ─── Core: Professional Slot Builder ─────────────────────────────────────────

/**
 * `buildAdResidualSlots`
 *
 * SPECIAL CONDITION — Advertisement Insertion Only.
 *
 * Converts residual rects into professional article slots using a two-pass
 * strategy that prevents over-subdivision (the main cause of narrow article
 * boxes and unfilled blank space when article count is limited).
 *
 * ## Two-Pass Strategy
 *
 * **Pass 1 — One Slot Per Zone (Priority Fill):**
 * Assigns exactly ONE large article slot per residual rect, ordered by
 * descending area. This guarantees that with N articles, the N largest
 * editorial zones are always filled first — no zone is left blank because
 * smaller subdivided slots consumed the article quota.
 *
 * **Pass 2 — Subdivision (Only if capacity remains):**
 * If `maxSlots` exceeds the number of residual zones, the widest remaining
 * zones are subdivided using the professional pattern library. Subdivision
 * only activates when there are more articles than zones — never creating
 * narrow columns just to "use up" patterns.
 *
 * ## Column Width Guard
 * `selectPattern` enforces `MIN_SUBDIV_COL_W = 160pt` (~2 standard columns).
 * No "brief" column narrower than this is ever created.
 *
 * @param remainingRects   Residual zones from `computeAdResidualRects`.
 * @param contentX         Left edge of the printable content area (pt).
 * @param standardColW     Standard column width (pt) — for columnStart/Span mapping.
 * @param standardGutter   Standard gutter (pt) — for columnStart/Span mapping.
 * @param maxSlots         Maximum number of article slots to produce.
 *                         Default: Infinity (no limit — produce all possible slots).
 *                         Pass `manualArticleCount` from the panel to prevent
 *                         over-subdivision.
 */
export function buildAdResidualSlots(
  remainingRects: AdResidualRect[],
  contentX: number,
  standardColW: number,
  standardGutter: number,
  maxSlots = Infinity,
  options?: AdResidualOptions,
): AdResidualSlot[] {
  if (remainingRects.length === 0) return [];
  const exactFill = options?.wideShortFillers === true;

  // ── Helper: build one annotated slot from a raw rect ─────────────────────
  const makeSlot = (sub: AdResidualRect): AdResidualSlot => {
    const rawColStart = Math.round((sub.x - contentX) / (standardColW + standardGutter)) + 1;
    const rawColSpan = Math.round((sub.width + standardGutter) / (standardColW + standardGutter));
    const columnStart = Math.max(1, rawColStart);
    const columnSpan = Math.max(1, rawColSpan);
    const itc = internalTextCols(sub.width);
    const capacity = estimateWordCapacity(sub.width, sub.height, itc);
    const tier = wordTier(capacity);
    return {
      x: sub.x,
      y: sub.y,
      width: sub.width,
      height: sub.height,
      columnStart,
      columnSpan,
      internalTextColumns: itc,
      recommendedWordTier: tier,
      isAdResidualSpace: true,
    };
  };

  // ── Pass 0: fold zones down to the article budget ────────────────────────
  // With more zones than articles, Pass 1 used to hand slots to the biggest
  // zones and simply leave the rest with nothing -- and a zone with no article
  // is a blank hole on the printed page. Merging first means every zone still
  // gets an article; the publisher's article count is respected by making the
  // zones bigger, not by abandoning one of them.
  //
  // Only unions that are themselves rectangles are merged (same x+width and
  // vertically adjacent, or same y+height and horizontally adjacent), so a
  // merged zone is still a single well-formed article box.
  const foldZonesToBudget = (rects: AdResidualRect[]): AdResidualRect[] => {
    if (!exactFill || !Number.isFinite(maxSlots)) return rects;
    const working = rects.map((r) => ({ ...r }));
    // Strict adjacency only. It is tempting to treat a gutter-sized gap as
    // adjacent too, but two residual zones are separated precisely BECAUSE an
    // ad sits between them -- that is what split them in the first place -- so
    // a zone merged across the gap would print on top of the ad. Gaps that are
    // merely rejected bands are already reclaimed earlier, by admitting bands
    // on width alone and merging before anything is judged on size.
    const near = (a: number, b: number) => Math.abs(a - b) <= 2;

    while (working.length > maxSlots) {
      let bestI = -1;
      let bestJ = -1;
      let bestArea = Number.POSITIVE_INFINITY;

      for (let i = 0; i < working.length; i++) {
        for (let j = i + 1; j < working.length; j++) {
          const a = working[i]!;
          const b = working[j]!;
          const stackable =
            near(a.x, b.x) &&
            near(a.width, b.width) &&
            (near(a.y + a.height, b.y) || near(b.y + b.height, a.y));
          const abuttable =
            near(a.y, b.y) &&
            near(a.height, b.height) &&
            (near(a.x + a.width, b.x) || near(b.x + b.width, a.x));
          if (!stackable && !abuttable) continue;
          // Merge the smallest pair first, so the page keeps as much of its
          // zone structure as the budget allows.
          const area = a.width * a.height + b.width * b.height;
          if (area < bestArea) {
            bestArea = area;
            bestI = i;
            bestJ = j;
          }
        }
      }

      if (bestI < 0) break; // nothing left that merges into a rectangle
      const a = working[bestI]!;
      const b = working[bestJ]!;
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      working.splice(bestJ, 1);
      working.splice(bestI, 1);
      working.push({
        x,
        y,
        width: Math.max(a.x + a.width, b.x + b.width) - x,
        height: Math.max(a.y + a.height, b.y + b.height) - y,
      });
    }

    return working;
  };

  const budgetedRects = foldZonesToBudget(remainingRects);

  // ── Pass 1: One full-zone slot per residual rect ──────────────────────────
  // Sort largest area first so the biggest zones get articles first.
  const sortedRects = [...budgetedRects].sort(
    (a, b) => b.width * b.height - a.width * a.height,
  );

  const slots: AdResidualSlot[] = [];
  const subdividableRects: AdResidualRect[] = [];

  for (const rect of sortedRects) {
    // Every zone gets a slot, even past the budget. Folding above has already
    // taken the count as low as the geometry allows; going over by one beats
    // printing a blank hole, which is the thing publishers actually report.
    if (!exactFill && slots.length >= maxSlots) break;
    slots.push(makeSlot(rect));
    // Remember this rect as a candidate for Pass 2 subdivision
    subdividableRects.push(rect);
  }

  // ── Pass 2 (Advertisement Page): split zones to hit the article count ────
  // The publisher asked for N articles and every zone must end up covered, so
  // the budget is spread across the zones by area and each zone is cut into
  // exactly its share by a guillotine split that tiles the zone completely.
  // The generic Pass 2 below cannot do this: its pattern library either fits
  // the budget or is skipped, so a 4-article page came back with 2 boxes.
  if (exactFill && Number.isFinite(maxSlots) && slots.length < maxSlots) {
    const zones = [...subdividableRects];
    const totalArea = zones.reduce((sum, z) => sum + z.width * z.height, 0);
    let remaining = maxSlots - zones.length;

    // Largest zone first, so the extra articles land where there is room.
    const order = zones
      .map((zone, index) => ({ zone, index }))
      .sort((a, b) => b.zone.width * b.zone.height - a.zone.width * a.zone.height);

    const shares = new Map<number, number>();
    for (const { zone, index } of order) {
      if (remaining <= 0) break;
      const share = Math.min(remaining, Math.round((zone.width * zone.height / totalArea) * (maxSlots - zones.length)));
      shares.set(index, share);
      remaining -= share;
    }
    // Anything left over from rounding goes to the biggest zone.
    if (remaining > 0 && order.length > 0) {
      const first = order[0]!.index;
      shares.set(first, (shares.get(first) ?? 0) + remaining);
    }

    const built: AdResidualSlot[] = [];
    zones.forEach((zone, index) => {
      const parts = guillotineSplit(zone, 1 + (shares.get(index) ?? 0), options);
      for (const part of parts) built.push(makeSlot(part));
    });
    return built;
  }

  // ── Pass 2: Subdivide widest zones if capacity remains ───────────────────
  // Only activates if user has more articles than there are residual zones.
  if (slots.length < maxSlots) {
    // Sort by width descending — widest zones benefit most from subdivision
    const byWidth = [...subdividableRects].sort((a, b) => b.width - a.width);

    for (const rect of byWidth) {
      if (slots.length >= maxSlots) break;

      // splitAdResidualRect applies band-splitting + professional column patterns
      const subRects = splitAdResidualRect(rect);

      // Only use the subdivision if it produces MORE slots than the single-zone
      // slot already assigned in Pass 1, and each sub-column is wide enough
      if (subRects.length <= 1) continue;

      // Remove the single-zone slot for this rect and replace with subdivisions
      const existingIdx = slots.findIndex(
        (s) => s.x === rect.x && s.y === rect.y && s.width === rect.width,
      );
      if (existingIdx === -1) continue;

      // Check all sub-columns are wide enough before committing to subdivision
      const allWideEnough = subRects.every((sub) => sub.width >= MIN_SUBDIV_COL_W);
      if (!allWideEnough) continue;

      // All of the subdivision, or none of it. Taking only the first few
      // sub-rects left the rest of the zone covered by nothing at all -- the
      // single-zone slot it replaced was already gone. Measured: two zones
      // against a 4-article budget lost a 296x253pt block out of the middle
      // of the page, 7.4% of the sheet, printing as one big white hole.
      const extraSlots = subRects.length - 1; // net new slots from subdivision
      if (slots.length + extraSlots > maxSlots) {
        // Partial subdivision: take only as many sub-slots as budget allows.
        //
        // This leaves the rest of the zone covered by nothing -- the
        // single-zone slot it replaces has already been removed -- and prints
        // as a blank hole. The Advertisement Page never reaches this branch
        // any more (its own exact-count pass runs earlier and tiles the zone
        // completely), but PageAdvertisementPlacement still does, so the
        // behaviour is left exactly as it was rather than changed underneath
        // front/inside/editorial pages. Worth fixing there separately.
        const budget = maxSlots - slots.length + 1;
        slots.splice(existingIdx, 1, ...subRects.slice(0, budget).map(makeSlot));
      } else {
        slots.splice(existingIdx, 1, ...subRects.map(makeSlot));
      }
    }
  }

  return slots;
}
