/**
 * The आज का राशिफल block, laid out as a grid of twelve cells.
 *
 * Drawn as page furniture rather than composed as an article. The article
 * composer flows prose: it has no concept of a cell, a per-cell header or an
 * icon, so pushing twelve readings through it produces one continuous column
 * with the signs as inline lead-ins — which is not how any newspaper sets a
 * horoscope. This module describes the grid, and the two renderers (the Konva
 * canvas and the export canvas) both draw from it so they cannot disagree.
 *
 * Same arrangement as the printed page: two columns of six, each cell carrying
 * a tinted header with the sign's name and glyph, and the reading beneath.
 */

/**
 * Font stack for the zodiac glyphs.
 *
 * The Devanagari faces carry no ♈–♓ glyphs, so setting them in the body font
 * prints tofu boxes. These stacks name the fonts that actually have the
 * Miscellaneous Symbols block, with a generic fallback last.
 */
export const RASHIFAL_GLYPH_FONT =
  '"Segoe UI Symbol", "Noto Sans Symbols 2", "Noto Sans Symbols", "Apple Symbols", "DejaVu Sans", sans-serif';

/** The twelve signs, in the order a horoscope prints them. */
export const RASHIFAL_SIGNS = [
  { hindi: "मेष", glyph: "♈" },
  { hindi: "वृषभ", glyph: "♉" },
  { hindi: "मिथुन", glyph: "♊" },
  { hindi: "कर्क", glyph: "♋" },
  { hindi: "सिंह", glyph: "♌" },
  { hindi: "कन्या", glyph: "♍" },
  { hindi: "तुला", glyph: "♎" },
  { hindi: "वृश्चिक", glyph: "♏" },
  { hindi: "धनु", glyph: "♐" },
  { hindi: "मकर", glyph: "♑" },
  { hindi: "कुंभ", glyph: "♒" },
  { hindi: "मीन", glyph: "♓" },
] as const;

/**
 * Header tints, cycled across the cells.
 *
 * Taken from the printed page, which alternates a small set of muted colours
 * down the grid rather than giving every sign its own — twelve competing hues
 * would fight the rest of the page.
 */
export const RASHIFAL_CELL_TINTS = [
  "#C62828",
  "#1565C0",
  "#2E7D32",
  "#EF6C00",
  "#6A1B9A",
  "#00838F",
] as const;

export type RashifalReading = {
  /** Sign name as it prints, e.g. "मेष". */
  sign: string;
  /** Zodiac glyph for the sign. */
  glyph: string;
  /** The reading itself. Fitting is handled by the renderer. */
  text: string;
  luckyNumber?: string;
  luckyColor?: string;
  compatibility?: string;
};

export type RashifalCell = RashifalReading & {
  /** Cell rectangle, in the same coordinate space as the box passed in. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Tinted header bar at the top of the cell. */
  headerHeight: number;
  headerFill: string;
  /**
   * Very light wash of the header hue behind the reading.
   *
   * Ties the reading to its header so each cell reads as one object rather than
   * a coloured bar with loose text under it, which is what a flat white body
   * gave. Kept near-white so twelve of them do not turn the page into a
   * patchwork.
   */
  bodyFill: string;
  /** Circular badge the zodiac glyph sits in, at the left of the header. */
  glyphCenterX: number;
  glyphCenterY: number;
  glyphRadius: number;
  /** Where the reading starts inside the cell. */
  textX: number;
  textY: number;
  textWidth: number;
  textHeight: number;
  metaX: number;
  metaY: number;
  metaWidth: number;
  metaHeight: number;
  metaText: string;
  metaLeftText: string;
  metaCenterText: string;
  metaRightText: string;
};

/**
 * The devotional frame around the block.
 *
 * A double rule with corner diamonds — the treatment Indian papers give a
 * panel with religious or astrological content, and the same device used on
 * almanac and पंचांग pages. Restrained on purpose: a newspaper marks this kind
 * of block with rules and a corner motif, not with illustration, and anything
 * heavier would fight the twelve coloured cells inside it.
 */
export type RashifalFrame = {
  /** Heavy outer rule. */
  outer: { x: number; y: number; width: number; height: number; strokeWidth: number };
  /** Hairline inside it, set off by a gap. */
  inner: { x: number; y: number; width: number; height: number; strokeWidth: number };
  /**
   * Corner medallions: a larger diamond with a second one inset, marking the
   * four corners more emphatically than the beads that run between them.
   */
  ornaments: Array<{ x: number; y: number; radius: number; innerRadius: number }>;
  /**
   * The devotional motifs — lotus flowers at the corners, a kalash at the head
   * of the block, and a scalloped arc run along the rules.
   *
   * Emitted as primitive shapes rather than as named motifs so the two
   * renderers stay dumb: each simply draws ellipses, arcs and circles from this
   * list. A renderer that had to know what a lotus is would be a second place
   * for the design to drift.
   */
  shapes: RashifalOrnamentShape[];
  stroke: string;
};

/** Primitives the frame's motifs are built from. */
export type RashifalOrnamentShape =
  | {
      kind: "ellipse";
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      /** Radians, clockwise. */
      rotation: number;
      fill: string;
    }
  | { kind: "circle"; cx: number; cy: number; radius: number; fill: string }
  | {
      kind: "arc";
      cx: number;
      cy: number;
      radius: number;
      /** Radians. */
      from: number;
      to: number;
      stroke: string;
      strokeWidth: number;
    };

export type RashifalGrid = {
  /** Title bar across the top of the block. */
  title: { x: number; y: number; width: number; height: number; text: string };
  cells: RashifalCell[];
  frame: RashifalFrame;
};

export type RashifalGridInput = {
  /** The box the horoscope occupies, in page points. */
  x: number;
  y: number;
  width: number;
  height: number;
  readings: RashifalReading[];
  /** Columns of cells. Two is what the printed page uses. */
  columns?: number;
  title?: string;
};

/** Height of the block's own title bar. */
export const RASHIFAL_TITLE_HEIGHT = 26;

/** Header bar inside each cell, carrying the sign name and glyph. */
export const RASHIFAL_CELL_HEADER_HEIGHT = 16;

/** Footer strip for lucky number, colour and compatible sign. */
export const RASHIFAL_CELL_META_HEIGHT = 8.5;

/**
 * Mixes a colour towards white.
 *
 * Used for the cell body wash. `amount` is how much of the original survives,
 * so 0.08 is a very faint tint — enough to bind the reading to its header
 * without competing with the type sitting on it.
 */
const washTowardsWhite = (hex: string, amount: number) => {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const mix = (channel: number) => Math.round(255 - (255 - channel) * amount);

  return `#${[mix(r), mix(g), mix(b)]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
};

/** Gap between cells, horizontally and vertically. */
export const RASHIFAL_CELL_GAP = 4;

/** Padding inside a cell, around the reading. */
export const RASHIFAL_CELL_PADDING = 3;

const parseMetaTail = (rawText: string) => {
  const trimmed = rawText.trim();
  const metaMatch = trimmed.match(/\s*\[\[meta:([\s\S]*?)\]\]\s*[।.]?\s*$/u);
  const text = (metaMatch?.index !== undefined ? trimmed.slice(0, metaMatch.index) : trimmed).trim();
  const metaBody = metaMatch?.[1] ?? "";
  const meta: Pick<RashifalReading, "luckyNumber" | "luckyColor" | "compatibility"> = {};

  if (metaBody) {
    for (const item of metaBody.split(";")) {
      const [key, ...valueParts] = item.split("=");
      const value = valueParts.join("=").trim();

      if (!value) {
        continue;
      }

      if (key.trim() === "शुभ अंक") {
        meta.luckyNumber = value;
      } else if (key.trim() === "शुभ रंग") {
        meta.luckyColor = value;
      } else if (key.trim() === "राशि अनुकूलता") {
        meta.compatibility = value;
      }
    }
  }

  return { text, ...meta };
};

/**
 * Saffron — the colour Indian print reserves for devotional and astrological
 * matter, so the frame reads as belonging to this kind of block on sight.
 */
export const RASHIFAL_FRAME_STROKE = "#B8651A";

/**
 * Second tone, alternated with the saffron along the beaded rule.
 *
 * A single-colour bead run reads as a dotted line; two tones alternating read
 * as a woven border, which is the effect devotional panels get.
 */
export const RASHIFAL_FRAME_ACCENT = "#9C1C1C";

/**
 * Room the frame takes before the content starts.
 *
 * Sized so the ornament is legible at print size. An earlier pass used 7pt with
 * ~1pt beads, which measured correctly and was invisible on the page — at
 * 100% that is about two pixels. Ornament that cannot be seen is not ornament.
 */
export const RASHIFAL_FRAME_INSET = 12;

/**
 * A lotus, built from petals radiating around a seed.
 *
 * Each petal is an ellipse pushed out from the centre and rotated to its own
 * spoke, which is how a lotus reads at small size — the flower is recognised
 * from the ring of petals, not from their outline detail. Eight petals is the
 * count devotional print uses; fewer reads as a star, more turns to mush at
 * newspaper scale.
 */
const lotusAt = (
  cx: number,
  cy: number,
  radius: number,
  petalFill: string,
  seedFill: string,
): RashifalOrnamentShape[] => {
  const petals = 8;
  const petalLength = radius * 0.62;
  const shapes: RashifalOrnamentShape[] = [];

  for (let index = 0; index < petals; index += 1) {
    const angle = (index / petals) * Math.PI * 2;
    shapes.push({
      kind: "ellipse",
      cx: cx + Math.cos(angle) * petalLength * 0.72,
      cy: cy + Math.sin(angle) * petalLength * 0.72,
      rx: petalLength,
      ry: petalLength * 0.42,
      rotation: angle,
      fill: petalFill,
    });
  }

  shapes.push({ kind: "circle", cx, cy, radius: radius * 0.26, fill: seedFill });

  return shapes;
};

/**
 * A kalash — the pot set at the head of a devotional panel.
 *
 * Assembled from primitives rather than a traced path: a rounded body, a
 * narrowed neck, a flared rim, and the coconut and mango leaves that crown it.
 * At this size the silhouette is what carries the motif, so the parts are kept
 * few and their proportions exaggerated slightly to survive the printing.
 */
const kalashAt = (
  cx: number,
  cy: number,
  size: number,
  fill: string,
  accent: string,
): RashifalOrnamentShape[] => [
  // Body
  { kind: "ellipse", cx, cy: cy + size * 0.34, rx: size * 0.52, ry: size * 0.46, rotation: 0, fill },
  // Neck
  { kind: "ellipse", cx, cy, rx: size * 0.3, ry: size * 0.16, rotation: 0, fill },
  // Flared rim
  { kind: "ellipse", cx, cy: cy - size * 0.12, rx: size * 0.46, ry: size * 0.13, rotation: 0, fill },
  // Mango leaves either side of the coconut
  {
    kind: "ellipse",
    cx: cx - size * 0.3,
    cy: cy - size * 0.34,
    rx: size * 0.26,
    ry: size * 0.12,
    rotation: -Math.PI / 5,
    fill: accent,
  },
  {
    kind: "ellipse",
    cx: cx + size * 0.3,
    cy: cy - size * 0.34,
    rx: size * 0.26,
    ry: size * 0.12,
    rotation: Math.PI / 5,
    fill: accent,
  },
  // Coconut
  { kind: "circle", cx, cy: cy - size * 0.46, radius: size * 0.2, fill },
];

/**
 * Matches a reading to its sign.
 *
 * The feed titles its records "मीन राशिफल 8 Aug 2026", so the sign is the
 * leading word. Matching on that rather than on feed order means a feed that
 * arrives shuffled — as it does, the API returns मीन first — still prints in
 * the conventional मेष-to-मीन order.
 */
export const toRashifalReadings = (
  records: Array<{ title?: string; summary?: string; article?: string }>,
): RashifalReading[] => {
  const bySign = new Map<string, string>();

  for (const record of records) {
    const title = (record.title ?? "").trim();
    const match = RASHIFAL_SIGNS.find((sign) => title.startsWith(sign.hindi));

    if (!match) {
      continue;
    }

    const parsed = parseMetaTail(
      (record.summary ?? record.article ?? "")
      .replace(/\s+/g, " ")
      // The summary repeats its own dated title before the reading starts.
      .replace(/^[^:।]{0,40}राशिफल[^:]{0,40}:\s*/u, "")
      .trim(),
    );

    if (parsed.text) {
      bySign.set(match.hindi, JSON.stringify(parsed));
    }
  }

  return RASHIFAL_SIGNS.filter((sign) => bySign.has(sign.hindi)).map((sign) => {
    const parsed = JSON.parse(bySign.get(sign.hindi) ?? "{}") as ReturnType<typeof parseMetaTail>;
    return {
      sign: sign.hindi,
      glyph: sign.glyph,
      text: parsed.text ?? "",
      luckyNumber: parsed.luckyNumber,
      luckyColor: parsed.luckyColor,
      compatibility: parsed.compatibility,
    };
  });
};

/**
 * Recovers the twelve readings from a composed horoscope story.
 *
 * The block is built as an ordinary story — "मेष: reading। वृषभ: reading।…" —
 * so that it survives the store, the language resolver and the composer like
 * any other. This reads that form back so the grid can be drawn from it.
 *
 * Recognising the block from its own content, rather than from a flag threaded
 * through several layers, is deliberate: a flag can be dropped by any
 * conversion between the feed and the canvas, and the failure would be silent.
 * Content cannot lie about what it is.
 *
 * Returns null when the text is not a horoscope, so every other box on the page
 * falls through to the normal article renderer untouched.
 */
export const parseRashifalReadings = (
  headline: string,
  body: string,
): RashifalReading[] | null => {
  if (!/राशिफल/.test(headline)) {
    return null;
  }

  const text = body.replace(/\s+/g, " ").trim();

  if (!text) {
    return null;
  }

  // Locate each "<sign>:" marker, then take the text up to the next marker.
  const marks = RASHIFAL_SIGNS.map((sign) => ({
    sign,
    index: text.indexOf(`${sign.hindi}:`),
  }))
    .filter((mark) => mark.index >= 0)
    .sort((a, b) => a.index - b.index);

  // A couple of stray matches are not a horoscope; a real one carries most of
  // the twelve. Half is a comfortable floor for a partial feed.
  if (marks.length < 6) {
    return null;
  }

  const found = new Map<string, string>();

  marks.forEach((mark, position) => {
    const start = mark.index + mark.sign.hindi.length + 1;
    const end = position + 1 < marks.length ? marks[position + 1].index : text.length;
    const reading = text.slice(start, end).trim();
    const parsed = parseMetaTail(reading);

    if (parsed.text) {
      found.set(mark.sign.hindi, JSON.stringify(parsed));
    }
  });

  const readings = RASHIFAL_SIGNS.filter((sign) => found.has(sign.hindi)).map((sign) => {
    const parsed = JSON.parse(found.get(sign.hindi) ?? "{}") as ReturnType<typeof parseMetaTail>;
    return {
      sign: sign.hindi,
      glyph: sign.glyph,
      text: parsed.text ?? "",
      luckyNumber: parsed.luckyNumber,
      luckyColor: parsed.luckyColor,
      compatibility: parsed.compatibility,
    };
  });

  return readings.length >= 6 ? readings : null;
};

/**
 * Resolves the block to concrete rectangles.
 *
 * Cells divide the box evenly, so the grid always fills its box exactly rather
 * than being sized from the copy — a horoscope box is a fixed slot on the page,
 * and the readings are cut to fit it, not the other way round.
 */
export const getRashifalGrid = ({
  x: boxX,
  y: boxY,
  width: boxWidth,
  height: boxHeight,
  readings,
  columns = 2,
  title = "आज का राशिफल",
}: RashifalGridInput): RashifalGrid => {
  const safeColumns = Math.max(1, columns);
  const count = readings.length;
  const rows = Math.max(1, Math.ceil(count / safeColumns));

  // The frame sits in the box; everything else lays out inside it, so the
  // devotional rules never overlap a cell.
  const x = boxX + RASHIFAL_FRAME_INSET;
  const y = boxY + RASHIFAL_FRAME_INSET;
  const width = Math.max(0, boxWidth - RASHIFAL_FRAME_INSET * 2);
  const height = Math.max(0, boxHeight - RASHIFAL_FRAME_INSET * 2);

  const gridY = y + RASHIFAL_TITLE_HEIGHT;
  const gridHeight = Math.max(0, height - RASHIFAL_TITLE_HEIGHT);

  const cellWidth = (width - RASHIFAL_CELL_GAP * (safeColumns - 1)) / safeColumns;
  const cellHeight = (gridHeight - RASHIFAL_CELL_GAP * (rows - 1)) / rows;

  const cells = readings.map((reading, index) => {
    const column = index % safeColumns;
    const row = Math.floor(index / safeColumns);
    const cellX = x + column * (cellWidth + RASHIFAL_CELL_GAP);
    const cellY = gridY + row * (cellHeight + RASHIFAL_CELL_GAP);

    // Colour runs down the column rather than across the row, so the two
    // columns read as parallel lists instead of six banded stripes.
    const headerFill = RASHIFAL_CELL_TINTS[index % RASHIFAL_CELL_TINTS.length];
    const glyphRadius = RASHIFAL_CELL_HEADER_HEIGHT / 2 - 2.5;
    const metaLeftText = reading.luckyNumber ? `शुभ अंक - ${reading.luckyNumber}` : "";
    const metaCenterText = reading.luckyColor ? `शुभ रंग - ${reading.luckyColor}` : "";
    const metaRightText = reading.compatibility ? `अनुकूल राशि - ${reading.compatibility}` : "";
    const metaText = [metaLeftText, metaCenterText, metaRightText].filter(Boolean).join(" - ");
    const metaHeight = metaText ? RASHIFAL_CELL_META_HEIGHT : 0;
    const textY = cellY + RASHIFAL_CELL_HEADER_HEIGHT + RASHIFAL_CELL_PADDING;
    const metaY = cellY + cellHeight - metaHeight - RASHIFAL_CELL_PADDING;

    return {
      ...reading,
      x: cellX,
      y: cellY,
      width: cellWidth,
      height: cellHeight,
      headerHeight: RASHIFAL_CELL_HEADER_HEIGHT,
      headerFill,
      bodyFill: washTowardsWhite(headerFill, 0.08),
      glyphCenterX: cellX + 3 + glyphRadius,
      glyphCenterY: cellY + RASHIFAL_CELL_HEADER_HEIGHT / 2,
      glyphRadius,
      textX: cellX + RASHIFAL_CELL_PADDING,
      textY,
      textWidth: Math.max(0, cellWidth - RASHIFAL_CELL_PADDING * 2),
      textHeight: Math.max(
        0,
        metaY - textY - RASHIFAL_CELL_PADDING,
      ),
      metaX: cellX + RASHIFAL_CELL_PADDING,
      metaY,
      metaWidth: Math.max(0, cellWidth - RASHIFAL_CELL_PADDING * 2),
      metaHeight,
      metaText,
      metaLeftText,
      metaCenterText,
      metaRightText,
    };
  });

  // Double rule: a heavy outer line just inside the box edge, a hairline set off
  // from it, with a diamond at each corner where the two meet.
  const outerOffset = 1.6;
  const innerOffset = RASHIFAL_FRAME_INSET - 1.5;
  const outer = {
    x: boxX + outerOffset,
    y: boxY + outerOffset,
    width: Math.max(0, boxWidth - outerOffset * 2),
    height: Math.max(0, boxHeight - outerOffset * 2),
    strokeWidth: 2.4,
  };
  const inner = {
    x: boxX + innerOffset,
    y: boxY + innerOffset,
    width: Math.max(0, boxWidth - innerOffset * 2),
    height: Math.max(0, boxHeight - innerOffset * 2),
    strokeWidth: 0.9,
  };

  // Beads run the perimeter on the centre line between the two rules, spaced as
  // evenly as the side length allows so the corners always land on a bead
  // rather than half of one.
  const beadTrack = (outerOffset + innerOffset) / 2;
  const beadBox = {
    left: boxX + beadTrack,
    top: boxY + beadTrack,
    right: boxX + boxWidth - beadTrack,
    bottom: boxY + boxHeight - beadTrack,
  };
  const shapes: RashifalOrnamentShape[] = [];

  // Scalloped arcs along each rule — the toran edge devotional panels carry.
  // Each scallop is a half-circle bulging inward, so the run reads as a wave.
  const scallopRun = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    bulge: number,
  ) => {
    const span = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.round(span / 15));
    const radius = span / steps / 2;

    for (let step = 0; step < steps; step += 1) {
      const t = (step + 0.5) / steps;
      shapes.push({
        kind: "arc",
        cx: from.x + (to.x - from.x) * t,
        cy: from.y + (to.y - from.y) * t,
        radius,
        from: bulge,
        to: bulge + Math.PI,
        stroke: RASHIFAL_FRAME_STROKE,
        strokeWidth: 0.9,
      });
    }
  };

  scallopRun({ x: beadBox.left, y: beadBox.top }, { x: beadBox.right, y: beadBox.top }, 0);
  scallopRun({ x: beadBox.right, y: beadBox.bottom }, { x: beadBox.left, y: beadBox.bottom }, 0);
  scallopRun({ x: beadBox.left, y: beadBox.bottom }, { x: beadBox.left, y: beadBox.top }, Math.PI / 2);
  scallopRun({ x: beadBox.right, y: beadBox.top }, { x: beadBox.right, y: beadBox.bottom }, Math.PI / 2);

  // A lotus at each corner.
  const lotusRadius = 7.5;
  for (const corner of [
    { x: beadBox.left, y: beadBox.top },
    { x: beadBox.right, y: beadBox.top },
    { x: beadBox.left, y: beadBox.bottom },
    { x: beadBox.right, y: beadBox.bottom },
  ]) {
    shapes.push(
      ...lotusAt(corner.x, corner.y, lotusRadius, RASHIFAL_FRAME_STROKE, RASHIFAL_FRAME_ACCENT),
    );
  }

  // The kalash sits at the head of the block, centred on the top rule.
  // Sat above the top rule rather than centred on it, and sized well past the
  // frame inset: a kalash is several parts stacked, so at the frame's own width
  // it collapses into a blob. Riding high keeps the pot clear of the rule.
  shapes.push(
    ...kalashAt(
      (beadBox.left + beadBox.right) / 2,
      beadBox.top - RASHIFAL_FRAME_INSET * 0.34,
      RASHIFAL_FRAME_INSET * 1.75,
      RASHIFAL_FRAME_STROKE,
      RASHIFAL_FRAME_ACCENT,
    ),
  );

  return {
    title: { x, y, width, height: RASHIFAL_TITLE_HEIGHT, text: title },
    cells,
    frame: {
      outer,
      inner,
      shapes,
      ornaments: [
        { x: beadBox.left, y: beadBox.top, radius: 7.5, innerRadius: 3.2 },
        { x: beadBox.right, y: beadBox.top, radius: 7.5, innerRadius: 3.2 },
        { x: beadBox.left, y: beadBox.bottom, radius: 7.5, innerRadius: 3.2 },
        { x: beadBox.right, y: beadBox.bottom, radius: 7.5, innerRadius: 3.2 },
      ],
      stroke: RASHIFAL_FRAME_STROKE,
    },
  };
};
