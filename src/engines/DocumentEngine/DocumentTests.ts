import assert from "node:assert/strict";
import { prototypeArticle } from "@/data/prototypeArticle";
import { richTextToPlainText } from "@/engines/RichText/RichTextUtils";
import {
  cloneStory,
  createDocumentFromStoryFrames,
  deletePage,
  duplicatePage,
  moveStoryBetweenPages,
} from "./DocumentEngine";
import { loadDocument } from "./DocumentLoader";
import { saveDocument } from "./DocumentSerializer";
import type { ArticleCompositionSettings, StoryFrame } from "@/types/editor";

const compositionSettings: ArticleCompositionSettings = {
  showRegionDebug: false,
  headlineScale: 0.8,
  baselineGridSize: 6,
  enableDropCap: false,
  enableFactBox: false,
  enablePullQuote: false,
  opticalTypography: true,
};

const story: StoryFrame = {
  id: "story-1",
  x: 72,
  y: 90,
  width: 360,
  height: 520,
  role: "lead",
  priority: "lead",
  columnStart: 1,
  columnSpan: 6,
  imageEnabled: true,
  imageAlignment: "top-right",
  imageColumnSpan: 3,
  imageHeight: 180,
  imageHeightMode: "auto",
  imageHeightPreset: "medium",
  imageHeightProtection: true,
  autoSizeImage: true,
  imageWrapMode: "newspaper",
  headlineFontSize: 40,
  subheadlineFontSize: 16,
  bodyFontSize: 12.5,
  headlineLineHeight: 0.95,
  subheadlineLineHeight: 1,
  bodyLineHeight: 1.08,
  headlineWeight: "800",
  subheadlineWeight: "600",
  autoFitHeadline: true,
  autoBalanceHeadline: true,
  enableHyphenation: true,
  forceFullWidthHeadlines: true,
  headlineLayoutMode: "newspaper-fill",
  articleData: prototypeArticle,
  compositionSettings,
};

const document = createDocumentFromStoryFrames([story], {
  newspaperName: "Test Daily",
  edition: "City",
});

assert.equal(document.metadata.newspaperName, "Test Daily");
assert.equal(document.pages.length, 1);
assert.equal(Object.keys(document.stories).length, 1);
assert.equal(document.pages[0].stories[0].storyId, "story-1");
assert.equal(
  richTextToPlainText(document.stories["story-1"].headline),
  richTextToPlainText(prototypeArticle.headline),
);

const payload = saveDocument(document);
const loaded = loadDocument(payload);

assert.deepEqual(loaded.metadata, document.metadata);
assert.equal(loaded.pages[0].stories.length, 1);

const duplicated = duplicatePage(loaded, loaded.pages[0].id);

assert.equal(duplicated.pages.length, 2);
assert.equal(duplicated.pages[1].pageNumber, 2);
assert.equal(duplicated.pages[1].stories.length, 1);
assert.equal(
  duplicated.pages[1].stories[0].storyId,
  "story-1",
  "duplicating a page creates new frame placements without duplicating story content",
);

const moved = moveStoryBetweenPages({
  document: duplicated,
  storyId: "story-1",
  fromPageId: duplicated.pages[0].id,
  toPageId: duplicated.pages[1].id,
});

assert.equal(moved.pages[0].stories.length, 0);
assert.equal(moved.pages[1].stories.some((placement) => placement.storyId === "story-1"), true);

const cloned = cloneStory(moved, "story-1");

assert.equal(Object.keys(cloned.stories).length, Object.keys(moved.stories).length + 1);

const deleted = deletePage(cloned, cloned.pages[0].id);

assert.equal(deleted.pages.length, 1);
assert.equal(deleted.pages[0].pageNumber, 1);

console.log("Document engine tests passed: 12");
