import {
  PRESS_BAR_COLORS,
  PRESS_BAR_DOT_DIAMETER,
  PRESS_BAR_GAP_ABOVE,
  getPressColourBar,
} from "./PressColourBarGeometry";
import { DEFAULT_PAGE_MASTER } from "@/types/page";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

// The page this app produces: 13 x 21in, with a 0.715in footer band reserved
// below the content box for this strip.
const PAGE_WIDTH = 936;
const PAGE_HEIGHT = 1512;
const CONTENT_BOTTOM = (0.38 + 19.905) * 72;
const FOOTER_BAND = PAGE_HEIGHT - CONTENT_BOTTOM;

const bar = getPressColourBar({
  pageWidth: PAGE_WIDTH,
  pageHeight: PAGE_HEIGHT,
  contentBottom: CONTENT_BOTTOM,
});

// ── Composition: the strip measured off the printed sheet ────────────────────
assert(bar.bars.length === 4, `expected 4 separator bars, got ${bar.bars.length}`);
assert(bar.dots.length === 16, `expected 16 dots, got ${bar.dots.length}`);

// Solid CMYK at each end, and a centre group of eight running solid-then-tint.
const fills = bar.dots.map((dot) => dot.fill);
const { cyan, magenta, yellow, black, cyanTint, magentaTint, yellowTint, blackTint } =
  PRESS_BAR_COLORS;
const expected = [
  cyan, magenta, yellow, black,
  cyan, cyanTint, magenta, magentaTint, yellow, yellowTint, black, blackTint,
  cyan, magenta, yellow, black,
];
for (const [index, want] of expected.entries()) {
  assert(
    fills[index] === want,
    `dot ${index} must be ${want}, got ${fills[index]} — the ink order is what a press operator reads`,
  );
}

// ── Placement: below the content, on the sheet, never touching a story ───────
const dotRadius = PRESS_BAR_DOT_DIAMETER / 2;
const stripTop = Math.min(...bar.dots.map((dot) => dot.y - dot.radius));
const stripBottom = Math.max(...bar.dots.map((dot) => dot.y + dot.radius));

assert(
  stripTop >= CONTENT_BOTTOM,
  `the strip must sit below the content box (top ${stripTop.toFixed(1)}pt vs content bottom ${CONTENT_BOTTOM.toFixed(1)}pt)`,
);

// The gap above is the visible daylight between the content edge and the top of
// the dots — measured to the rim, not to the centre line. Getting that wrong is
// what once left the strip looking stuck to the story above it.
const gapAbove = stripTop - CONTENT_BOTTOM;
assert(
  Math.abs(gapAbove - PRESS_BAR_GAP_ABOVE) < 0.001,
  `the strip must clear the content by ${PRESS_BAR_GAP_ABOVE}pt, got ${gapAbove.toFixed(2)}pt`,
);
assert(
  stripBottom <= PAGE_HEIGHT,
  `the strip must stay on the sheet (bottom ${stripBottom.toFixed(1)}pt vs page ${PAGE_HEIGHT}pt)`,
);

// The footer band must be deep enough to hold the strip with white beneath it,
// as on the printed sheet — the band is reserved for exactly this.
assert(
  FOOTER_BAND > PRESS_BAR_DOT_DIAMETER * 2,
  `the footer band (${FOOTER_BAND.toFixed(1)}pt) must comfortably clear the strip`,
);
assert(
  stripBottom < PAGE_HEIGHT - PRESS_BAR_DOT_DIAMETER,
  "the strip must leave clear white between itself and the trim, not sit on the page edge",
);
// It hangs under the content rather than floating mid-band: on the printed
// sheet ~7pt of white sits above the strip and ~30pt below it.
assert(
  bar.centerY - CONTENT_BOTTOM < FOOTER_BAND / 2,
  "the strip must sit in the upper part of the footer band, tucked under the content",
);
const whiteBelow = PAGE_HEIGHT - stripBottom;
assert(
  whiteBelow > gapAbove * 3,
  `the sheet must carry far more white below the strip than above it (below ${whiteBelow.toFixed(1)}pt, above ${gapAbove.toFixed(1)}pt)`,
);
assert(
  Math.abs(whiteBelow - 30.4) < 2,
  `white below the strip should match the ~30.4pt on the printed sheet, got ${whiteBelow.toFixed(1)}pt`,
);

// Bars and dots share one centre line, as they do on the printed sheet.
for (const dot of bar.dots) {
  assert(Math.abs(dot.y - bar.centerY) < 0.001, "every dot must sit on the strip's centre line");
}
for (const separator of bar.bars) {
  assert(
    Math.abs(separator.y + separator.height / 2 - bar.centerY) < 0.001,
    "every bar must be centred on the strip's centre line",
  );
  assert(
    Math.abs(separator.cornerRadius - separator.height / 2) < 0.001,
    "bars are stadiums — the corner radius must be half their height",
  );
}

// ── Order and spacing: left to right, no overlaps ────────────────────────────
for (let index = 1; index < bar.dots.length; index += 1) {
  assert(
    bar.dots[index].x > bar.dots[index - 1].x,
    `dot ${index} must sit to the right of dot ${index - 1}`,
  );
}
const spans = [
  ...bar.bars.map((separator) => [separator.x, separator.x + separator.width] as const),
  ...bar.dots.map((dot) => [dot.x - dot.radius, dot.x + dot.radius] as const),
].sort((a, b) => a[0] - b[0]);
for (let index = 1; index < spans.length; index += 1) {
  assert(
    spans[index][0] >= spans[index - 1][1] - 0.001,
    `strip elements must not overlap (${spans[index - 1]} then ${spans[index]})`,
  );
}

// The whole strip stays within the sheet, inset from both edges.
assert(spans[0][0] > 0, "the strip must not run off the left edge");
assert(
  spans[spans.length - 1][1] < PAGE_WIDTH,
  "the strip must not run off the right edge",
);

// ── Scaling: a wider sheet stretches the strip, dots keep their print size ───
const wide = getPressColourBar({
  pageWidth: PAGE_WIDTH * 2,
  pageHeight: PAGE_HEIGHT,
  contentBottom: CONTENT_BOTTOM,
});
assert(
  Math.abs(wide.dots[0].radius - dotRadius) < 0.001,
  "dot size is a physical press mark and must not scale with the sheet",
);
assert(
  Math.abs(wide.dots[0].x - bar.dots[0].x * 2) < 0.001,
  "dot positions must scale with the sheet width",
);

// ── A cramped page master must still leave the strip on the sheet ────────────
const cramped = getPressColourBar({
  pageWidth: PAGE_WIDTH,
  pageHeight: PAGE_HEIGHT,
  contentBottom: PAGE_HEIGHT,
});
assert(
  Math.max(...cramped.dots.map((dot) => dot.y + dot.radius)) <= PAGE_HEIGHT + 0.001,
  "with no band left, the strip must still be clamped onto the sheet",
);

// ── The page master must actually reserve the band ───────────────────────────
// contentY + contentHeight + footerHeight has to equal the sheet height, or the
// "footer band" is a fiction and stories will print over the strip.
{
  const { height, contentY, contentHeight, footerHeight } = DEFAULT_PAGE_MASTER;
  assert(
    Math.abs(contentY + contentHeight + footerHeight - height) < 0.005,
    `page master must reserve the footer band: contentY ${contentY} + contentHeight ${contentHeight} + footerHeight ${footerHeight} != height ${height}`,
  );
  const bandCm = (footerHeight * 72) / 28.3465;
  assert(
    bandCm > 1.7 && bandCm < 1.95,
    `footer band should match the ~1.82cm measured on the printed sheet (got ${bandCm.toFixed(2)}cm)`,
  );
}

console.log("PressColourBar tests passed");
