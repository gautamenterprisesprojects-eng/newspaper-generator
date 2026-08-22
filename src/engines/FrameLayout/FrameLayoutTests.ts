import assert from "node:assert/strict";
import { layoutFrameTextBlock } from "./FrameLayoutEngine";
import type { ArticleLayoutTextBlock } from "@/types/editor";
import { defaultContainerStyles, normalizeContainerStyles } from "@/engines/ContainerBackground/ContainerBackgroundEngine";

const block: ArticleLayoutTextBlock = {
  x: 12,
  y: 10,
  width: 120,
  height: 18,
  layoutBounds: {
    x: 12,
    y: 10,
    width: 120,
    height: 18,
  },
  frameBounds: {
    x: 0,
    y: 0,
    width: 220,
    height: 40,
  },
  text: "Short caption",
  wrappedLines: ["Short caption"],
  lineCount: 1,
  overflow: false,
  style: {
    fill: "#111111",
    fontFamily: "Arial",
    fontSize: 12,
    lineHeight: 1,
  },
  lineBoxes: [
    {
      x: 12,
      y: 10,
      width: 78,
      height: 18,
      text: "Short caption",
      style: {
        fill: "#111111",
        fontFamily: "Arial",
        fontSize: 12,
        lineHeight: 1,
      },
    },
  ],
  containerStyle: normalizeContainerStyles({
    caption: {
      ...defaultContainerStyles.caption,
      frameBackgroundColor: "#eeeeee",
      framePaddingTop: 4,
      framePaddingBottom: 4,
      framePaddingLeft: 6,
      framePaddingRight: 6,
      contentVerticalAlignment: "middle",
      contentHorizontalAlignment: "left",
    },
  }).caption,
};

const layout = layoutFrameTextBlock(block);

assert.equal(layout.frameBounds?.x, 0);
assert.equal(layout.frameBounds?.width, 220);
assert.equal(layout.frameBounds?.height, 40);
assert.equal(layout.contentBounds?.x, 6);
assert.equal(layout.contentBounds?.width, 208);
assert.equal(layout.block.layoutBounds?.x, 12);
assert.equal(layout.block.layoutBounds?.width, 120);
assert.equal(layout.block.lineBoxes[0].x, 6);
assert.equal(layout.block.lineBoxes[0].y, 11);

const centered = layoutFrameTextBlock({
  ...block,
  containerStyle: {
    ...block.containerStyle!,
    contentHorizontalAlignment: "center",
  },
});

assert.equal(centered.block.lineBoxes[0].x, 71);

const dashed = layoutFrameTextBlock({
  ...block,
  containerStyle: {
    ...block.containerStyle!,
    frameBorderWidth: 1,
    frameBorderStyle: "dashed",
  },
});

assert.ok(dashed.borderDash.length > 0);

console.log("Frame layout tests passed: 12");
