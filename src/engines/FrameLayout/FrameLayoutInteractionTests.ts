import {
  alignFrameRects,
  createFrameLayoutContext,
  distributeFrameRects,
  getAlignmentTargetBounds,
  resizeFramesAcrossGap,
  snapFrameDrag,
  snapFrameResize,
} from "./FrameLayoutInteractionEngine";
import type { FrameLayoutColumn, FrameLayoutRect } from "./FrameLayoutInteractionTypes";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const columns: FrameLayoutColumn[] = [
  { index: 1, x: 18, width: 120 },
  { index: 2, x: 146, width: 120 },
  { index: 3, x: 274, width: 120 },
  { index: 4, x: 402, width: 120 },
  { index: 5, x: 530, width: 120 },
  { index: 6, x: 658, width: 120 },
];

const frames: FrameLayoutRect[] = [
  { id: "lead", x: 18, y: 54, width: 760, height: 320 },
  { id: "major", x: 18, y: 382, width: 504, height: 260 },
  { id: "secondary", x: 530, y: 382, width: 248, height: 260 },
];

const context = createFrameLayoutContext({
  pageWidth: 936,
  pageHeight: 1512,
  contentBounds: { x: 18, y: 54, width: 900, height: 1432 },
  columns,
  frames,
  baselineGridSize: 12,
  snapTolerance: 4,
});

const dragPreview = snapFrameDrag(
  { id: "secondary", x: 532, y: 382, width: 248, height: 260 },
  context,
);
assert(dragPreview.rect.x === 530, "Drag should snap frame left edge to column boundary.");
assert(dragPreview.guides.some((guide) => guide.kind === "column"), "Drag should expose a column smart guide.");

const resizePreview = snapFrameResize(
  { id: "major", x: 18, y: 382, width: 507, height: 260 },
  context,
  "e",
);
assert(resizePreview.rect.x === 18, "East resize must keep x anchored.");
assert(resizePreview.rect.width === 504, "East resize should snap right edge to column boundary.");

const collisionPreview = snapFrameDrag(
  { id: "secondary", x: 510, y: 400, width: 248, height: 260 },
  context,
);
assert(collisionPreview.collisions.length > 0, "Collision mode should report overlaps.");

const targetBounds = getAlignmentTargetBounds(frames, "margins", context);
const aligned = alignFrameRects([frames[1]], "right", targetBounds);
assert(aligned[0].x === targetBounds.x + targetBounds.width - frames[1].width, "Right alignment should use target right edge.");

const distributed = distributeFrameRects(
  [
    { id: "a", x: 0, y: 0, width: 100, height: 100 },
    { id: "b", x: 175, y: 0, width: 100, height: 100 },
    { id: "c", x: 400, y: 0, width: 100, height: 100 },
  ],
  "horizontal",
);
assert(distributed[1].x === 200, "Horizontal distribution should create equal gaps.");

const [gapFirst, gapSecond] = resizeFramesAcrossGap({
  first: { id: "left", x: 0, y: 0, width: 200, height: 100 },
  second: { id: "right", x: 220, y: 0, width: 200, height: 100 },
  axis: "horizontal",
  delta: 30,
});
assert(gapFirst.width === 230, "Gap resize should expand the first adjacent frame.");
assert(gapSecond.x === 250 && gapSecond.width === 170, "Gap resize should move and shrink the second adjacent frame.");

console.log("FrameLayoutInteractionTests passed");
