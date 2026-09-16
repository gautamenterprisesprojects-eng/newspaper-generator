import assert from "node:assert/strict";
import { DEFAULT_PAGE_MASTER } from "@/types/page";
import { FRONT_HEADER_HEIGHT_PT } from "@/engines/HeaderSystem/HeaderGeometry";
import { generateTemplateLayout } from "./TemplateLayoutEngine";
import {
  EDITORIAL_PAGE_TEMPLATE_IDS,
  FRONT_PAGE_TEMPLATE_IDS,
  getTemplateDefinition,
  isEditorialPageTemplate,
  isFrontPageTemplate,
  TEMPLATE_REGISTRY,
} from "./TemplateRegistry";
import { WIZARD_FRONT_PAGE_DESIGNS, WIZARD_LAYOUT_DESIGNS } from "@/components/editor/GenerationWizardModal";

const toPoints = (inches: number) => inches * 72;
const contentBounds = {
  x: toPoints(DEFAULT_PAGE_MASTER.contentX),
  y: toPoints(DEFAULT_PAGE_MASTER.contentY),
  width: toPoints(DEFAULT_PAGE_MASTER.contentWidth),
  height: toPoints(DEFAULT_PAGE_MASTER.contentHeight),
};

const geometry = () => {
  const contentY = Math.max(contentBounds.y, FRONT_HEADER_HEIGHT_PT);
  return {
    pageWidth: toPoints(DEFAULT_PAGE_MASTER.width),
    contentX: contentBounds.x,
    contentY,
    contentWidth: contentBounds.width,
    contentHeight: contentBounds.y + contentBounds.height - contentY,
    columnCount: DEFAULT_PAGE_MASTER.columns,
    gutter: toPoints(DEFAULT_PAGE_MASTER.gutter),
  };
};

assert(isFrontPageTemplate("CliffFrontSep15"), "CliffFrontSep15 must be registered as a front-page template");
assert(!isEditorialPageTemplate("CliffFrontSep15"), "CliffFrontSep15 must not be an editorial template");
assert(
  !EDITORIAL_PAGE_TEMPLATE_IDS.includes("CliffFrontSep15"),
  "CliffFrontSep15 must not appear in the editorial catalogue",
);
assert(
  FRONT_PAGE_TEMPLATE_IDS.includes("CliffFrontSep15"),
  "CliffFrontSep15 must appear in FRONT_PAGE_TEMPLATE_IDS",
);
assert(
  WIZARD_FRONT_PAGE_DESIGNS.some((design) => design.id === "CliffFrontSep15" && design.storyCount === 11),
  "CliffFrontSep15 must be selectable on the Front Page wizard tab as an 11-box design",
);
assert(
  !WIZARD_LAYOUT_DESIGNS.some((design) => design.id === "CliffFrontSep15"),
  "CliffFrontSep15 must not be added to the inside-page wizard catalogue",
);

const definition = getTemplateDefinition("CliffFrontSep15");
assert.equal(definition.storyCount, 11);
assert.equal(definition.slots.length, 11);
assert.deepEqual(definition.trimToInsets, [4, 6]);

const leadSlots = definition.slots.filter((slot) => slot.priority === "lead");
assert.equal(leadSlots.length, 1, "exactly one lead");
assert.equal(leadSlots[0].storyNumber, 4);
assert.equal(leadSlots[0].rowSpan, 3);

const wideBriefsInLeadRow = definition.slots.filter(
  (slot) =>
    slot.row === leadSlots[0].row &&
    (slot.priority === "brief" || slot.priority === "filler") &&
    slot.columnSpan > 1 &&
    !slot.insetInto,
);
assert.equal(wideBriefsInLeadRow.length, 0, "no multi-column brief peers in the lead row");

const front = generateTemplateLayout({ templateId: "CliffFrontSep15", ...geometry() });
const bySlot = new Map(front.slots.map((slot) => [slot.storyNumber, slot]));
const rail1 = bySlot.get(1)!;
const rail2 = bySlot.get(2)!;
const rail3 = bySlot.get(3)!;
const lead = bySlot.get(4)!;
const leadNested = bySlot.get(5)!;
const right = bySlot.get(6)!;
const rightNested = bySlot.get(7)!;
const mid = bySlot.get(8)!;
const related = bySlot.get(9)!;
const cartoon = bySlot.get(10)!;
const bottom = bySlot.get(11)!;

assert.equal(front.slots.length, 11);
assert.equal(lead.columnSpan, 3);
assert.equal(rail1.columnSpan, 1);
assert.equal(rail2.columnSpan, 1);
assert.equal(rail3.columnSpan, 1);
assert.equal(right.columnSpan, 2);
assert.equal(mid.columnSpan, 6);
assert.equal(cartoon.columnSpan, 1);
assert.equal(bottom.columnSpan, 5);
assert.equal(leadNested.insetParentStoryNumber, 4);
assert.equal(rightNested.insetParentStoryNumber, 6);
assert.equal(related.insetParentStoryNumber, 8);
assert.equal(rail1.insetParentStoryNumber, undefined);
assert.equal(leadNested.columnSpan, 3);
assert.equal(rightNested.columnSpan, 2);
assert.equal(related.columnSpan, 2);
assert.equal(related.columnStart, 5);
assert.ok(related.x > mid.x + mid.width / 2, "related-news box must sit on the right of the middle package");
assert.ok(related.x + related.width <= mid.x + mid.width + 0.01, "related-news box must stay inside the parent's right edge");
assert.ok(related.y > mid.y + 1);
assert.ok(related.y < mid.y + mid.height * 0.3, "related-news box must start below the headline, in the upper third");
assert.ok(related.y + related.height < mid.y + mid.height - 1, "related-news box must finish inside the parent");
assert.ok(related.height < mid.height * 0.55, "related-news box must stay a compact top-right fact box");
assert.ok(leadNested.y > lead.y);
assert.ok(rightNested.y > right.y);
assert.ok(Math.abs(leadNested.y + leadNested.height - (rail3.y + rail3.height)) < 0.01);
assert.ok(Math.abs(rightNested.y + rightNested.height - (rail3.y + rail3.height)) < 0.01);
assert.ok(lead.y + lead.height < leadNested.y + 0.01);
assert.ok(right.y + right.height < rightNested.y + 0.01);
assert.ok(mid.y + mid.height > related.y + 1);
assert.ok(rail1.y >= FRONT_HEADER_HEIGHT_PT - 0.01);
assert.ok(front.slots.every((slot) => slot.y >= FRONT_HEADER_HEIGHT_PT - 0.01));
assert.ok(rail2.y >= rail1.y + rail1.height - 0.01);
assert.ok(rail3.y >= rail2.y + rail2.height - 0.01);
assert.ok(Math.abs(lead.y - rail1.y) < 0.01);
assert.ok(Math.abs(right.y - rail1.y) < 0.01);
assert.ok(mid.y >= rail3.y + rail3.height - 0.01);
assert.ok(bottom.y >= mid.y + mid.height - 0.01);
assert.ok(
  Math.abs(Math.max(...front.slots.map((slot) => slot.y + slot.height)) - (contentBounds.y + contentBounds.height)) < 1,
);

const eight = generateTemplateLayout({ templateId: "CliffFront8A", ...geometry() });
const eleven = generateTemplateLayout({ templateId: "CliffFront11A", ...geometry() });
assert.equal(eight.slots.length, 8, "CliffFront8A must still place 8 boxes");
assert.equal(eleven.slots.length, 11, "CliffFront11A must still place 11 boxes");
assert.equal(TEMPLATE_REGISTRY.CliffFront8A.storyCount, 8);
assert.equal(TEMPLATE_REGISTRY.CliffFront11A.storyCount, 11);
assert.equal(
  TEMPLATE_REGISTRY.CliffFront8A.slots.filter((slot) => slot.insetInto).length,
  0,
  "CliffFront8A must still have no nested slots",
);
assert.equal(
  TEMPLATE_REGISTRY.CliffFront11A.slots.filter((slot) => slot.insetInto).length,
  1,
  "CliffFront11A must still have its single nested sidebar",
);
assert.equal(TEMPLATE_REGISTRY.CliffFront8A.slots.some((slot) => slot.rowSpan), false);
assert.equal(TEMPLATE_REGISTRY.CliffFront11A.slots.some((slot) => slot.rowSpan), false);

const sep15Signature = TEMPLATE_REGISTRY.CliffFrontSep15.slots
  .map((slot) => `${slot.row}:${slot.columnStart}:${slot.columnSpan}:${slot.priority}:${slot.insetInto ? "nested" : "peer"}:${slot.rowSpan ?? 1}`)
  .sort()
  .join("|");
for (const templateId of FRONT_PAGE_TEMPLATE_IDS) {
  if (templateId === "CliffFrontSep15") continue;
  const signature = TEMPLATE_REGISTRY[templateId].slots
    .map((slot) => `${slot.row}:${slot.columnStart}:${slot.columnSpan}:${slot.priority}:${slot.insetInto ? "nested" : "peer"}:${slot.rowSpan ?? 1}`)
    .sort()
    .join("|");
  assert.notEqual(signature, sep15Signature, `${templateId} must remain a different shape from CliffFrontSep15`);
}

console.log("CliffFrontSep15Tests passed");
