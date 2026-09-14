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
  WIZARD_FRONT_PAGE_DESIGNS.some((design) => design.id === "CliffFrontSep15"),
  "CliffFrontSep15 must be selectable on the Front Page wizard tab",
);
assert(
  !WIZARD_LAYOUT_DESIGNS.some((design) => design.id === "CliffFrontSep15"),
  "CliffFrontSep15 must not be added to the inside-page wizard catalogue",
);

const definition = getTemplateDefinition("CliffFrontSep15");
assert.equal(definition.storyCount, 9);
assert.equal(definition.slots.length, 9);
assert.deepEqual(definition.trimToInsets, [2, 4]);

const leadSlots = definition.slots.filter((slot) => slot.priority === "lead");
assert.equal(leadSlots.length, 1, "exactly one lead");
assert.equal(leadSlots[0].storyNumber, 2);

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
const rail = bySlot.get(1)!;
const lead = bySlot.get(2)!;
const leadNested = bySlot.get(3)!;
const right = bySlot.get(4)!;
const rightNested = bySlot.get(5)!;
const mid = bySlot.get(6)!;
const fact = bySlot.get(7)!;
const cartoon = bySlot.get(8)!;
const bottom = bySlot.get(9)!;

assert.equal(front.slots.length, 9);
assert.equal(lead.columnSpan, 3);
assert.equal(rail.columnSpan, 1);
assert.equal(right.columnSpan, 2);
assert.equal(mid.columnSpan, 6);
assert.equal(cartoon.columnSpan, 1);
assert.equal(bottom.columnSpan, 5);
assert.equal(leadNested.insetParentStoryNumber, 2);
assert.equal(rightNested.insetParentStoryNumber, 4);
assert.equal(fact.insetParentStoryNumber, 6);
assert.equal(rail.insetParentStoryNumber, undefined);
assert.equal(leadNested.columnSpan, 3);
assert.equal(rightNested.columnSpan, 2);
assert.equal(fact.columnSpan, 1);
assert.ok(leadNested.y > lead.y);
assert.ok(rightNested.y > right.y);
assert.ok(fact.y > mid.y);
assert.ok(Math.abs(leadNested.y + leadNested.height - (rail.y + rail.height)) < 0.01);
assert.ok(Math.abs(rightNested.y + rightNested.height - (rail.y + rail.height)) < 0.01);
assert.ok(lead.y + lead.height < leadNested.y + 0.01);
assert.ok(right.y + right.height < rightNested.y + 0.01);
assert.ok(mid.y + mid.height > fact.y + 1);
assert.ok(rail.y >= FRONT_HEADER_HEIGHT_PT - 0.01);
assert.ok(front.slots.every((slot) => slot.y >= FRONT_HEADER_HEIGHT_PT - 0.01));
assert.ok(mid.y >= rail.y + rail.height - 0.01);
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

const sep15Signature = TEMPLATE_REGISTRY.CliffFrontSep15.slots
  .map((slot) => `${slot.row}:${slot.columnStart}:${slot.columnSpan}:${slot.priority}:${slot.insetInto ? "nested" : "peer"}`)
  .sort()
  .join("|");
for (const templateId of FRONT_PAGE_TEMPLATE_IDS) {
  if (templateId === "CliffFrontSep15") continue;
  const signature = TEMPLATE_REGISTRY[templateId].slots
    .map((slot) => `${slot.row}:${slot.columnStart}:${slot.columnSpan}:${slot.priority}:${slot.insetInto ? "nested" : "peer"}`)
    .sort()
    .join("|");
  assert.notEqual(signature, sep15Signature, `${templateId} must remain a different shape from CliffFrontSep15`);
}

console.log("CliffFrontSep15Tests passed");
