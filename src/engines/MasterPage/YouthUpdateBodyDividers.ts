/**
 * Decorative body dividers for Youth UPDATE's front page only -- a right-
 * edge rule after every article box (skipped where the box already sits at
 * the paper's own right edge) and a low, hatched horizontal rule after the
 * top and middle row bands. Pure geometry, shared by both render paths the
 * same way every other Youth UPDATE element is (see
 * YouthUpdateMastheadGeometry.ts for the established pattern).
 */

export type YouthUpdateRightDivider = { x: number; y: number; height: number };
export type YouthUpdateHatchTick = { x: number; y1: number; y2: number };

/**
 * One vertical rule per story box, running down its right edge -- skipped
 * for any box whose right edge already sits at (or past) the page's own
 * content edge, since there is no paper beyond it to divide from.
 */
export const getYouthUpdateRightDividers = (
  stories: Array<{ x: number; y: number; width: number; height: number }>,
  contentRightEdge: number,
): YouthUpdateRightDivider[] => {
  const epsilon = 1;
  return stories
    .filter((story) => story.x + story.width < contentRightEdge - epsilon)
    .map((story) => ({ x: story.x + story.width, y: story.y, height: story.height }));
};

/**
 * A low horizontal band of short vertical ticks -- "||||||||||||" -- spanning
 * `width` starting at `x`, centred on `centerY`.
 */
export const getYouthUpdateHatchDividerTicks = (
  x: number,
  width: number,
  centerY: number,
  tickHeight: number,
  spacing: number,
): YouthUpdateHatchTick[] => {
  const ticks: YouthUpdateHatchTick[] = [];
  for (let tx = x; tx <= x + width; tx += spacing) {
    ticks.push({ x: tx, y1: centerY - tickHeight / 2, y2: centerY + tickHeight / 2 });
  }
  return ticks;
};
