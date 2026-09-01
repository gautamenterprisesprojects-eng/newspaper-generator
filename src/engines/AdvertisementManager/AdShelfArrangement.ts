/**
 * `AdShelfArrangement` — advertisement placement for the dedicated
 * Advertisement Page only.
 *
 * SPECIAL CONDITION — Advertisement Page tab. Nothing else imports this
 * module; front/inside/editorial ad embedding still goes through
 * PageAdvertisementPlacement and is deliberately untouched.
 *
 * ## Why stacks and not rows
 *
 * The previous arrangement packed ads into flat bottom-aligned rows: fill a
 * row right-to-left, then wrap upward. With ads of differing heights that
 * necessarily leaves a ragged top edge -- the height difference becomes an
 * empty strip directly above the shorter ad, and when that strip falls under
 * the residual engine's minimum article size it is dropped and prints white.
 *
 * Real newspaper pages solve this by stacking, not rowing. On page 3 of the
 * 07 Aug 2026 edition the right-hand edge carries three tender notices of
 * completely different depths in a single column: because they share a width
 * and sit on top of each other their heights simply sum, so no gap can exist.
 * Where that page does place ads side by side (the bottom band) it stacks two
 * shorter notices to match the height of the tall one beside them.
 *
 * ## Why a search rather than one greedy pass
 *
 * Packing ads as wide as they will go is not the same as leaving fillable
 * space. A 3-column ad beside a 2-column ad uses 743 of 900pt and leaves a
 * 157pt strip down the left margin -- and 157pt is narrower than the residual
 * engine's MIN_ARTICLE_W of 160pt, so no article box can ever claim it and it
 * prints blank for the full height of the page. One leftover column (145pt)
 * is always in that dead zone. Stacking those two ads instead leaves a full
 * 604pt of fillable width.
 *
 * There is no way to know which is better from the ad sizes alone, so this
 * module builds every sensible arrangement (one per stack count) and scores
 * each with the real residual engine -- blank area is exactly the content
 * area minus the ads minus the zones the article engine will actually fill.
 * The lowest-blank arrangement wins. Ads are never scaled or stretched to
 * make it fit, with the single pre-existing exception noted at
 * ROW_GAP_SNAP_THRESHOLD.
 */

import { computeAdResidualRects } from "./AdResidualSpaceFiller";

export type ShelfAdInput = {
  id: string;
  widthPt: number;
  heightPt: number;
  locked: boolean;
};

export type ShelfPlacement = {
  id: string;
  x: number;
  y: number;
  widthPt: number;
  heightPt: number;
};

export type ShelfArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Ads in a shelf rarely sum to exactly the content width. A remainder
 * narrower than the residual engine's own minimum article width can never be
 * claimed by an article box, so it would just sit at the page's left margin
 * as dead white. Below this threshold the leftmost stack is widened to close
 * it; a snap this small reads as sizing the banner to the column.
 *
 * Carried over unchanged from the previous row-based arrangement, including
 * its width-only growth. Wider remainders are handled by choosing a different
 * stack count instead, which costs no distortion at all.
 */
const ROW_GAP_SNAP_THRESHOLD = 40;

/** Ads must touch: no gutter between stacks, or between ads within a stack. */
const GUTTER = 0;

type AdStack = {
  widthPt: number;
  ads: ShelfAdInput[];
  height: number;
};

const stackHeight = (stack: AdStack): number =>
  stack.ads.reduce((sum, ad) => sum + ad.heightPt, 0) + GUTTER * Math.max(0, stack.ads.length - 1);

/**
 * Greedy assignment into at most `maxStacks` side-by-side stacks.
 *
 * Tallest first (longest-processing-time first): the big ads claim their own
 * stack while width and the stack budget allow, and the short ones fill in on
 * top afterwards, which is what keeps stack heights close together.
 */
function buildStacks(free: ShelfAdInput[], area: ShelfArea, maxStacks: number): AdStack[] | null {
  const stacks: AdStack[] = [];
  const usedWidth = () => stacks.reduce((sum, s) => sum + s.widthPt, 0);

  for (const ad of free) {
    const canOpen = stacks.length < maxStacks && usedWidth() + ad.widthPt <= area.width + 0.5;
    if (canOpen) {
      stacks.push({ widthPt: ad.widthPt, ads: [ad], height: ad.heightPt });
      continue;
    }

    // Prefer a stack of the same width (a flush column, like the reference
    // page's right edge); fall back to any stack at least as wide.
    const sameWidth = stacks.filter((s) => Math.abs(s.widthPt - ad.widthPt) <= 1);
    const wideEnough = stacks.filter((s) => s.widthPt >= ad.widthPt - 1);
    let pool = sameWidth.length > 0 ? sameWidth : wideEnough;

    if (pool.length === 0) {
      // Every stack is narrower than this ad. It cannot simply be dropped into
      // one -- it would hang out past the stack's edge and overlap whatever is
      // beside it. Widen a stack to take it, but only if the page still has
      // the width to spare; otherwise this candidate is unbuildable.
      const growable = stacks
        .filter((s) => usedWidth() - s.widthPt + ad.widthPt <= area.width + 0.5)
        .sort((a, b) => a.height - b.height);
      const host = growable[0];
      if (!host) return null;
      host.widthPt = ad.widthPt;
      pool = [host];
    }

    // Among the candidates, the shortest one that still fits the page height.
    const fitting = pool.filter((s) => s.height + GUTTER + ad.heightPt <= area.height);
    const target = (fitting.length > 0 ? fitting : pool).reduce((a, b) =>
      a.height <= b.height ? a : b,
    );
    target.ads.push(ad);
    target.height = stackHeight(target);
  }

  return stacks;
}

/**
 * The previous row-based arrangement, kept as a scored candidate.
 *
 * Stacks are full-height columns, so a single shelf of them cannot mix widths
 * vertically the way bands can. On a page carrying a lot of ad inches in
 * mismatched widths, banding genuinely wins. Rather than guess, this is
 * offered to the same scorer as every stack candidate -- so the arrangement
 * that reaches the page is never worse than what the old code would have
 * produced.
 */
function buildRowArrangement(free: ShelfAdInput[], area: ShelfArea): ShelfPlacement[] {
  const sorted = [...free].sort((a, b) => b.widthPt * b.heightPt - a.widthPt * a.heightPt);
  const areaRight = area.x + area.width;
  const areaBottom = area.y + area.height;
  let cursorX = areaRight;
  let cursorY = areaBottom;
  let rowHeight = 0;
  const placed: ShelfPlacement[] = [];
  let rowIndices: number[] = [];

  const closeRowGap = () => {
    if (rowIndices.length === 0) return;
    let leftmost = rowIndices[0]!;
    for (const i of rowIndices) if (placed[i]!.x < placed[leftmost]!.x) leftmost = i;
    const gap = placed[leftmost]!.x - area.x;
    if (gap > 0 && gap <= ROW_GAP_SNAP_THRESHOLD) {
      placed[leftmost] = {
        ...placed[leftmost]!,
        x: area.x,
        widthPt: placed[leftmost]!.widthPt + gap,
      };
    }
    rowIndices = [];
  };

  for (const ad of sorted) {
    if (cursorX - ad.widthPt < area.x) {
      closeRowGap();
      cursorX = areaRight;
      cursorY -= rowHeight + GUTTER;
      rowHeight = 0;
    }
    const x = Math.max(area.x, Math.min(cursorX - ad.widthPt, areaRight - ad.widthPt));
    const y = Math.max(area.y, Math.min(cursorY - ad.heightPt, areaBottom - ad.heightPt));
    placed.push({ id: ad.id, x, y, widthPt: ad.widthPt, heightPt: ad.heightPt });
    rowIndices.push(placed.length - 1);
    cursorX = x - GUTTER;
    rowHeight = Math.max(rowHeight, ad.heightPt);
  }
  closeRowGap();
  return placed;
}

/**
 * Moves ads between equal-width stacks for as long as that strictly lowers the
 * tallest stack. The ad block's height IS the tallest stack, so every point
 * taken off it is leftover area recovered for editorial.
 */
function rebalance(stacks: AdStack[], area: ShelfArea): void {
  const tallestHeight = () => stacks.reduce((max, s) => Math.max(max, s.height), 0);

  for (let pass = 0; pass < 60 && stacks.length > 1; pass++) {
    const currentMax = tallestHeight();
    let moved = false;

    for (const from of stacks) {
      if (from.ads.length < 2) continue;
      for (let i = from.ads.length - 1; i >= 0; i--) {
        const ad = from.ads[i]!;
        for (const to of stacks) {
          if (to === from) continue;
          if (Math.abs(to.widthPt - from.widthPt) > 1) continue;
          const newFrom = from.height - ad.heightPt - GUTTER;
          const newTo = to.height + GUTTER + ad.heightPt;
          if (newTo > area.height) continue;
          const others = stacks
            .filter((s) => s !== from && s !== to)
            .reduce((max, s) => Math.max(max, s.height), 0);
          if (Math.max(newFrom, newTo, others) < currentMax - 0.5) {
            from.ads.splice(i, 1);
            from.height = stackHeight(from);
            to.ads.push(ad);
            to.height = stackHeight(to);
            moved = true;
            break;
          }
        }
        if (moved) break;
      }
      if (moved) break;
    }

    if (!moved) break;
  }
}

/** Lays stacks out right to left, ads bottom-up within a stack. */
function placeStacks(stacks: AdStack[], area: ShelfArea): ShelfPlacement[] {
  const areaRight = area.x + area.width;
  const areaBottom = area.y + area.height;
  const placements: ShelfPlacement[] = [];
  let cursorX = areaRight;

  for (const stack of stacks) {
    const x = Math.max(area.x, Math.min(cursorX - stack.widthPt, areaRight - stack.widthPt));
    let cursorY = areaBottom;
    for (const ad of stack.ads) {
      const y = Math.max(area.y, cursorY - ad.heightPt);
      // Right-align within the stack. An ad narrower than its stack leaves a
      // pocket beside it; pushing it to the stack's right edge puts that
      // pocket on the LEFT, where it abuts the open editorial area (stacks
      // run right to left) and merges into it instead of being sealed in
      // between two ads where nothing can ever reach it.
      const adX = x + stack.widthPt - ad.widthPt;
      placements.push({ id: ad.id, x: adX, y, widthPt: ad.widthPt, heightPt: ad.heightPt });
      cursorY = y - GUTTER;
    }
    cursorX = x - GUTTER;
  }

  return placements;
}

/**
 * Blank area left by an arrangement: the content area, less the ads, less the
 * zones the residual engine will hand to real articles. Scored with the same
 * engine and the same options the panel itself uses, so the number here is
 * the number that reaches the page.
 */
function blankArea(placements: ShelfPlacement[], area: ShelfArea): number {
  // Ads that overlap each other must be rejected outright, not scored. When a
  // stack is taller than the page its overflowing ads are clamped to the top
  // edge and land on top of one another; those overlaps double-count in the
  // `adArea` sum below, which made the very worst arrangement score a perfect
  // zero (measured: a 6-ad set whose heights sum to 2138pt on a 1433pt page
  // put three ads at the same y and scored 0% blank while actually printing
  // 10% blank).
  for (let i = 0; i < placements.length; i++) {
    const a = placements[i]!;
    for (let j = i + 1; j < placements.length; j++) {
      const b = placements[j]!;
      const overlapW = Math.min(a.x + a.widthPt, b.x + b.widthPt) - Math.max(a.x, b.x);
      const overlapH = Math.min(a.y + a.heightPt, b.y + b.heightPt) - Math.max(a.y, b.y);
      if (overlapW > 0.5 && overlapH > 0.5) return Number.POSITIVE_INFINITY;
    }
  }

  const snappedAds = placements.map((p) => ({
    placedX: Math.floor(p.x),
    placedY: Math.floor(p.y),
    displayWidthPt: Math.ceil(p.widthPt),
    displayHeightPt: Math.ceil(p.heightPt),
    placed: true,
  }));

  const rects = computeAdResidualRects(
    snappedAds,
    area.x,
    area.y,
    area.width,
    area.height,
    { wideShortFillers: true },
  );

  // Union area, not a sum. The engine snaps ad edges outward before
  // subtracting, so a snapped ad can share a sub-point sliver with a residual
  // rect; summing the two would double-count it and under-report the blank.
  // Coordinate compression keeps this exact and cheap -- a page carries at
  // most a handful of ads and zones, so the compressed grid is tiny.
  const covered: Array<{ x0: number; y0: number; x1: number; y1: number }> = [
    // The ads' own rects, not the outward-snapped ones handed to the engine --
    // the snapped edges would claim sub-point slivers that do not actually
    // carry ink, and scoring those as covered biases the comparison.
    ...placements.map((p) => ({
      x0: p.x,
      y0: p.y,
      x1: p.x + p.widthPt,
      y1: p.y + p.heightPt,
    })),
    ...rects.map((r) => ({ x0: r.x, y0: r.y, x1: r.x + r.width, y1: r.y + r.height })),
  ];

  const clampX = (v: number) => Math.min(Math.max(v, area.x), area.x + area.width);
  const clampY = (v: number) => Math.min(Math.max(v, area.y), area.y + area.height);
  const xs = [...new Set([area.x, area.x + area.width, ...covered.flatMap((c) => [clampX(c.x0), clampX(c.x1)])])].sort((a, b) => a - b);
  const ys = [...new Set([area.y, area.y + area.height, ...covered.flatMap((c) => [clampY(c.y0), clampY(c.y1)])])].sort((a, b) => a - b);

  let coveredArea = 0;
  for (let xi = 0; xi < xs.length - 1; xi++) {
    const x0 = xs[xi]!;
    const x1 = xs[xi + 1]!;
    for (let yi = 0; yi < ys.length - 1; yi++) {
      const y0 = ys[yi]!;
      const y1 = ys[yi + 1]!;
      const hit = covered.some((c) => c.x0 <= x0 && c.x1 >= x1 && c.y0 <= y0 && c.y1 >= y1);
      if (hit) coveredArea += (x1 - x0) * (y1 - y0);
    }
  }

  return Math.max(0, area.width * area.height - coveredArea);
}

/**
 * Arranges unlocked ads into bottom-anchored, same-width vertical stacks.
 *
 * Locked ads are not returned -- the caller keeps them at the position the
 * publisher pinned them to, exactly as before.
 */
export function arrangeAdShelf(ads: ShelfAdInput[], area: ShelfArea): ShelfPlacement[] {
  const free = ads.filter((ad) => !ad.locked);
  if (free.length === 0) return [];

  const byHeightDesc = [...free].sort((a, b) => b.heightPt - a.heightPt);

  let best: { placements: ShelfPlacement[]; blank: number } | null = null;

  // One candidate per stack count. Fewer stacks means taller stacks and a
  // wider leftover; more stacks means a shorter ad block but a narrower
  // leftover that may fall into the unfillable dead zone. Only the residual
  // engine can say which wins, so try them all -- there are never more
  // candidates than there are ads.
  for (let maxStacks = 1; maxStacks <= free.length; maxStacks++) {
    const stacks = buildStacks(byHeightDesc, area, maxStacks);
    if (stacks === null) continue;
    rebalance(stacks, area);

    // Tallest stack to the right, matching the bottom-right-heavy convention
    // the panel has always used.
    stacks.sort((a, b) => b.height - a.height);

    const usedWidth = stacks.reduce((sum, s) => sum + s.widthPt, 0);
    const remainder = area.width - usedWidth;
    if (remainder > 0 && remainder <= ROW_GAP_SNAP_THRESHOLD && stacks.length > 0) {
      const leftmost = stacks[stacks.length - 1]!;
      leftmost.widthPt += remainder;
      leftmost.ads = leftmost.ads.map((ad) => ({ ...ad, widthPt: ad.widthPt + remainder }));
    }

    const placements = placeStacks(stacks, area);
    const blank = blankArea(placements, area);

    // Strictly-better wins, so ties keep the earliest (fewest stacks =
    // tallest, most newspaper-like ad column).
    if (best === null || blank < best.blank - 0.5) {
      best = { placements, blank };
    }
  }

  // The previous row-based arrangement, scored on exactly the same terms.
  const rowPlacements = buildRowArrangement(free, area);
  const rowBlank = blankArea(rowPlacements, area);
  if (best === null || rowBlank < best.blank - 0.5) {
    best = { placements: rowPlacements, blank: rowBlank };
  }

  // No candidate could be placed without overlap -- more ad inches than the
  // page can hold. Nothing here can fix that, so fall back to the old row
  // arrangement, which is what would have been produced before this change.
  if (best === null || !Number.isFinite(best.blank)) {
    return rowPlacements;
  }

  return best.placements;
}
