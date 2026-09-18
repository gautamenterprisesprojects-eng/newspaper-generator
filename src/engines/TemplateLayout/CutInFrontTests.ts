import assert from "node:assert/strict";
import { DEFAULT_PAGE_MASTER } from "@/types/page";
import { FRONT_HEADER_HEIGHT_PT } from "@/engines/HeaderSystem/HeaderGeometry";
import { generateTemplateLayout } from "./TemplateLayoutEngine";
import {
  FRONT_PAGE_TEMPLATE_IDS,
  getSlotInset,
  isEditorialPageTemplate,
  isFrontPageTemplate,
  NEWSPRINT_TINTS,
  TEMPLATE_REGISTRY,
} from "./TemplateRegistry";
import type { TemplateId } from "./TemplateTypes";
import { WIZARD_FRONT_PAGE_DESIGNS, WIZARD_LAYOUT_DESIGNS } from "@/components/editor/GenerationWizardModal";

/**
 * The four cut-in front pages, plus the cut-in contract itself.
 *
 * This file exists as its own script because the Sep15/front block inside
 * TemplateTests.ts is unreachable: a top-level assertion on
 * AkhandVicharManthan6A throws before the file gets that far, so anything after
 * it silently never runs. Run with `npm run test:cutins`.
 */

const toPoints = (inches: number) => inches * 72;
const contentBounds = {
  x: toPoints(DEFAULT_PAGE_MASTER.contentX),
  y: toPoints(DEFAULT_PAGE_MASTER.contentY),
  width: toPoints(DEFAULT_PAGE_MASTER.contentWidth),
  height: toPoints(DEFAULT_PAGE_MASTER.contentHeight),
};
const contentY = Math.max(contentBounds.y, FRONT_HEADER_HEIGHT_PT);
const pageBottom = contentBounds.y + contentBounds.height;
const geometry = {
  pageWidth: toPoints(DEFAULT_PAGE_MASTER.width),
  contentX: contentBounds.x,
  contentY,
  contentWidth: contentBounds.width,
  contentHeight: pageBottom - contentY,
  columnCount: DEFAULT_PAGE_MASTER.columns,
  gutter: toPoints(DEFAULT_PAGE_MASTER.gutter),
};

const CUT_IN_FRONTS: TemplateId[] = [
  "CliffFrontSplitHero8A",
  "CliffFrontPillar8A",
  "CliffFrontTripleDeck8A",
  "CliffFrontDoubleInset9A",
];

const TINTS = new Set<string>(Object.values(NEWSPRINT_TINTS));

// ── The cut-in contract, across the whole registry ───────────────────────────
for (const [templateId, template] of Object.entries(TEMPLATE_REGISTRY)) {
  for (const slot of template.slots) {
    const inset = slot.insetInto;

    if (!inset) {
      continue;
    }

    if (inset.mode === "cutIn") {
      const parent = template.slots.find((entry) => entry.storyNumber === inset.parentStoryNumber);
      assert.ok(parent, `${templateId}: cut-in ${slot.storyNumber} names a parent that does not exist`);
      assert.ok(
        parent!.columnSpan >= 4,
        `${templateId}: cut-in ${slot.storyNumber} sits in a parent spanning ${parent!.columnSpan} columns; ` +
          "a cut-in needs a parent of 4 columns or more, or the remaining measure is too thin to set type in",
      );
      assert.ok(
        slot.columnStart >= parent!.columnStart &&
          slot.columnStart + slot.columnSpan <= parent!.columnStart + parent!.columnSpan,
        `${templateId}: cut-in ${slot.storyNumber} must sit within its parent's columns`,
      );
    }

    // A tint is meaningful only on a cut-in — a stacked sibling paints nothing.
    if (inset.tint) {
      assert.equal(
        inset.mode,
        "cutIn",
        `${templateId}: story ${slot.storyNumber} declares a tint but is not a cut-in`,
      );
    }
  }
}

// The two insets that predate `mode` must stay on the legacy path, or their
// wrap changes without anyone asking for it.
for (const legacy of [
  { templateId: "CliffFront11A" as TemplateId, storyNumber: 3 },
  { templateId: "CliffFrontLWrap9A" as TemplateId, storyNumber: 3 },
]) {
  const inset = getSlotInset(legacy.templateId, legacy.storyNumber);
  assert.ok(inset, `${legacy.templateId}: story ${legacy.storyNumber} must still be an inset`);
  assert.equal(
    inset!.mode,
    undefined,
    `${legacy.templateId}: story ${legacy.storyNumber} must keep the legacy inset behaviour (no mode, no runaround gutter)`,
  );
  assert.equal(inset!.tint, undefined, `${legacy.templateId}: legacy inset must not gain a tint`);
}

// ── Each of the four ─────────────────────────────────────────────────────────
for (const templateId of CUT_IN_FRONTS) {
  const template = TEMPLATE_REGISTRY[templateId];
  const label = templateId;

  assert.ok(isFrontPageTemplate(templateId), `${label}: must be a front-page template`);
  assert.ok(!isEditorialPageTemplate(templateId), `${label}: must not be an editorial template`);
  assert.ok(FRONT_PAGE_TEMPLATE_IDS.includes(templateId), `${label}: must appear in FRONT_PAGE_TEMPLATE_IDS`);
  assert.equal(template.storyCount, template.slots.length, `${label}: storyCount must match its slot count`);

  const wizardEntry = WIZARD_FRONT_PAGE_DESIGNS.find((design) => design.id === templateId);
  assert.ok(wizardEntry, `${label}: must be offered on the Front Page wizard tab`);
  assert.equal(
    wizardEntry!.storyCount,
    template.storyCount,
    `${label}: the wizard's story count must match the template's`,
  );
  assert.ok(
    !WIZARD_LAYOUT_DESIGNS.some((design) => design.id === templateId),
    `${label}: a front page must not appear in the inside-page catalogue`,
  );

  const leads = template.slots.filter((slot) => slot.priority === "lead");
  assert.equal(leads.length, 1, `${label}: must have exactly one lead`);

  const wideBriefsInLeadRow = template.slots.filter(
    (slot) =>
      slot.row === leads[0].row &&
      (slot.priority === "brief" || slot.priority === "filler") &&
      slot.columnSpan > 1,
  );
  assert.equal(wideBriefsInLeadRow.length, 0, `${label}: no multi-column brief in the lead's row`);

  const rhythm = template.rowRhythm!;
  assert.ok(rhythm && rhythm.length > 0, `${label}: must state its own row rhythm`);
  const absorbing = rhythm.filter((row) => row.receivesRemainingSpace);
  assert.equal(absorbing.length, 1, `${label}: exactly one row may absorb the remaining space`);
  assert.equal(
    absorbing[0].row,
    Math.max(...rhythm.map((row) => row.row)),
    `${label}: the last row must absorb the remaining space`,
  );
  const ratioTotal = rhythm.reduce((total, row) => total + row.baseRatio, 0);
  assert.ok(Math.abs(ratioTotal - 1) < 0.02, `${label}: row ratios must sum to 1 (got ${ratioTotal.toFixed(3)})`);
  const rhythmRows = new Set(rhythm.map((row) => row.row));
  const slotRows = new Set(template.slots.map((slot) => slot.row));
  assert.ok(
    rhythmRows.size === slotRows.size && [...slotRows].every((row) => rhythmRows.has(row)),
    `${label}: row rhythm and slot rows must describe the same rows`,
  );

  // Peer columns in every row must account for the full 6-column grid.
  for (const row of rhythmRows) {
    const peers = template.slots.filter((slot) => slot.row === row && !slot.insetInto);
    const spanned = peers.reduce((total, slot) => total + slot.columnSpan, 0);
    const spanningIn = template.slots.filter(
      (slot) => !slot.insetInto && slot.row < row && slot.row + (slot.rowSpan ?? 1) - 1 >= row,
    );
    const carried = spanningIn.reduce((total, slot) => total + slot.columnSpan, 0);
    assert.equal(
      spanned + carried,
      6,
      `${label}: row ${row} peers must account for 6 columns (got ${spanned + carried})`,
    );
  }

  const cutIns = template.slots.filter((slot) => slot.insetInto?.mode === "cutIn");
  assert.ok(cutIns.length >= 1, `${label}: a cut-in front page must carry at least one cut-in`);
  for (const cutIn of cutIns) {
    assert.ok(
      cutIn.insetInto!.tint && TINTS.has(cutIn.insetInto!.tint),
      `${label}: cut-in ${cutIn.storyNumber} must declare a tint from NEWSPRINT_TINTS`,
    );
  }

  // ── Placed geometry ────────────────────────────────────────────────────────
  const layout = generateTemplateLayout({ templateId, ...geometry });
  assert.equal(layout.slots.length, template.storyCount, `${label}: must place every box`);

  const bySlot = new Map(layout.slots.map((slot) => [slot.storyNumber, slot]));
  const cutInNumbers = new Set(cutIns.map((slot) => slot.storyNumber));

  for (const placed of layout.slots) {
    assert.ok(placed.y >= FRONT_HEADER_HEIGHT_PT - 0.01, `${label}: box ${placed.storyNumber} must clear the masthead`);
    if (!cutInNumbers.has(placed.storyNumber)) {
      assert.ok(
        placed.height >= 150,
        `${label}: box ${placed.storyNumber} is only ${placed.height.toFixed(1)}pt deep — no box may be shallow`,
      );
    } else {
      assert.ok(
        placed.height >= 120,
        `${label}: cut-in ${placed.storyNumber} is only ${placed.height.toFixed(1)}pt deep`,
      );
    }
  }

  // Only a cut-in may overlap, and only its own parent.
  for (let i = 0; i < layout.slots.length; i += 1) {
    for (let j = i + 1; j < layout.slots.length; j += 1) {
      const a = layout.slots[i];
      const b = layout.slots[j];
      const overlapW = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapH = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);

      if (overlapW <= 0.5 || overlapH <= 0.5) {
        continue;
      }

      assert.ok(
        a.insetParentStoryNumber === b.storyNumber || b.insetParentStoryNumber === a.storyNumber,
        `${label}: boxes ${a.storyNumber} and ${b.storyNumber} overlap without one being the other's cut-in`,
      );
    }
  }

  for (const cutIn of cutIns) {
    const placed = bySlot.get(cutIn.storyNumber)!;
    const parent = bySlot.get(cutIn.insetInto!.parentStoryNumber)!;
    assert.ok(
      placed.x >= parent.x - 0.01 &&
        placed.x + placed.width <= parent.x + parent.width + 0.01 &&
        placed.y >= parent.y - 0.01 &&
        placed.y + placed.height <= parent.y + parent.height + 0.01,
      `${label}: cut-in ${cutIn.storyNumber} must stay inside its parent`,
    );
    // The parent must run on behind the cut-in — that is what makes it a cut-in
    // rather than a stacked sibling.
    assert.ok(
      parent.y + parent.height > placed.y + 1,
      `${label}: parent ${parent.storyNumber} must keep its depth behind cut-in ${cutIn.storyNumber}`,
    );
  }

  const foot = Math.max(...layout.slots.map((slot) => slot.y + slot.height));
  assert.ok(
    Math.abs(foot - pageBottom) < 1,
    `${label}: the page must close flush on the bottom content edge (${foot.toFixed(1)} vs ${pageBottom.toFixed(1)})`,
  );
}

// ── Every front page must be a distinct shape ────────────────────────────────
// TemplateTests owns this check too, but never reaches it. Repeat it here so a
// new template that duplicates an existing shape is caught.
{
  const signatures = new Map<string, string>();
  for (const templateId of FRONT_PAGE_TEMPLATE_IDS) {
    const signature = TEMPLATE_REGISTRY[templateId].slots
      .map(
        (slot) =>
          `${slot.row}:${slot.columnStart}:${slot.columnSpan}:${slot.priority}:${slot.insetInto ? "nested" : "peer"}`,
      )
      .sort()
      .join("|");
    const clash = signatures.get(signature);
    assert.ok(!clash, `${templateId}: is the same shape as ${clash} — the catalogue must offer distinct layouts`);
    signatures.set(signature, templateId);
  }
}

console.log("CutInFrontTests passed");
