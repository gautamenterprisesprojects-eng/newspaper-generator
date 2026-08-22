/**
 * The press colour control strip that runs across the foot of every page of the
 * printed Cliff News edition.
 *
 * This is not editorial furniture — it is the strip a press operator reads to
 * check ink density and registration, which is why it sits outside the content
 * box and takes no part in the column grid or story flow.
 *
 * Every number below was measured off page 4 of the 12-page Bhopal edition of
 * Saturday 8 August 2026 (`4.pdf`), rasterised at ~5.3 px/pt and sampled: the
 * same strip appears at the same height on pages 1 and 7, so it is per-page
 * furniture rather than something specific to one section.
 *
 * Layout, left to right:
 *
 *   [bar]  C M Y K  [long bar]  C c M m Y y K k  [long bar]  C M Y K  [bar]
 *
 * — solid process inks at each end, and a centre group carrying each ink as a
 * solid followed by its tint, separated by four light-grey stadium bars.
 *
 * The element positions are held as measured points against the reference
 * sheet's 935pt width and scaled to whatever page they are drawn on. They are
 * deliberately NOT reduced to a rule (a pitch, an even gap) because the artwork
 * is not regular — the gaps between groups run anywhere from 1.8pt to 9.2pt —
 * and inventing a rule would visibly redraw it rather than reproduce it.
 */

/** Width of the sheet every measurement below was taken from. */
export const PRESS_BAR_REFERENCE_PAGE_WIDTH = 935;

/** Process inks, sampled from the artwork rather than assumed. */
export const PRESS_BAR_COLORS = {
  cyan: "#00AEEF",
  magenta: "#ED028C",
  yellow: "#FFF101",
  black: "#292526",
  cyanTint: "#6DCFF6",
  magentaTint: "#F7C2D9",
  yellowTint: "#FFFAC1",
  blackTint: "#C5C6C9",
  bar: "#DEDFE0",
} as const;

/** Dot diameter, from the vertical extent of every dot (uniform at 13.84pt). */
export const PRESS_BAR_DOT_DIAMETER = 13.84;

/** Height of the grey separator bars; drawn as stadiums, so radius is half. */
export const PRESS_BAR_BAR_HEIGHT = 8.04;

/** Separator bars as [xStart, width] against the reference width. */
const BAR_SPANS: ReadonlyArray<readonly [number, number]> = [
  [38.8, 67.5],
  [180.7, 218.6],
  [529.2, 219.7],
  [831.1, 67.5],
];

/**
 * Dot groups, each given by the outer edges of the group against the reference
 * width plus the inks it carries, evenly pitched between those edges.
 *
 * Held as a group extent rather than as sixteen individual centres on purpose.
 * Sampling the artwork dot by dot gives centres that drift — the colour-run
 * detection stops at the anti-aliased rim, so a pale dot reads narrower than it
 * is and its apparent centre shifts. Taken literally those centres put the
 * yellow and black tints 13.4pt apart, closer than the 13.84pt dots are wide,
 * which would overlap them. The group edges are the reliable measurement (they
 * sit against white), and press artwork spaces a group evenly, so the pitch is
 * derived from the extent instead. That reproduces the sheet and stays
 * self-consistent: the tightest resulting pitch is 15.87pt, a clear 2pt gap.
 */
const DOT_GROUPS: ReadonlyArray<{
  left: number;
  right: number;
  inks: ReadonlyArray<keyof typeof PRESS_BAR_COLORS>;
}> = [
  { left: 109.6, right: 176.3, inks: ["cyan", "magenta", "yellow", "black"] },
  {
    left: 400.9,
    right: 525.8,
    inks: [
      "cyan",
      "cyanTint",
      "magenta",
      "magentaTint",
      "yellow",
      "yellowTint",
      "black",
      "blackTint",
    ],
  },
  { left: 755.3, right: 821.7, inks: ["cyan", "magenta", "yellow", "black"] },
];

export type PressBarDot = {
  /** Centre of the dot, in page points. */
  x: number;
  y: number;
  radius: number;
  fill: string;
};

export type PressBarBar = {
  /** Top-left of the bar, in page points. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Stadium ends. */
  cornerRadius: number;
  fill: string;
};

export type PressColourBar = {
  dots: PressBarDot[];
  bars: PressBarBar[];
  /** Centre line the strip is drawn on, in page points from the page top. */
  centerY: number;
};

export type PressColourBarInput = {
  pageWidth: number;
  pageHeight: number;
  /**
   * Bottom edge of the editorial content box, in page points. The strip hangs a
   * fixed drop below this, so it can never collide with a story.
   *
   * Anchored to the content edge rather than to the foot of the sheet on
   * purpose. The reference sheet is an inch shorter than the pages this app
   * produces, so its measured 37.3pt-above-the-trim would land inside the
   * content box here; and the strip is not centred in its band either — on page
   * 4 the band runs 45.2pt and the strip sits in the upper third of it, tucked
   * under the content with the white space below. Hanging it off the content
   * edge reproduces that on any page size.
   */
  contentBottom: number;
};

/**
 * Clear gap between the bottom of the content box and the top of the strip.
 *
 * 7.2pt, measured on the reference sheet: the rule closing the story boxes sits
 * 51.5pt above the trim and the top of the dots 44.3pt.
 *
 * Expressed as the visible gap rather than as a drop to the centre line, which
 * is how it was first written — a dot is 6.92pt from centre to rim, so a
 * "7.9pt drop" left under 1pt of daylight and the strip read as stuck to the
 * content above it. Stating the gap makes the spacing mean what it says.
 */
export const PRESS_BAR_GAP_ABOVE = 7.2;

/**
 * Resolves the strip to concrete shapes in page-point coordinates.
 *
 * Horizontal positions scale with the page width; the dot and bar sizes do not,
 * because they are physical press marks rather than a proportion of the sheet.
 */
export const getPressColourBar = ({
  pageWidth,
  pageHeight,
  contentBottom,
}: PressColourBarInput): PressColourBar => {
  const scale = pageWidth / PRESS_BAR_REFERENCE_PAGE_WIDTH;
  const dotRadius = PRESS_BAR_DOT_DIAMETER / 2;

  // Hangs below the content edge, clamped so the strip stays on the sheet even
  // if a page master leaves the footer band almost no room.
  const bandTop = Math.min(contentBottom, pageHeight);
  const rawCenter = bandTop + PRESS_BAR_GAP_ABOVE + dotRadius;
  const centerY = Math.max(dotRadius, Math.min(rawCenter, pageHeight - dotRadius));

  const dots: PressBarDot[] = [];
  for (const group of DOT_GROUPS) {
    // Centres run from one dot-radius inside each edge, evenly pitched.
    const first = group.left + dotRadius;
    const last = group.right - dotRadius;
    const steps = Math.max(1, group.inks.length - 1);
    const pitch = (last - first) / steps;

    group.inks.forEach((ink, index) => {
      dots.push({
        x: (first + pitch * index) * scale,
        y: centerY,
        radius: dotRadius,
        fill: PRESS_BAR_COLORS[ink],
      });
    });
  }

  const bars = BAR_SPANS.map(([x, width]) => ({
    x: x * scale,
    y: centerY - PRESS_BAR_BAR_HEIGHT / 2,
    width: width * scale,
    height: PRESS_BAR_BAR_HEIGHT,
    cornerRadius: PRESS_BAR_BAR_HEIGHT / 2,
    fill: PRESS_BAR_COLORS.bar,
  }));

  return { dots, bars, centerY };
};
