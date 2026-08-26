/**
 * The hairline frame around each package on the editorial page.
 *
 * Page 8 rules every box — the leader, the signed comment, the feature, the
 * horoscope, the health package, the voices and letters columns. The news pages
 * separate stories with white space and the occasional divider instead, so this
 * is editorial-only furniture.
 *
 * Drawn from one geometry by both renderers — the Konva canvas and the export
 * canvas — so the screen and the printed sheet cannot drift apart.
 *
 * EDITORIAL PAGE ONLY. Read `EditorialPageStyle.ts` for every measurement;
 * nothing here is on a front-page or inside-page path.
 */

import { EDITORIAL_BOX_RULE_WIDTH, EDITORIAL_COLOURS } from "./EditorialPageStyle";

export type EditorialBoxRule = {
  x: number;
  y: number;
  width: number;
  height: number;
  strokeWidth: number;
  stroke: string;
};

/**
 * The frame for one story box, or null if this box should not carry one.
 *
 * The rule is inset by half its own width so the stroke sits inside the box
 * rather than straddling its edge — a stroke centred on the boundary would
 * overlap the neighbouring box's frame and print as a double-weight line.
 */
export const resolveEditorialBoxRule = (story: {
  x: number;
  y: number;
  width: number;
  height: number;
  compositionSettings?: { editorialPageStyle?: unknown } | null;
}): EditorialBoxRule | null => {
  // Editorial pages only — the same gate the writer's rail uses.
  if (!story.compositionSettings?.editorialPageStyle) {
    return null;
  }

  if ((story.compositionSettings as { editorialTemplateId?: string }).editorialTemplateId === "AkhandEditorial5A") {
    return null;
  }

  if (story.width <= 0 || story.height <= 0) {
    return null;
  }

  const inset = EDITORIAL_BOX_RULE_WIDTH / 2;

  return {
    x: story.x + inset,
    y: story.y + inset,
    width: Math.max(0, story.width - EDITORIAL_BOX_RULE_WIDTH),
    height: Math.max(0, story.height - EDITORIAL_BOX_RULE_WIDTH),
    strokeWidth: EDITORIAL_BOX_RULE_WIDTH,
    stroke: EDITORIAL_COLOURS.boxRule,
  };
};

/** Paints the frame onto the export canvas. */
export const drawEditorialBoxRuleToCanvas = (
  context: CanvasRenderingContext2D,
  rule: EditorialBoxRule,
) => {
  context.save();
  context.strokeStyle = rule.stroke;
  context.lineWidth = rule.strokeWidth;
  context.strokeRect(rule.x, rule.y, rule.width, rule.height);
  context.restore();
};
