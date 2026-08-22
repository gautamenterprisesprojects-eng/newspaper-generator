/**
 * Every value that is specific to the editorial page, in one place.
 *
 * The editorial page is traced off page 8 of the printed edition — अभिव्यक्ति —
 * whose grid, colour and furniture differ from the news pages in almost every
 * respect. Rather than thread `pageKind === "editorial"` conditionals through
 * the shared engines, all of it is collected here and read only by code that
 * has already established it is drawing the editorial page.
 *
 * The rule this module exists to enforce: **nothing here may be imported by a
 * front-page or inside-page path.** If a value is needed on both, it belongs in
 * the shared defaults, not in this file. That keeps the blast radius of an
 * editorial tweak provably zero for every other page.
 *
 * Measurements come from a 3300×4500 scan of page 8, whose printed sheet
 * occupies x 1052..3140 (2088px) and y 250..3480 (3230px). Ratios below are
 * quoted against those.
 */

/**
 * Page 8 is set on FOUR columns, not the six the news pages use.
 *
 * Measured from the gutters between text columns: the major box edges fall at
 * 1052 / 1576 / 2103 / 2646 / 3140, four divisions of ~522px. Every box on the
 * page is a whole number of those columns — 1+3 across the top, 1+2+1 through
 * the middle, 2+1+1 along the foot. On a six-column grid the same page needs
 * 1.5-column units, which is why the earlier approximation never lined up.
 */
export const EDITORIAL_COLUMN_COUNT = 5;

/**
 * Which slots carry a signed writer's rail.
 *
 * On page 8 exactly two boxes do: सम्पादकीय, the full-depth leader down the
 * left, and विचार मंथन, the rail of the big signed comment. The wide feature,
 * the letters column and the health box all carry a photograph of somebody, but
 * none of them is an author rail — the feature runs a plain byline line, the
 * letters run a name-and-place block, and the health box uses a bordered expert
 * card. Putting a rail on all of them, as the first cut did, reads as a
 * template applied blindly rather than a page that was designed.
 *
 * Keyed by story number within `CliffEditorial8A`.
 */
export const EDITORIAL_AUTHOR_SLOTS = new Set<number>([1, 2]);

/**
 * Which of those rails carry the quoted summary.
 *
 * Only विचार मंथन. The सम्पादकीय leader is one column wide and prints a small
 * passport-sized portrait with the writer's name under it and nothing else —
 * its whole measure is needed for the leader itself, and a pull-quote in a
 * column that narrow would leave no room for the argument.
 */
export const EDITORIAL_SUMMARY_SLOTS = new Set<number>([2]);

/** The section label printed above each rail, by story number. */
export const EDITORIAL_RAIL_LABEL: Record<number, string> = {
  1: "", // Moved to kicker for red border styling above headline
  2: "विचार मंथन",
};

/**
 * Band depths and column splits, stated against the five-column grid.
 *
 *   top     1 │ 4                 leader │ signed comment (rail + 3 text)
 *   middle  1 │ 3 │ 1             leader │ feature │ आज का राशिफल
 *   foot    3 │ 1 │ 1             health │ voices  │ letters
 */

/**
 * Band depths, as a share of the content height.
 *
 * The top band carries the leader and the signed comment and runs to y≈2913 of
 * 3480 — a little over four fifths of the page. The foot band takes the rest.
 */
export const EDITORIAL_ROW_RHYTHM = {
  topRatio: 0.8,
  footRatio: 0.2,
  topMinimumHeight: 430,
  footMinimumHeight: 150,
} as const;

/**
 * Where the middle band begins inside the top band.
 *
 * The signed comment ends and the feature's headline starts at y≈1627, which is
 * 0.53 of the way down the top band (250..2913). The feature and the horoscope
 * are nested into the comment at that depth.
 */
export const EDITORIAL_MIDDLE_BAND_TOP_FRACTION = 0.53;

/** Colours, sampled from the printed sheet. */
export const EDITORIAL_COLOURS = {
  /** The masthead strip and the display headlines on signed pieces. */
  accent: "#C8102E",
  /** White type on the accent, as the name plates are set. */
  onAccent: "#FFFFFF",
  /** Body and headline black. */
  ink: "#1A1A1A",
  /** The hairline that frames each box. */
  boxRule: "#231F20",
  /** The oversized quotation marks that bracket a rail's summary. */
  quoteGlyph: "#9A9086",
  /** Cream wash behind the leader box. */
  leaderWash: "#FBF4E4",
} as const;

/**
 * A box is composed on exactly as many internal columns as it spans.
 *
 * With the rail counted as a page column, the signed comment spans four —
 * rail plus three text columns — and dividing the box into four gives the rail
 * a whole column with nothing left over. See `EDITORIAL_COLUMN_COUNT` for why a
 * partial column wrecks the copy.
 */
export const getEditorialTextColumnCount = (columnSpan: number) =>
  columnSpan <= 1 ? EDITORIAL_LEADER_TEXT_COLUMNS : Math.max(1, columnSpan);

/**
 * The leader is composed on ONE column, with its portrait above the copy.
 *
 * Page 8 wraps the leader's copy around the portrait's right shoulder, and two
 * columns would reproduce that — but they cannot exist here. The leader is one
 * of five page columns, about 200pt, so two columns work out at 89pt each and
 * the composer's readability floor (`MIN_BODY_COLUMN_WIDTH`, 120pt) collapses
 * them straight back to one. The reservation then covered half of that single
 * column, left an 85pt sliver, and the copy came out as isolated words strung
 * across the measure.
 *
 * So the portrait takes the full column width and the copy runs beneath it.
 * Wrapping would need either a wider leader or a lower readability floor, and
 * the floor is shared with every news page.
 */
export const EDITORIAL_LEADER_TEXT_COLUMNS = 1;

export const getEditorialRailWidth = (boxWidth: number, columnSpan: number) =>
  boxWidth / getEditorialTextColumnCount(columnSpan);

/** The writer's rail — portrait, name plate and quoted summary. */
export const EDITORIAL_RAIL = {
  /** Section label above the portrait. */
  labelFontSize: 15,
  labelHeight: 22,
  labelGap: 8,
  /**
   * Portrait size, driven by HEIGHT rather than by the rail's measure.
   *
   * Sizing off the column width made the portraits 170–200pt deep — a third of
   * the leader's whole box — because a rail column is wide and the aspect then
   * multiplies it. A press headshot is about 3cm; these are stated at that and
   * the width follows from the aspect, with the leftover column width taken up
   * as left/right padding so the picture keeps its proportions.
   */
  portraitHeight: 86,
  portraitAspect: 1.02,
  portraitGap: 5,
  /** The leader's passport headshot is smaller again, and slightly taller than wide. */
  passportHeight: 74,
  passportAspect: 1.24,
  /** Solid accent plate carrying the writer's name in white. */
  namePlateHeight: 19,
  namePlateFontSize: 10.5,
  /**
   * Air between the name plate and the opening quotation mark.
   *
   * A quote glyph sits high in its em box, so the mark's ink starts almost at
   * the top of the band reserved for it. At 7pt the mark landed against the
   * writer's name and read as part of it.
   */
  namePlateGap: 13,
  /** The ❝ ❞ pair that brackets the summary. */
  quoteFontSize: 34,
  quoteGap: 6,
  /**
   * The summary is set at body size and centred — on the page it reads as a
   * pull-quote, not a caption, and runs the full depth of the rail.
   */
  summaryFontSize: 9.2,
  summaryLineHeight: 1.42,
  summaryGap: 6,
  /**
   * The summary is set slightly bold and italic — it is a pull-quote, and the
   * weight and slope are what separate it from the body copy set around it.
   */
  summaryFontStyle: "italic 600",
  /**
   * Gap between the rail and the copy beside it.
   *
   * 5pt, not 9. At a 60pt-wide passport headshot a 9pt gutter reads as a hole
   * beside the picture — it is a sixth of the picture's own width.
   */
  gutter: 5,
  /**
   * Clearance between the foot of the name plate and the copy that turns under
   * it.
   *
   * The stack is pinned to the foot of its reserved band and the copy resumes at
   * that same point, so with no allowance the first full-width line sits hard
   * against the plate's bottom edge. This lifts the stack rather than deepening
   * the band, so the copy still resumes on the same line slot — deepening it
   * would push the copy to the next slot and reopen the blank row.
   */
  plateClearance: 5,
  padding: 5,
} as const;

/**
 * The photograph on a signed comment.
 *
 * Page 8 sets it exactly one text column wide, in the middle column of the
 * article portion, with copy running down both sides — not spanning two columns
 * and not centred on the whole box, which would put it under the rail.
 */
export const EDITORIAL_IMAGE = {
  columnSpan: 1,
  alignment: "top-center" as const,
  /**
   * Height in points.
   *
   * Deliberately modest: on page 8 the photograph is a single column wide and
   * roughly square, occupying maybe a fifth of the box's depth. Left to the
   * priority preset it came out tall enough to push the copy into a thin band
   * down each side.
   */
  height: 150,
} as const;

/**
 * Gutter between an editorial box's own text columns.
 *
 * The shared composer sets 6.05pt, which is tight for the editorial page: its
 * columns are narrower than a news page's and the copy ran together. 11pt gives
 * the columns visible air without stealing a character from the measure.
 */
export const EDITORIAL_COLUMN_GAP = 11.05;

/**
 * The frame drawn around each writer's portrait.
 *
 * The two rails carry deliberately different treatments — page 8's furniture is
 * designed box by box rather than stamped from one template, and two identical
 * frames on one page read as a repeated element rather than two writers.
 *
 * `doubleRule` — सम्पादकीय: a hairline outer rule with a second rule set inside
 * it, the classic obituary/leader portrait treatment.
 * `cornerBrackets` — विचार मंथन: no continuous frame, just an L at each corner,
 * which reads as a modern comment-page device.
 */
export const EDITORIAL_PORTRAIT_FRAME = {
  doubleRule: {
    outerWidth: 0.9,
    innerWidth: 0.5,
    innerInset: 3.2,
    colour: "#2A2622",
  },
  cornerBrackets: {
    width: 1.6,
    /** Arm length, as a share of the shorter side of the picture. */
    armFraction: 0.28,
    /** How far the bracket sits outside the picture's edge. */
    offset: 2.6,
    colour: "#C8102E",
  },
} as const;

/** The hairline box frame every editorial package carries. */
export const EDITORIAL_BOX_RULE_WIDTH = 0.9;

/** Inset from the box edge to its content, inside the frame. */
export const EDITORIAL_BOX_PADDING = 7;

/**
 * Copy fills each box to its foot.
 *
 * A printed editorial page has no white space at the bottom of a box — the
 * sub-editor cuts or pads until the column bottoms align. Turning the
 * composer's breathing space off and letting it justify vertically is what
 * reproduces that.
 */
export const EDITORIAL_FILL_TO_FOOT = {
  articleEndBreathingSpaceEnabled: false,
} as const;

/**
 * Word tier requested for an editorial box, and the span at which it applies.
 *
 * Page 8 is a four-column sheet, so a two-column box is already half the page.
 * Asking the feed for its longest tier is what actually fills a box — stretching
 * the leading to close the gap instead just spaces the type out visibly.
 */
export const EDITORIAL_FILL_WORD_TIER = 1000;
export const EDITORIAL_FILL_MIN_COLUMN_SPAN = 2;

/** House style for the copy itself, as page 8 sets it. */
export const EDITORIAL_ARTICLE_STYLE = {
  /** Page 8 carries no bylines on signed pieces — the rail names the writer. */
  suppressByline: true,
  /** No bulleted subheadings inside the running copy. */
  suppressInlineSubheadings: true,
  /** No reversed subheadline banner — page 8 carries none anywhere. */
  suppressSubheadline: true,
  /**
   * Reclaim most of the headline's trailing leading and its frame padding.
   *
   * Editorial headlines are the largest type on any page, so the leftover below
   * the last row of glyphs is the widest. Keep a little of it in place, though:
   * the editorial page has dense neighboring boxes, and full reclamation lets
   * the running copy touch the headline ink after baseline snapping.
   */
  headlineTrailingLeadingTrim: 0.95,
  /**
   * Small but real clearance from the headline into the argument.
   *
   * The earlier negative value looked tight on isolated boxes, but after the
   * current editorial furniture and baseline snapping it made body copy stick
   * to the headline. Four points keeps the page compact without collision.
   */
  headlineToBodyGap: -4,
} as const;
