import assert from "node:assert/strict";
import { prototypeArticle } from "@/data/prototypeArticle";
import { createDocumentFromStoryFrames } from "@/engines/DocumentEngine/DocumentEngine";
import type { StoryFrame } from "@/types/editor";
import {
  calculateFrameManagerStatus,
  calculateFrameManagerVirtualRange,
  createFrameManagerGroups,
  filterFrameManagerGroups,
  flattenFrameManagerCards,
  groupFrames,
  moveFrameBefore,
  reorderFrameLayer,
  ungroupFrames,
  updateFrameProperties,
} from "./FrameManagerEngine";

const createFrame = (id: string, x: number): StoryFrame =>
  ({
    id,
    x,
    y: 72,
    width: 180,
    height: 240,
    role: "medium",
    priority: "secondary",
    columnStart: 1,
    columnSpan: 2,
    imageEnabled: false,
    imageAlignment: "top",
    imageColumnSpan: 1,
    imageHeight: 120,
    imageHeightMode: "auto",
    imageHeightPreset: "medium",
    imageHeightProtection: true,
    autoSizeImage: true,
    imageWrapMode: "newspaper",
    headlineFontSize: 19,
    subheadlineFontSize: 12,
    bodyFontSize: 11,
    headlineLineHeight: 0.95,
    subheadlineLineHeight: 1,
    bodyLineHeight: 1.08,
    headlineWeight: "800",
    subheadlineWeight: "600",
    autoFitHeadline: true,
    autoBalanceHeadline: true,
    enableHyphenation: false,
    forceFullWidthHeadlines: true,
    headlineLayoutMode: "newspaper-fill",
    articleData: prototypeArticle,
    compositionSettings: {
      showRegionDebug: false,
      bodyRendererMode: "line",
      headlineScale: 0.8,
      baselineGridSize: 6,
      enableDropCap: false,
      enableFactBox: false,
      enablePullQuote: false,
      opticalTypography: true,
    },
    dirtyFlags: {
      geometryDirty: false,
      textDirty: false,
      imageDirty: false,
      styleDirty: false,
      typographyDirty: false,
      compositionDirty: false,
      renderDirty: false,
    },
  }) as unknown as StoryFrame;

let document = createDocumentFromStoryFrames([
  createFrame("story-a", 72),
  createFrame("story-b", 280),
]);
const page = document.pages[0];
const selectedFrameIds = new Set([page.frameIds[0]]);
const groups = createFrameManagerGroups({ document, selectedFrameIds });
const cards = flattenFrameManagerCards(groups);

assert.equal(groups.length, 1);
assert.equal(cards.length, 2);
assert.equal(cards[0].selected, true);
assert.equal(calculateFrameManagerStatus(cards).frameCount, 2);

const filtered = filterFrameManagerGroups(groups, {
  query: "",
  pageId: "all",
  frameType: "article",
  onlyLocked: false,
  onlyHidden: false,
  onlyOverflow: false,
});
assert.equal(flattenFrameManagerCards(filtered).length, 2);

document = reorderFrameLayer(document, page.frameIds[0], "bring-to-front");
assert.equal(document.frames[page.frameIds[0]].zIndex, 1);

document = moveFrameBefore(document, page.frameIds[0], page.frameIds[1]);
assert.equal(document.frames[page.frameIds[0]].zIndex, 0);

document = updateFrameProperties(document, page.frameIds[0], { hidden: true, locked: true, name: "Election Lead" });
assert.equal(document.frames[page.frameIds[0]].hidden, true);
assert.equal(document.frames[page.frameIds[0]].metadata.name, "Election Lead");

document = groupFrames(document, page.frameIds, "Election Story");
assert.ok(document.frames[page.frameIds[0]].metadata.groupId);
document = ungroupFrames(document, page.frameIds);
assert.equal(document.frames[page.frameIds[0]].metadata.groupId, undefined);

const range = calculateFrameManagerVirtualRange({
  itemCount: 2000,
  scrollTop: 900,
  viewportHeight: 420,
  itemHeight: 28,
});
assert.ok(range.endIndex - range.startIndex < 40);

console.log("Frame manager tests passed");
