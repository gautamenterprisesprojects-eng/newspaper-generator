import assert from "node:assert/strict";
import {
  applyContainerStyleToTextBlock,
  defaultContainerStyles,
  normalizeContainerStyles,
} from "./ContainerBackgroundEngine";
import type { ArticleLayoutTextBlock } from "@/types/editor";

const block: ArticleLayoutTextBlock = {
  x: 10,
  y: 20,
  width: 100,
  height: 18,
  text: "Caption",
  wrappedLines: ["Caption"],
  lineCount: 1,
  overflow: false,
  style: {
    fill: "#111",
    fontFamily: "Arial",
    fontSize: 12,
    lineHeight: 1,
  },
  lineBoxes: [],
};

const caption = applyContainerStyleToTextBlock(block, {
  ...defaultContainerStyles.caption,
  frameBackgroundColor: "#eeeeee",
}, { x: 0, y: 16, width: 180, height: 32 });

assert.equal(caption.layoutBounds?.x, 10);
assert.equal(caption.layoutBounds?.width, 100);
assert.equal(caption.frameBounds?.x, 0);
assert.equal(caption.frameBounds?.y, 16);
assert.equal(caption.frameBounds?.width, 180);
assert.equal(caption.frameBounds?.height, 32);
assert.equal(caption.containerBounds?.x, 0);
assert.equal(caption.containerBounds?.y, 16);
assert.equal(caption.containerBounds?.width, 180);
assert.equal(caption.containerBounds?.height, 32);
assert.equal(caption.containerStyle?.frameRadius, 2);

const legacyCaptionStyle = normalizeContainerStyles({
  caption: {
    ...defaultContainerStyles.caption,
    containerBackgroundColor: "#dddddd",
    containerOpacity: 0.7,
  },
});

assert.equal(legacyCaptionStyle.caption.frameMode, "frame");
assert.equal(legacyCaptionStyle.caption.frameBackgroundColor, "#dddddd");
assert.equal(legacyCaptionStyle.caption.containerBackgroundColor, "#dddddd");
assert.equal(legacyCaptionStyle.caption.frameOpacity, 0.7);
assert.equal(legacyCaptionStyle.caption.framePaddingLeft, 6);

const textOnly = applyContainerStyleToTextBlock(block, {
  ...defaultContainerStyles.caption,
  frameMode: "text-only",
  mode: "text-only",
  frameBackgroundColor: "#eeeeee",
});

assert.equal(textOnly.frameBounds?.x, 4);
assert.equal(textOnly.frameBounds?.width, 112);

const tintedArticleStyle = normalizeContainerStyles({
  article: {
    ...(defaultContainerStyles.article ?? { mode: "frame" }),
    mode: "frame",
    frameMode: "frame",
    containerBackgroundColor: "rgba(225, 228, 232, 0.25)",
    frameBackgroundColor: "rgba(225, 228, 232, 0.25)",
  } as any,
});

assert.equal(tintedArticleStyle.article?.containerBackgroundColor, "rgba(225, 228, 232, 0.25)");

console.log("Container background tests passed: 17");
