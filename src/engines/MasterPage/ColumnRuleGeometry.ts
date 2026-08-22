/**
 * The hairline rules that run down the gutters between a story's text columns.
 *
 * Indian broadsheets — Dainik Bhaskar, Jagran, and The Cliff News' own page 8 —
 * separate columns with a thin vertical rule rather than white space alone.
 * Without them a page reads as a web layout that happens to be in columns.
 *
 * INSIDE PAGES ONLY for now. The front page and the editorial page are signed
 * off and adding rules would change every column on them, so `resolveColumnRules`
 * returns nothing unless the story carries `insidePageStyle`.
 *
 * Drawn from this one module by both renderers — the Konva canvas and the export
 * canvas — so the screen and the printed sheet cannot drift apart.
 */

/** Hairline weight and colour, matched to the box rules on the editorial page. */
export const COLUMN_RULE_WIDTH = 0.5;
export const COLUMN_RULE_COLOUR = "#B4ADA3";

/**
 * The rule stops short of the first and last line it runs beside.
 *
 * A rule flush with the copy's top and bottom reads as a box edge rather than a
 * separator; printed pages hold it back by roughly a line's ascent.
 */
const RULE_INSET_PT = 2.5;

export type ColumnRule = { x: number; top: number; bottom: number };

type ColumnLike = {
  lines?: { x: number; y: number; width: number; height: number }[];
};

/**
 * Where the rules go for one story's body.
 *
 * A rule is drawn between two neighbouring columns only over the depth where
 * BOTH of them actually carry text. That single condition is what keeps a rule
 * clear of everything it must not cross: a photograph spanning the top of the
 * box leaves the columns beneath it with no lines at that depth, a headline or a
 * banner sits above every column's first line, and a caption sits below. None of
 * them needs to be special-cased.
 */
export const getColumnRules = (columns: ColumnLike[]): ColumnRule[] => {
  // Column edges come from the LINES, not from a region rectangle. The composed
  // body columns carry their set lines but no region of their own, and every
  // line already knows the measure it was justified to.
  const spans = columns
    .map((column) => {
      const lines = column.lines ?? [];

      if (lines.length === 0) {
        return null;
      }

      return {
        left: Math.min(...lines.map((line) => line.x)),
        right: Math.max(...lines.map((line) => line.x + line.width)),
        top: Math.min(...lines.map((line) => line.y)),
        bottom: Math.max(...lines.map((line) => line.y + line.height)),
      };
    })
    .filter((span): span is NonNullable<typeof span> => span !== null)
    .sort((a, b) => a.left - b.left);

  const rules: ColumnRule[] = [];

  for (let index = 1; index < spans.length; index += 1) {
    const previous = spans[index - 1];
    const current = spans[index];

    // Neighbours only. Columns that do not actually sit side by side — the two
    // halves of a box divided by a nested sidebar, say — get no rule between
    // them, and nor do two regions of the same column stacked vertically.
    if (current.left < previous.right - 0.5) {
      continue;
    }

    const top = Math.max(previous.top, current.top) + RULE_INSET_PT;
    const bottom = Math.min(previous.bottom, current.bottom) - RULE_INSET_PT;

    // No overlap in depth means nothing sits beside anything: no rule.
    if (bottom - top < 6) {
      continue;
    }

    rules.push({ x: (previous.right + current.left) / 2, top, bottom });
  }

  return rules;
};

/**
 * The rules for a story, or none if this page does not carry them.
 *
 * Both render paths call this rather than testing the condition themselves, so
 * a column that gets a rule on screen gets one in the PDF too.
 */
export const resolveColumnRules = (story: {
  compositionSettings?: { insidePageStyle?: unknown; suppressColumnRules?: boolean } | null;
}, columns: ColumnLike[] | undefined): ColumnRule[] => {
  if (
    !story.compositionSettings?.insidePageStyle ||
    story.compositionSettings.suppressColumnRules ||
    !columns?.length
  ) {
    return [];
  }

  return getColumnRules(columns);
};

/** Paints the rules onto the export canvas. */
export const drawColumnRulesToCanvas = (
  context: CanvasRenderingContext2D,
  rules: ColumnRule[],
) => {
  if (rules.length === 0) {
    return;
  }

  context.save();
  context.strokeStyle = COLUMN_RULE_COLOUR;
  context.lineWidth = COLUMN_RULE_WIDTH;

  for (const rule of rules) {
    context.beginPath();
    context.moveTo(rule.x, rule.top);
    context.lineTo(rule.x, rule.bottom);
    context.stroke();
  }

  context.restore();
};
