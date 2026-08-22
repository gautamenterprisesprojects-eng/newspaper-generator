/**
 * The writer's rail on a signed piece, as page 8 of the printed edition sets it.
 *
 * Traced off अभिव्यक्ति: a section label, the writer's portrait filling the
 * rail's measure, a solid red plate carrying their name in white, then the
 * piece's summary set at body size and centred, bracketed by oversized
 * quotation marks. The whole stack runs down the left of the box with the copy
 * setting beside it.
 *
 * Drawn as furniture rather than composed, for the same reason as the horoscope
 * grid: the article composer flows prose and has no way to express a portrait
 * with a name plate and a quoted pull-out beside a body that wraps around it.
 *
 * Both renderers — the Konva canvas and the export canvas — read this module,
 * so the screen and the printed sheet cannot drift apart.
 *
 * EDITORIAL PAGE ONLY. Every measurement comes from `EditorialPageStyle.ts`;
 * nothing here is on a front-page or inside-page path.
 */

import {
  EDITORIAL_AUTHOR_SLOTS,
  EDITORIAL_COLOURS,
  EDITORIAL_RAIL,
  EDITORIAL_RAIL_LABEL,
  EDITORIAL_SUMMARY_SLOTS,
  getEditorialRailWidth,
  getEditorialTextColumnCount,
} from "./EditorialPageStyle";

export type AuthorBlockInput = {
  /** The story box, in page points. */
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * Where the block starts vertically inside the box — below the banner and
   * headline, which the composer has already laid out.
   */
  topOffset: number;
  /** Columns the box spans; the rail is sized against a single column. */
  columnSpan: number;
  hasSummary: boolean;
  /**
   * Where the rail must stop, in page points.
   *
   * Not simply the foot of the box. The signed comment has the feature and the
   * horoscope nested into its lower half, so a rail measured to the box foot
   * runs its summary down behind them and the copy collides with the boxes
   * below. Defaults to the box foot when nothing is nested.
   */
  contentBottom?: number;
};

export type AuthorBlockRect = { x: number; y: number; width: number; height: number };

/** Which decorative frame a rail's portrait carries. */
export type PortraitFrameKind = "doubleRule" | "cornerBrackets";

export type AuthorBlock = {
  /**
   * The frame treatment for this rail's picture.
   *
   * The leader takes the double rule, the signed comment the corner brackets —
   * two writers on one page should not be framed identically.
   */
  frameKind: PortraitFrameKind;
  /** Section label — सम्पादकीय or विचार मंथन — above the portrait. */
  label: AuthorBlockRect;
  /** Portrait, filling the rail's measure. */
  portrait: AuthorBlockRect;
  /** Solid accent plate carrying the writer's name in white. */
  namePlate: AuthorBlockRect;
  /** The ❝ that opens the quoted summary. */
  openQuote: AuthorBlockRect;
  /** Summary of the piece, body size and centred. */
  summary: AuthorBlockRect;
  /** The ❞ that closes it, tucked under the summary's last line. */
  closeQuote: AuthorBlockRect;
  /**
   * The rectangle the body must flow around — the whole rail plus its gutter.
   *
   * Handed to the composer as a reserved region so the copy divides around the
   * block instead of running underneath it.
   */
  reserved: AuthorBlockRect;
};

/**
 * Width of the author rail.
 *
 * Exactly one of the box's internal text columns for a multi-column comment —
 * see `getEditorialRailWidth` for why a partial column breaks the copy. The
 * one-column leader has no columns to spare, so its rail is the whole measure
 * and the portrait sits above the copy rather than beside it.
 */
const railWidthFor = (width: number, columnSpan: number) =>
  width / getEditorialTextColumnCount(columnSpan);

/**
 * Depth of the leader's portrait stack — headshot plus name plate.
 *
 * Shared by the reservation and the drawn geometry so the copy wraps around
 * exactly what gets painted.
 */
const leaderPortraitStackHeight = () =>
  EDITORIAL_RAIL.passportHeight +
  EDITORIAL_RAIL.portraitGap +
  EDITORIAL_RAIL.namePlateHeight;

/**
 * Depth the leader reserves from the top of its box, headline included.
 *
 * Shared by the reservation and by the drawn geometry: the stack is pinned to
 * the FOOT of this band rather than hung from the headline, so the surplus
 * between the reservation and the actual headline lands above the portrait —
 * where it reads as ordinary space under a headline — instead of below the name
 * plate, where it read as a hole. There is no summary in this rail, so the
 * plate is the last thing in it and any gap under it is conspicuous.
 */
const getLeaderReservationHeight = (boxHeight: number) =>
  Math.min(
    boxHeight * LEADER_RESERVATION_MAX_FRACTION,
    Math.min(LEADER_HEADLINE_ALLOWANCE_PT, boxHeight * LEADER_HEADLINE_ALLOWANCE_FRACTION) +
      leaderPortraitStackHeight(),
  );

/**
 * How much depth to allow for the leader's headline before its portrait.
 *
 * In POINTS, not as a share of the box. The leader box is the full depth of the
 * band — about 1120pt — so a fraction of it is a wildly wrong unit for a
 * headline: 0.17 reserved 190pt for a block that measures about 57pt, and every
 * surplus point printed as white space between the name plate and the first
 * line of copy. A two- or three-line headline in a one-column measure runs to
 * roughly 60pt; this leaves headroom for a longer one without opening a hole.
 *
 * It also sets where the copy turns under the picture, and that is why the value
 * is 76 rather than a rounder number. The copy beside the picture sits on line
 * slots one body advance (~11.9pt) apart, and a slot is only used if it fits
 * whole above the band's foot. At 68 the band fell about 8pt short of the next
 * slot, so that line was dropped AND the copy resumed at the slot after it — one
 * visibly blank row at the turn. Deepening the band to reach the slot boundary
 * recovers the line and lets the copy continue straight on.
 *
 * The relationship is a sawtooth: any value lands somewhere between nought and
 * one line of waste. This one is measured against the page the generator
 * actually produces, so retune it if the leader's body size changes.
 *
 * The fraction below is only a ceiling, so a short box cannot reserve most of
 * its own depth.
 */
const LEADER_HEADLINE_ALLOWANCE_PT = 76;
const LEADER_HEADLINE_ALLOWANCE_FRACTION = 0.125;
const LEADER_RESERVATION_MAX_FRACTION = 0.55;

/**
 * Whether a story number is one of page 8's signed pieces.
 *
 * Only सम्पादकीय and विचार मंथन carry a writer's rail. The feature, the letters
 * column and the health package all print a photograph of somebody, but none of
 * them is an author rail — see `EDITORIAL_AUTHOR_SLOTS`.
 */
export const isEditorialAuthorSlot = (storyNumber: number | undefined) =>
  storyNumber !== undefined && EDITORIAL_AUTHOR_SLOTS.has(storyNumber);

/**
 * Whether a rail carries the quoted summary under its portrait.
 *
 * Only विचार मंथन does. The सम्पादकीय leader shows a passport portrait and the
 * writer's name, then goes straight into the leader itself.
 */
export const isEditorialSummarySlot = (storyNumber: number | undefined) =>
  storyNumber !== undefined && EDITORIAL_SUMMARY_SLOTS.has(storyNumber);

/** The section label a rail prints above its portrait, if any. */
export const getEditorialRailLabel = (storyNumber: number | undefined) =>
  storyNumber === undefined ? "" : (EDITORIAL_RAIL_LABEL[storyNumber] ?? "");

/**
 * The column the body must leave free for the writer's rail.
 *
 * Reserved for the whole depth of the box rather than only for the block's own
 * height, for two reasons. The block's top depends on where the composed
 * headline ends, which is not known until after composition — and reservation
 * has to happen before it. And it is what the printed page does anyway: on page
 * 8 the comment's copy runs in the columns beside the rail all the way down,
 * rather than turning under the portrait partway.
 *
 * Returns null for a story with no author block, so nothing else reserves.
 */
export const getAuthorRailReservation = (story: {
  x: number;
  y: number;
  width: number;
  height: number;
  columnSpan?: number;
  storyNumber?: number;
}): AuthorBlockRect[] | null => {
  if (!isEditorialAuthorSlot(story.storyNumber)) {
    return null;
  }

  const columnSpan = Math.max(1, story.columnSpan ?? 1);

  if (columnSpan <= 1) {
    // The leader sets a passport-sized headshot against the left of its single
    // column with the copy wrapping around its right shoulder, so only the
    // headshot itself is reserved — not the full depth, which would leave the
    // body nowhere to go.
    //
    // Reserved from the top of the box rather than from where the portrait
    // actually lands: the portrait sits below the composed headline, whose
    // height is not known until after composition, and reservation has to
    // happen before it. Anything reserved above the body's first line simply
    // has no body in it, so over-reserving upward costs nothing, while
    // under-reserving would let a line print across the headshot. The depth is
    // therefore the headline allowance plus the whole portrait stack.
    // Two rectangles, because the leader's furniture is two different widths.
    //
    // The section label is the box's header and spans the measure, so nothing
    // may set beside it. The portrait and its name plate are only about a third
    // of the column, and the copy sets in the space to their right — which is
    // the whole point of a passport-sized headshot rather than a full-measure
    // picture.
    const total = getLeaderReservationHeight(story.height);
    const headerBand =
      total - (EDITORIAL_RAIL.passportHeight + EDITORIAL_RAIL.portraitGap + EDITORIAL_RAIL.namePlateHeight);

    return [
      {
        x: story.x,
        y: story.y,
        width: story.width,
        height: headerBand,
      },
      {
        x: story.x,
        y: story.y + headerBand,
        width:
          EDITORIAL_RAIL.padding +
          EDITORIAL_RAIL.passportHeight / EDITORIAL_RAIL.passportAspect +
          EDITORIAL_RAIL.gutter,
        height: total - headerBand,
      },
    ];
  }

  return [
    {
      x: story.x,
      y: story.y,
      // The column itself — the gutter is inside it, not added on top, or the
      // reservation would eat into the first text column and reopen the sliver.
      width: railWidthFor(story.width, columnSpan),
      height: story.height,
    },
  ];
};

/**
 * Decides whether a story gets an author block, and with what.
 *
 * Both render paths call this rather than testing the conditions themselves —
 * the Konva canvas and the export canvas must agree exactly on which boxes
 * carry a block, or a portrait would appear on screen and not in the PDF.
 *
 * Returns null for every story that is not one of page 8's signed pieces, so
 * news pages fall through to the ordinary renderer untouched.
 */
export const resolveAuthorBlock = ({
  story,
  headlineBottom,
}: {
  story: {
    x: number;
    y: number;
    width: number;
    height: number;
    columnSpan?: number;
    storyNumber?: number;
    compositionSettings?: {
      editorialPageStyle?: unknown;
      reservedRegions?: { x: number; y: number; width: number; height: number }[];
    } | null;
    articleData?: {
      editorName?: string;
      editorPortraitUrl?: string;
      editorSummary?: string;
    } | null;
  };
  /** Bottom of the composed headline block, in box-local points. */
  headlineBottom: number;
}):
  | (AuthorBlockInput & {
      contentBottom: number;
      portraitUrl: string;
      editorName: string;
      summary: string;
      label: string;
    })
  | null => {
  // Editorial pages only, and this is the test that decides it.
  //
  // `editorName` is NOT a usable signal: the store fills it on every story from
  // the wizard's byline, on every page kind, so keying off it drew a portrait
  // rail over all eight boxes of a front page — on top of the body copy, since
  // only editorial pages reserve space for the rail. `editorialPageStyle` is
  // attached to compositionSettings for `pageKind === "editorial"` and nothing
  // else, so it is the one field that actually means "this is the editorial
  // page".
  if (!story.compositionSettings?.editorialPageStyle) {
    return null;
  }

  // ...and within the editorial page, only the two signed pieces.
  if (!isEditorialAuthorSlot(story.storyNumber)) {
    return null;
  }

  const data = story.articleData;
  const portraitUrl = (data?.editorPortraitUrl ?? "").trim();
  const editorName = (data?.editorName ?? "").trim();

  // A block needs at least a portrait or a name; with neither there is nothing
  // to identify the writer with and the copy should have the full measure.
  if (!portraitUrl && !editorName) {
    return null;
  }

  return {
    x: story.x,
    y: story.y,
    width: story.width,
    height: story.height,
    contentBottom: getRailContentBottom(story),
    // The one-column leader has no visible rail label, so its portrait can
    // start on the same row as the body. The wider signed comment keeps air
    // below its label.
    topOffset: headlineBottom + (Math.max(1, story.columnSpan ?? 1) <= 1 ? 0 : 6),
    columnSpan: Math.max(1, story.columnSpan ?? 1),
    // The leader prints no pull-quote however much summary copy it carries.
    hasSummary:
      isEditorialSummarySlot(story.storyNumber) &&
      Boolean((data?.editorSummary ?? "").trim()),
    portraitUrl,
    editorName,
    summary: isEditorialSummarySlot(story.storyNumber)
      ? (data?.editorSummary ?? "").trim()
      : "",
    label: getEditorialRailLabel(story.storyNumber),
  };
};

/**
 * Where the rail has to stop.
 *
 * The comment box has the feature and the horoscope nested into its lower half.
 * Those arrive as reserved regions in page coordinates, so the top of the
 * highest one that starts below the box's own top is the floor the rail must
 * respect — otherwise the summary runs on behind them and reads as if it is
 * stuck to the boxes underneath.
 *
 * The rail's own reservation starts at the box top and is excluded by the same
 * test. With nothing nested, the answer is simply the foot of the box.
 */
const getRailContentBottom = (story: {
  y: number;
  height: number;
  compositionSettings?: {
    reservedRegions?: { x: number; y: number; width: number; height: number }[];
  } | null;
}) => {
  const boxFoot = story.y + story.height;
  const nestedTops = (story.compositionSettings?.reservedRegions ?? [])
    .map((region) => region.y)
    // A region starting at the box top is the rail's own; anything lower is a
    // box nested into this one.
    .filter((top) => top > story.y + 1 && top < boxFoot);

  if (nestedTops.length === 0) {
    return boxFoot;
  }

  return Math.min(...nestedTops) - EDITORIAL_RAIL.summaryGap;
};

/** Re-exported so the renderers draw from the same palette as the geometry. */
export const AUTHOR_RAIL_GUTTER = EDITORIAL_RAIL.gutter;
export const AUTHOR_NAME_PLATE_COLOUR = EDITORIAL_COLOURS.accent;

/**
 * Resolves the author block to concrete rectangles.
 *
 * The rail is sized from the box rather than from the portrait, so a
 * three-column comment and a one-column leader both get a rail in proportion to
 * the measure they sit in — a portrait sized the same in both would swamp the
 * narrow one.
 */
export const getAuthorBlock = ({
  x,
  y,
  width,
  height,
  topOffset,
  columnSpan,
  hasSummary,
  contentBottom,
}: AuthorBlockInput): AuthorBlock => {
  const railWidth = railWidthFor(width, columnSpan);
  const railX = x + EDITORIAL_RAIL.padding;
  const railTop = y + topOffset;
  const innerWidth = Math.max(1, railWidth - EDITORIAL_RAIL.padding - EDITORIAL_RAIL.gutter);
  const boxFoot = (contentBottom ?? y + height) - EDITORIAL_RAIL.padding;

  // The section label heads the rail, directly under the composed headline.
  //
  // Page 8 sets it at the very top of the box because its headline is inset to
  // clear the rail column. Ours spans the box's full width — reserved regions
  // steer body copy, not headlines — so a label at the box top prints straight
  // through the headline and the kicker above it.
  //
  // On the leader the whole stack is pinned to the foot of the reserved band
  // instead, so no gap can open between the name plate and the first line of
  // copy. Never above `railTop`, which would print it across the headline.
  const isLeaderRail = columnSpan <= 1;
  const labelHeight = isLeaderRail ? 0 : EDITORIAL_RAIL.labelHeight;
  const labelGap = isLeaderRail ? 0 : EDITORIAL_RAIL.labelGap;
  const leaderStackTop = isLeaderRail
    ? Math.max(
        railTop,
        y +
          getLeaderReservationHeight(height) -
          leaderPortraitStackHeight() -
          EDITORIAL_RAIL.plateClearance,
      )
    : railTop;
  const label = {
    x: railX,
    y: leaderStackTop,
    width: innerWidth,
    height: labelHeight,
  };

  // Depth left below the label. The portrait is sized against it, not just
  // against the rail width: in a shallow box a portrait squared off the width
  // alone is taller than the box has left, and the stack beneath it then runs
  // off the foot of the page.
  const portraitTop = label.y + label.height + labelGap;
  const availableDepth = Math.max(0, boxFoot - portraitTop);
  const stackBelowPortrait = EDITORIAL_RAIL.namePlateHeight + EDITORIAL_RAIL.portraitGap;

  // Portrait size comes from a stated HEIGHT, not from the rail's measure.
  //
  // Sized off the column width these came out 170–200pt deep, because a rail
  // column is wide and the aspect multiplies it. A press headshot is about 3cm,
  // so the height is stated and the width follows from the aspect; whatever
  // column width is left over becomes padding either side of the picture.
  const isPassport = isLeaderRail;
  const portraitAspect = isPassport
    ? EDITORIAL_RAIL.passportAspect
    : EDITORIAL_RAIL.portraitAspect;
  const portraitHeight = Math.max(
    0,
    Math.min(
      isPassport ? EDITORIAL_RAIL.passportHeight : EDITORIAL_RAIL.portraitHeight,
      availableDepth - stackBelowPortrait,
      // Never wider than the rail, however shallow the box.
      innerWidth * portraitAspect,
    ),
  );
  const portraitWidth = portraitHeight / portraitAspect;

  // The leader's headshot is pinned left, because its copy wraps around the
  // picture's right shoulder and a centred one would strand a sliver either
  // side of it. The comment's rail has a column to itself with no copy beside
  // the picture, so there the headshot is centred in its column.
  const portraitX = isPassport
    ? railX
    : railX + Math.max(0, (innerWidth - portraitWidth) / 2);

  const portrait = {
    x: portraitX,
    y: portraitTop,
    width: portraitWidth,
    height: portraitHeight,
  };

  // The plate is the picture's own width, so the two read as one stack rather
  // than a caption bar wider than the photograph above it.
  const namePlate = {
    x: portraitX,
    y: portrait.y + portrait.height + EDITORIAL_RAIL.portraitGap,
    width: portraitWidth,
    height: EDITORIAL_RAIL.namePlateHeight,
  };

  // Nothing below the name plate may start past the foot of the box.
  //
  // In a shallow box the portrait and plate can consume the whole depth, and
  // the quoted summary then has nowhere to go. Pinning the rest of the stack to
  // the foot collapses it to zero height there instead of letting it hang off
  // the bottom of the page — the renderers draw nothing at zero height.
  const toFoot = (value: number) => Math.min(value, boxFoot);
  const quoteDepth = hasSummary ? EDITORIAL_RAIL.quoteFontSize * 0.72 : 0;

  // The oversized quotation marks that bracket the summary. Both are centred on
  // the rail; the closing one is placed after the summary's height is known.
  const openQuoteTop = toFoot(namePlate.y + namePlate.height + EDITORIAL_RAIL.namePlateGap);
  const openQuote = {
    x: railX,
    y: openQuoteTop,
    width: innerWidth,
    height: Math.min(quoteDepth, Math.max(0, boxFoot - openQuoteTop)),
  };

  // The summary takes whatever depth is left in the rail, so it never runs past
  // the foot of the box; the renderers clip their text to it.
  const summaryTop = toFoot(openQuote.y + openQuote.height + EDITORIAL_RAIL.quoteGap);
  const summaryHeight = hasSummary
    ? Math.max(0, boxFoot - summaryTop - quoteDepth - EDITORIAL_RAIL.summaryGap)
    : 0;

  const summary = {
    x: railX,
    y: summaryTop,
    width: innerWidth,
    height: summaryHeight,
  };

  const closeQuoteTop = toFoot(summary.y + summary.height + EDITORIAL_RAIL.summaryGap);
  const closeQuote = {
    x: railX,
    y: closeQuoteTop,
    width: innerWidth,
    height: Math.min(quoteDepth, Math.max(0, boxFoot - closeQuoteTop)),
  };

  const blockBottom = hasSummary
    ? closeQuote.y + closeQuote.height
    : namePlate.y + namePlate.height;

  return {
    frameKind: isPassport ? "doubleRule" : "cornerBrackets",
    label,
    portrait,
    namePlate,
    openQuote,
    summary,
    closeQuote,
    reserved: {
      x,
      y: railTop,
      width: railWidth,
      height: Math.max(0, blockBottom - railTop),
    },
  };
};
