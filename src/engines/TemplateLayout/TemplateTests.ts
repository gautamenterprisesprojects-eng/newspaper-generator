import { DEFAULT_PAGE_MASTER } from "@/types/page";
import { POINTS_PER_INCH } from "@/utils/page";
import { calculatePageLayoutDiagnostics, generateTemplateLayout } from "./TemplateLayoutEngine";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const toPoints = (inches: number) => inches * POINTS_PER_INCH;

const layout = generateTemplateLayout({
  templateId: "FrontPage5A",
  pageWidth: toPoints(DEFAULT_PAGE_MASTER.width),
  contentX: toPoints(DEFAULT_PAGE_MASTER.contentX),
  contentY: toPoints(DEFAULT_PAGE_MASTER.contentY),
  contentWidth: toPoints(DEFAULT_PAGE_MASTER.contentWidth),
  contentHeight: toPoints(DEFAULT_PAGE_MASTER.contentHeight),
  columnCount: DEFAULT_PAGE_MASTER.columns,
  gutter: toPoints(DEFAULT_PAGE_MASTER.gutter),
});

const contentBounds = {
  x: toPoints(DEFAULT_PAGE_MASTER.contentX),
  y: toPoints(DEFAULT_PAGE_MASTER.contentY),
  width: toPoints(DEFAULT_PAGE_MASTER.contentWidth),
  height: toPoints(DEFAULT_PAGE_MASTER.contentHeight),
};

const rangesOverlap = (startA: number, endA: number, startB: number, endB: number) =>
  Math.max(startA, startB) < Math.min(endA, endB);

const rectsOverlap = (
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
) =>
  rangesOverlap(first.x, first.x + first.width, second.x, second.x + second.width) &&
  rangesOverlap(first.y, first.y + first.height, second.y, second.y + second.height);

assert(layout.storyCount === 5, "FrontPage5A must create 5 stories");
assert(layout.slots.length === 5, "FrontPage5A must return 5 slots");

for (const slot of layout.slots) {
  assert(slot.x >= contentBounds.x, `story ${slot.storyNumber} must be inside left page bound`);
  assert(slot.y >= contentBounds.y, `story ${slot.storyNumber} must be inside top page bound`);
  assert(
    slot.x + slot.width <= contentBounds.x + contentBounds.width + 0.001,
    `story ${slot.storyNumber} must be inside right page bound`,
  );
  assert(
    slot.y + slot.height <= contentBounds.y + contentBounds.height + 0.001,
    `story ${slot.storyNumber} must be inside bottom page bound`,
  );
}

for (let firstIndex = 0; firstIndex < layout.slots.length; firstIndex += 1) {
  for (let secondIndex = firstIndex + 1; secondIndex < layout.slots.length; secondIndex += 1) {
    assert(
      !rectsOverlap(layout.slots[firstIndex], layout.slots[secondIndex]),
      `story ${layout.slots[firstIndex].storyNumber} must not overlap story ${layout.slots[secondIndex].storyNumber}`,
    );
  }
}

const rowCoverage = new Map<number, { left: number; right: number }>();

for (const slot of layout.slots) {
  const coverage = rowCoverage.get(slot.y) ?? {
    left: Infinity,
    right: -Infinity,
  };

  rowCoverage.set(slot.y, {
    left: Math.min(coverage.left, slot.x),
    right: Math.max(coverage.right, slot.x + slot.width),
  });
}

for (const coverage of rowCoverage.values()) {
  assert(Math.abs(coverage.left - contentBounds.x) < 0.001, "each row must start at content left");
  assert(
    Math.abs(coverage.right - (contentBounds.x + contentBounds.width)) < 0.001,
    "each row must use full content width",
  );
}

const priorities = layout.slots.map((slot) => slot.priority);
assert(priorities[0] === "lead", "story 1 must be lead");
assert(priorities[1] === "major", "story 2 must be major");
assert(priorities[2] === "secondary", "story 3 must be secondary");
assert(priorities[3] === "secondary", "story 4 must be secondary");
assert(priorities[4] === "major", "story 5 must be major");

const firstRow = layout.slots[0];
const secondRow = layout.slots[1];
const thirdRow = layout.slots[3];
const contentArea = contentBounds.width * contentBounds.height;
const firstGap = secondRow.y - (firstRow.y + firstRow.height);
const secondGap = thirdRow.y - (secondRow.y + secondRow.height);

assert(
  firstGap >= 6 && firstGap <= 10,
  "lead-major row gap must use editorial spacing",
);
assert(
  secondGap >= 4 && secondGap <= 8,
  "major-secondary row gap must use editorial spacing",
);
assert(
  Math.abs(thirdRow.y + thirdRow.height - (contentBounds.y + contentBounds.height)) < 0.001,
  "last row must reach content bottom",
);

assert(
  firstRow.height / contentBounds.height >= 0.39 &&
    firstRow.height / contentBounds.height <= 0.5,
  "lead row must occupy the 40-50% newspaper band",
);
assert(firstRow.height > secondRow.height, "lead row must dominate row height");
assert(
  Math.abs(thirdRow.height - secondRow.height) < 0.001,
  "major rows must share the remaining page rhythm",
);
assert(
  (secondRow.height * (4 / 6)) / contentBounds.height >= 0.19 &&
    (secondRow.height * (4 / 6)) / contentBounds.height <= 0.25,
  "major story area must land in the 20-25% editorial band",
);

const diagnostics = calculatePageLayoutDiagnostics({
  stories: layout.slots,
  imageAreas: layout.slots.map((slot) => slot.width * slot.height * 0.25),
  contentArea,
  contentHeight: contentBounds.height,
});

assert(diagnostics.pageFillPercent > 98, "template must fill content area while reserving row gaps");
assert(
  diagnostics.unusedArea < contentArea * 0.02,
  "template must not leave visible unused content bands",
);
assert(diagnostics.averageRowGap < 12, "average row gap must stay below 12px");
assert(diagnostics.largestRowGap < 20, "largest row gap must stay below 20px");
assert(diagnostics.rowDensityPercent > 98, "row density must remain newspaper-tight");
assert(diagnostics.largestStoryPercent >= 29, "lead story must dominate page area");
assert(diagnostics.smallestStoryPercent < diagnostics.largestStoryPercent, "story sizes must vary");
assert(diagnostics.whitespacePercent < 15, "production whitespace must stay below 15%");
assert(diagnostics.pageUtilizationPercent > 85, "production utilization must exceed 85%");
assert(diagnostics.editorialDensityPercent > 0, "editorial density must be reported");
assert(diagnostics.imageDensityPercent > 0, "image density must be reported");

const professionalLayout = generateTemplateLayout({
  templateId: "ProfessionalNews10A",
  pageWidth: toPoints(DEFAULT_PAGE_MASTER.width),
  contentX: toPoints(DEFAULT_PAGE_MASTER.contentX),
  contentY: toPoints(DEFAULT_PAGE_MASTER.contentY),
  contentWidth: toPoints(DEFAULT_PAGE_MASTER.contentWidth),
  contentHeight: toPoints(DEFAULT_PAGE_MASTER.contentHeight),
  columnCount: DEFAULT_PAGE_MASTER.columns,
  gutter: toPoints(DEFAULT_PAGE_MASTER.gutter),
});

assert(professionalLayout.storyCount === 9, "ProfessionalNews10A must create exactly 9 stories matching PDF scan");
assert(professionalLayout.slots.length === 9, "ProfessionalNews10A must return 9 slots");
assert(professionalLayout.slots[0].columnSpan === 1, "Story 1 (sidebar top item) must span 1 column on left");
assert(professionalLayout.slots[1].columnSpan === 5, "Story 2 (lead story) must span 5 columns across main right area");
assert(professionalLayout.slots[4].columnSpan === 1, "Story 5 (sidebar third item) must continue column 1 vertically");
assert(professionalLayout.slots[5].columnSpan === 2, "Story 6 (weather story) must span 2 columns");

// ── Phase 1.6 priority-band invariants ─────────────────────────────────────
// Verify every registered template obeys the two rules documented at the top
// of TemplateRegistry.ts:
//   1. Exactly one lead slot per template.
//   2. The lead's row contains no multi-column brief/filler slot. A
//      columnSpan=1 brief in the lead's row is allowed — that's a legitimate
//      side-rail element (as seen in TOI / Dainik Bhaskar hero-rail
//      patterns). Multi-column briefs in the same row as the lead would
//      visually compete with the main headline and are forbidden.
import { TEMPLATE_REGISTRY } from "./TemplateRegistry";

for (const [templateId, template] of Object.entries(TEMPLATE_REGISTRY)) {
  const leadSlots = template.slots.filter((slot) => slot.priority === "lead");
  assert(
    leadSlots.length === 1,
    `${templateId}: must have exactly 1 lead slot (found ${leadSlots.length})`,
  );

  const leadRow = leadSlots[0].row;
  const wideSideStoriesInLeadRow = template.slots.filter(
    (slot) =>
      slot.row === leadRow &&
      (slot.priority === "brief" || slot.priority === "filler") &&
      slot.columnSpan > 1,
  );
  assert(
    wideSideStoriesInLeadRow.length === 0,
    `${templateId}: brief/filler slots in the lead row must be 1-column rail slots ` +
      `(story ${wideSideStoriesInLeadRow[0]?.storyNumber} spans ${wideSideStoriesInLeadRow[0]?.columnSpan})`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Front-page catalogue
// ─────────────────────────────────────────────────────────────────────────────
import {
  EDITORIAL_PAGE_TEMPLATE_IDS,
  FRONT_PAGE_TEMPLATE_IDS,
  getTemplateColumnCount,
  isEditorialPageTemplate,
  isFrontPageTemplate,
} from "./TemplateRegistry";
import { FRONT_HEADER_HEIGHT_PT } from "@/engines/HeaderSystem/HeaderGeometry";

assert(FRONT_PAGE_TEMPLATE_IDS.length > 0, "there must be at least one front-page template");

for (const frontTemplateId of FRONT_PAGE_TEMPLATE_IDS) {
  assert(
    Boolean(TEMPLATE_REGISTRY[frontTemplateId]),
    `${frontTemplateId}: front-page template must exist in the registry`,
  );
  assert(isFrontPageTemplate(frontTemplateId), `${frontTemplateId}: must report as front-page only`);

  // Front pages are laid out inside the content box the store hands them, which
  // already starts below the masthead band. Nothing may creep above it.
  const contentY = Math.max(contentBounds.y, FRONT_HEADER_HEIGHT_PT);
  const frontLayout = generateTemplateLayout({
    templateId: frontTemplateId,
    pageWidth: toPoints(DEFAULT_PAGE_MASTER.width),
    contentX: contentBounds.x,
    contentY,
    contentWidth: contentBounds.width,
    contentHeight: contentBounds.y + contentBounds.height - contentY,
    columnCount: getTemplateColumnCount(frontTemplateId, DEFAULT_PAGE_MASTER.columns),
    gutter: toPoints(DEFAULT_PAGE_MASTER.gutter),
  });

  assert(
    frontLayout.slots.every((slot) => slot.y >= FRONT_HEADER_HEIGHT_PT - 0.01),
    `${frontTemplateId}: every story box must start below the ${FRONT_HEADER_HEIGHT_PT}pt masthead band`,
  );
  assert(
    frontLayout.slots.length === TEMPLATE_REGISTRY[frontTemplateId].storyCount,
    `${frontTemplateId}: slot count must match the declared story count`,
  );
  assert(
    Math.abs(
      Math.max(...frontLayout.slots.map((slot) => slot.y + slot.height)) -
        (contentBounds.y + contentBounds.height),
    ) < 1,
    `${frontTemplateId}: the last row must reach the bottom of the content box`,
  );
}

// ── Peer columns must fill the grid; nested slots are not peers ──────────────
for (const [templateId, template] of Object.entries(TEMPLATE_REGISTRY)) {
  const peers = template.slots.filter((slot) => !slot.insetInto);
  const rows = new Map<number, number>();

  for (const slot of peers) {
    rows.set(slot.row, (rows.get(slot.row) ?? 0) + slot.columnSpan);
  }

  // Against the template's own grid: news layouts are all six columns, the
  // editorial page is traced off a four-column printed sheet.
  const gridColumns = template.columnCount ?? 6;

  for (const [row, span] of rows) {
    assert(
      span === gridColumns,
      `${templateId}: row ${row} peer columns must sum to ${gridColumns} (got ${span})`,
    );
  }

  for (const slot of template.slots) {
    if (!slot.insetInto) continue;

    const parent = template.slots.find((c) => c.storyNumber === slot.insetInto!.parentStoryNumber);
    assert(Boolean(parent), `${templateId}: story ${slot.storyNumber} insets into a missing parent`);
    assert(!parent!.insetInto, `${templateId}: story ${slot.storyNumber} insets into another nested slot`);
    assert(
      slot.row === parent!.row,
      `${templateId}: story ${slot.storyNumber} must be inset into a slot in its own row`,
    );
    assert(
      slot.columnStart >= parent!.columnStart &&
        slot.columnStart + slot.columnSpan <= parent!.columnStart + parent!.columnSpan,
      `${templateId}: story ${slot.storyNumber} must sit within its parent's columns`,
    );
    assert(
      slot.insetInto!.topFraction > 0 && slot.insetInto!.topFraction < 1,
      `${templateId}: story ${slot.storyNumber} topFraction must be between 0 and 1`,
    );
  }
}

// ── CliffFront11A band A: 1 │ 3 │ 2 peers with the sidebar nested in the lead ─
{
  const contentY = Math.max(contentBounds.y, FRONT_HEADER_HEIGHT_PT);
  const front = generateTemplateLayout({
    templateId: "CliffFront11A",
    pageWidth: toPoints(DEFAULT_PAGE_MASTER.width),
    contentX: contentBounds.x,
    contentY,
    contentWidth: contentBounds.width,
    contentHeight: contentBounds.y + contentBounds.height - contentY,
    columnCount: DEFAULT_PAGE_MASTER.columns,
    gutter: toPoints(DEFAULT_PAGE_MASTER.gutter),
  });
  const bySlot = new Map(front.slots.map((slot) => [slot.storyNumber, slot]));
  const rail = bySlot.get(1)!;
  const lead = bySlot.get(2)!;
  const sidebar = bySlot.get(3)!;
  const second = bySlot.get(4)!;

  assert(lead.columnSpan === 3, `lead must span 3 columns, got ${lead.columnSpan}`);
  assert(lead.priority === "lead", "story 2 must be the lead");
  assert(sidebar.insetParentStoryNumber === 2, "the sidebar must report the lead as its parent");
  assert(rail.insetParentStoryNumber === undefined, "the rail is a peer, not a nested box");

  // The sidebar sits inside the lead's rectangle, below its headline block.
  assert(sidebar.y > lead.y, "the sidebar must start below the lead's top edge");
  assert(
    Math.abs(sidebar.y + sidebar.height - (lead.y + lead.height)) < 0.01,
    "the sidebar must run to the foot of the lead box",
  );
  assert(
    sidebar.x >= lead.x && sidebar.x + sidebar.width <= lead.x + lead.width + 0.01,
    "the sidebar must sit within the lead's horizontal span",
  );

  // Nesting must not disturb the row: the lead and its peers still share a top
  // edge and height, and the peers still tile the full content width.
  assert(Math.abs(rail.y - lead.y) < 0.01 && Math.abs(second.y - lead.y) < 0.01, "row 1 peers must share a top edge");
  assert(
    Math.abs(rail.height - lead.height) < 0.01 && Math.abs(second.height - lead.height) < 0.01,
    "row 1 peers must share a height",
  );
  assert(
    Math.abs(second.x + second.width - (contentBounds.x + contentBounds.width)) < 0.01,
    "row 1 peers must reach the right edge of the content box",
  );
}

// ── CliffFront8A: eight boxes, with rows 1 and 3 matching CliffFront11A ───────
{
  const contentY = Math.max(contentBounds.y, FRONT_HEADER_HEIGHT_PT);
  const geometry = {
    pageWidth: toPoints(DEFAULT_PAGE_MASTER.width),
    contentX: contentBounds.x,
    contentY,
    contentWidth: contentBounds.width,
    contentHeight: contentBounds.y + contentBounds.height - contentY,
    columnCount: DEFAULT_PAGE_MASTER.columns,
    gutter: toPoints(DEFAULT_PAGE_MASTER.gutter),
  };
  const front = generateTemplateLayout({ templateId: "CliffFront8A", ...geometry });
  const eleven = generateTemplateLayout({ templateId: "CliffFront11A", ...geometry });

  assert(front.slots.length === 8, `CliffFront8A must place 8 boxes, got ${front.slots.length}`);

  const bySlot = new Map(front.slots.map((slot) => [slot.storyNumber, slot]));
  const midWide = bySlot.get(4)!;
  const midNarrow = bySlot.get(5)!;
  const midCompanion = bySlot.get(6)!;

  // The mid band is one row split 3 │ 1 │ 2.
  assert(midWide.columnSpan === 3, `mid-lead must span 3 columns, got ${midWide.columnSpan}`);
  assert(midNarrow.columnSpan === 1, `mid brief must span 1 column, got ${midNarrow.columnSpan}`);
  assert(
    midCompanion.columnSpan === 2,
    `mid companion must span 2 columns, got ${midCompanion.columnSpan}`,
  );
  const midBand = [midWide, midNarrow, midCompanion];
  for (const box of midBand) {
    assert(Math.abs(box.y - midWide.y) < 0.01, "the mid band's boxes must share a top edge");
    assert(
      Math.abs(box.height - midWide.height) < 0.01,
      "the mid band's boxes must share a height",
    );
  }
  // Left to right, no overlaps, tiling the full content width.
  assert(
    Math.abs(midWide.x - contentBounds.x) < 0.01,
    "the mid band must start at the left edge of the content box",
  );
  assert(
    midNarrow.x >= midWide.x + midWide.width - 0.01,
    "the mid brief must sit to the right of the mid-lead",
  );
  assert(
    midCompanion.x >= midNarrow.x + midNarrow.width - 0.01,
    "the mid companion must sit to the right of the mid brief",
  );
  assert(
    Math.abs(midCompanion.x + midCompanion.width - (contentBounds.x + contentBounds.width)) < 0.01,
    "the mid band must reach the right edge of the content box",
  );

  // No box on this page is nested inside another — the 8-box page drops the
  // boxed sidebar that CliffFront11A insets into its lead.
  for (const slot of front.slots) {
    assert(
      slot.insetParentStoryNumber === undefined,
      `CliffFront8A story ${slot.storyNumber} must not be nested in another box`,
    );
  }

  // The top package keeps CliffFront11A's 1 │ 3 │ 2 peer geometry. The lead is
  // the same rectangle in both; only the nested sidebar is gone.
  const elevenBySlot = new Map(eleven.slots.map((slot) => [slot.storyNumber, slot]));
  const samePeer = (a: (typeof front.slots)[number], b: (typeof front.slots)[number]) =>
    Math.abs(a.x - b.x) < 0.01 &&
    Math.abs(a.y - b.y) < 0.01 &&
    Math.abs(a.width - b.width) < 0.01 &&
    Math.abs(a.height - b.height) < 0.01;
  assert(samePeer(bySlot.get(1)!, elevenBySlot.get(1)!), "the rail must match CliffFront11A");
  assert(samePeer(bySlot.get(2)!, elevenBySlot.get(2)!), "the lead must match CliffFront11A");
  assert(
    samePeer(bySlot.get(3)!, elevenBySlot.get(4)!),
    "the second story must match CliffFront11A's 2-column peer",
  );
  assert(bySlot.get(2)!.columnSpan === 3, "the lead must keep its three-column measure");

  // The bottom package keeps its 1 │ 5 shape.
  assert(bySlot.get(7)!.columnSpan === 1, "the cartoon rail must stay one column");
  assert(bySlot.get(8)!.columnSpan === 5, "the bottom package must span the remaining five columns");

  // Bands must tile the page top to bottom without overlapping.
  assert(
    midWide.y >= bySlot.get(2)!.y + bySlot.get(2)!.height - 0.01,
    "the mid band must start below the top package",
  );
  assert(
    bySlot.get(8)!.y >= midWide.y + midWide.height - 0.01,
    "the bottom package must start below the mid band",
  );
}

// ── Front-page catalogue: enough choice, and genuinely different shapes ──────
{
  assert(
    FRONT_PAGE_TEMPLATE_IDS.length >= 12,
    `the front-page tab must offer at least 12 designs (found ${FRONT_PAGE_TEMPLATE_IDS.length})`,
  );

  // Two templates that place the same spans in the same rows are the same page
  // wearing two names — the catalogue is meant to be a choice of shape.
  const shapeSignatures = new Map<string, string>();
  for (const templateId of FRONT_PAGE_TEMPLATE_IDS) {
    const template = TEMPLATE_REGISTRY[templateId];
    const signature = template.slots
      .map(
        (slot) =>
          `${slot.row}:${slot.columnStart}:${slot.columnSpan}:${slot.priority}:${slot.insetInto ? "nested" : "peer"}`,
      )
      .sort()
      .join("|");
    const clash = shapeSignatures.get(signature);
    assert(!clash, `${templateId}: is the same shape as ${clash} — the catalogue must offer distinct layouts`);
    shapeSignatures.set(signature, templateId);
  }

  for (const templateId of FRONT_PAGE_TEMPLATE_IDS) {
    const template = TEMPLATE_REGISTRY[templateId];
    assert(
      Boolean(template.rowRhythm && template.rowRhythm.length > 0),
      `${templateId}: a front page must state its own row rhythm, or the priority floors size the bands`,
    );

    const rhythm = template.rowRhythm!;
    // Exactly one row absorbs the leftover, otherwise the page cannot close
    // flush on the bottom content edge.
    const absorbing = rhythm.filter((row) => row.receivesRemainingSpace);
    assert(
      absorbing.length === 1,
      `${templateId}: exactly one row may receive the remaining space (found ${absorbing.length})`,
    );
    assert(
      absorbing[0].row === Math.max(...rhythm.map((row) => row.row)),
      `${templateId}: the last row must be the one that receives the remaining space`,
    );

    const ratioTotal = rhythm.reduce((total, row) => total + row.baseRatio, 0);
    assert(
      Math.abs(ratioTotal - 1) < 0.02,
      `${templateId}: row ratios must account for the whole content box (summed to ${ratioTotal.toFixed(3)})`,
    );

    // Every row in the rhythm must actually own slots, and vice versa.
    const rhythmRows = new Set(rhythm.map((row) => row.row));
    const slotRows = new Set(template.slots.map((slot) => slot.row));
    assert(
      rhythmRows.size === slotRows.size && [...slotRows].every((row) => rhythmRows.has(row)),
      `${templateId}: row rhythm and slot rows must describe the same rows`,
    );
  }
}

// ── Editorial page: the अभिव्यक्ति layout, and catalogue separation ──────────
{
  assert(
    EDITORIAL_PAGE_TEMPLATE_IDS.length > 0,
    "the editorial tab must offer at least one design",
  );

  // The three catalogues are exclusive — a template belongs to exactly one tab.
  for (const templateId of EDITORIAL_PAGE_TEMPLATE_IDS) {
    assert(
      Boolean(TEMPLATE_REGISTRY[templateId]),
      `${templateId}: editorial template must exist in the registry`,
    );
    assert(
      isEditorialPageTemplate(templateId),
      `${templateId}: must report as editorial-only`,
    );
    assert(
      !isFrontPageTemplate(templateId),
      `${templateId}: an editorial design must not also be offered as a front page`,
    );
  }
  for (const templateId of FRONT_PAGE_TEMPLATE_IDS) {
    assert(
      !isEditorialPageTemplate(templateId),
      `${templateId}: a front-page design must not also be offered as an editorial page`,
    );
  }

  const editorial = generateTemplateLayout({
    templateId: "CliffEditorial8A",
    pageWidth: toPoints(DEFAULT_PAGE_MASTER.width),
    contentX: contentBounds.x,
    contentY: contentBounds.y,
    contentWidth: contentBounds.width,
    contentHeight: contentBounds.height,
    // Page 8's own four-column grid, not the news pages' six.
    columnCount: getTemplateColumnCount("CliffEditorial8A", DEFAULT_PAGE_MASTER.columns),
    gutter: toPoints(DEFAULT_PAGE_MASTER.gutter),
  });
  const bySlot = new Map(editorial.slots.map((slot) => [slot.storyNumber, slot]));

  assert(editorial.slots.length === 6, `CliffEditorial8A must place 6 boxes, got ${editorial.slots.length}`);

  // The सम्पादकीय leader is ONE box running the whole depth of the upper
  // region — not two stacked slots, which each grew their own headline and read
  // as separate briefs.
  const rail = bySlot.get(1)!;
  const comment = bySlot.get(2)!;
  assert(rail.columnSpan === 1, "the leader rail must be one column");
  assert(
    editorial.slots.filter((slot) => slot.columnStart === 1 && slot.columnSpan === 1).length === 1,
    "the leader must be a single box — no second one-column slot may stack beneath it",
  );
  // The leader runs the whole band, as सम्पादकीय does on the printed page. The
  // comment beside it stops where the feature and the horoscope begin — it is
  // listed in `trimToInsets`, so its copy cannot overrun into them.
  const feature = bySlot.get(3)!;
  const horoscope = bySlot.get(4)!;
  assert(Math.abs(rail.y - comment.y) < 0.01, "the leader and the comment must share a top edge");
  assert(
    rail.height > comment.height,
    "the leader must run deeper than the comment, which stops at the nested band",
  );
  assert(
    Math.abs(comment.y + comment.height - feature.y) < 0.01,
    "the comment must end exactly where its nested band begins",
  );
  assert(
    Math.abs(rail.y + rail.height - (feature.y + feature.height)) < 0.01,
    "the leader must run to the foot of the band the nested boxes end at",
  );

  // The signed comment is the lead and takes four of the five columns — one for
  // its writer's rail, three for its copy. The leader keeps the first.
  assert(comment.priority === "lead", "विचार मंथन must be the page lead");
  assert(comment.columnSpan === 4, `the comment must span 4 columns, got ${comment.columnSpan}`);

  // Feature and horoscope are nested INTO the comment, not peers of it, so the
  // comment keeps its full headline measure across all four of its columns.
  assert(feature.insetParentStoryNumber === 2, "the feature must be nested in the comment");
  assert(horoscope.insetParentStoryNumber === 2, "the horoscope must be nested in the comment");
  // The middle band splits evenly: the feature takes the inner two columns and
  // आज का राशिफल the outer two, which the twelve-sign grid needs to set its
  // cells two across.
  assert(feature.columnSpan === 2, `the feature must span 2 columns, got ${feature.columnSpan}`);
  assert(horoscope.columnSpan === 2, `the horoscope must span 2 columns, got ${horoscope.columnSpan}`);
  for (const nested of [feature, horoscope]) {
    assert(nested.y > comment.y, "a nested box must start below the comment's headline block");
    assert(
      nested.x >= comment.x - 0.01 &&
        nested.x + nested.width <= comment.x + comment.width + 0.01,
      "a nested box must sit within the comment's columns",
    );
  }
  assert(
    Math.abs(feature.y + feature.height - (rail.y + rail.height)) < 0.01,
    "the feature may run to the foot of the upper band",
  );
  assert(
    horoscope.height >= feature.height * 0.55 && horoscope.height <= feature.height * 0.62,
    "the horoscope must be a compact half-height box without becoming a narrow strip",
  );
  assert(
    horoscope.x >= feature.x + feature.width - 0.01,
    "the horoscope must sit outboard of the feature, not overlap it",
  );
  assert(
    Math.abs(horoscope.x + horoscope.width - (contentBounds.x + contentBounds.width)) < 0.01,
    "the horoscope must sit against the outer edge of the page",
  );

  // Foot: the health package takes three of the five columns, the letters
  // column the remaining two.
  const foot = [5, 6].map((n) => bySlot.get(n)!);
  assert(foot[0].columnSpan === 3, "the health package must span 3 columns");
  assert(foot[1].columnSpan === 2, "the letters column must span 2 columns");
  assert(
    foot[1].y < foot[0].y - 200,
    "the letters column must rise into the space released by the compact horoscope",
  );
  assert(
    foot[1].y >= horoscope.y + horoscope.height,
    "the expanded letters column must not overlap the compact horoscope",
  );
  assert(
    foot[1].y - (horoscope.y + horoscope.height) <= toPoints(DEFAULT_PAGE_MASTER.gutter) + 1,
    "the expanded letters column must fill the released right-side space without a visible blank band",
  );
  assert(
    Math.abs(foot[0].y + foot[0].height - (contentBounds.y + contentBounds.height)) < 0.01,
    "the wide foot package should still anchor the page foot",
  );
  assert(
    Math.abs(foot[1].y + foot[1].height - (foot[0].y + foot[0].height)) < 0.01,
    "the expanded letters package must finish at the same bottom edge as the foot package",
  );
}

// Front-page designs must not leak into the inside-page catalogue and vice versa.
for (const [templateId] of Object.entries(TEMPLATE_REGISTRY)) {
  const declaredFront = FRONT_PAGE_TEMPLATE_IDS.includes(templateId as never);
  assert(
    declaredFront === isFrontPageTemplate(templateId as never),
    `${templateId}: front-page membership must be consistent`,
  );
}

console.info("TemplateTests passed");
