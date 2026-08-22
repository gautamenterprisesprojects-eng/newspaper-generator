import assert from "node:assert/strict";
import {
  addPage,
  createDocumentFromStoryFrames,
  deleteFrame,
  duplicateFrame,
  duplicatePage,
  moveStoryBetweenPages,
  updateDocumentPageFromStoryFrames,
} from "./DocumentEngine";
import { createEditionThumbnailSnapshots } from "@/engines/PageThumbnail/PageThumbnailEngine";
import { prototypeArticle } from "@/data/prototypeArticle";
import type { StoryFrame } from "@/types/editor";

const createTestStory = (id: string): StoryFrame =>
  ({
    id,
    x: 18,
    y: 54,
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

const run = () => {
  const story = createTestStory("story-a");
  let document = createDocumentFromStoryFrames([story]);

  assert.equal(document.pages.length, 1);
  assert.equal(document.pages[0].stories.length, 1);
  assert.equal(document.pages[0].frameIds.length, 1);
  assert.equal(document.frames[document.pages[0].frameIds[0]].storyId, "story-a");
  assert.equal(Object.keys(document.stories).length, 1);
  assert.equal(document.editionName, "National Edition");

  document = addPage(document);
  assert.equal(document.pages.length, 2);
  assert.equal(document.pages[1].stories.length, 0);

  document = duplicatePage(document, document.pages[0].id);
  assert.equal(document.pages.length, 3);
  assert.equal(Object.keys(document.stories).length, 1, "duplicating a page must not duplicate story content");
  assert.equal(document.pages[2].stories[0].storyId, "story-a");
  assert.equal(document.frames[document.pages[2].frameIds[0]].storyId, "story-a");
  assert.notEqual(document.pages[2].frameIds[0], document.pages[0].frameIds[0]);
  assert.notEqual(document.pages[2].stories[0].id, document.pages[0].stories[0].id);

  const frameCountBeforeDuplicate = Object.keys(document.frames).length;
  document = duplicateFrame(document, document.pages[2].frameIds[0]);
  assert.equal(Object.keys(document.frames).length, frameCountBeforeDuplicate + 1);
  assert.equal(Object.keys(document.stories).length, 1, "duplicating a frame must not duplicate story content");

  const frameToDelete = document.pages[2].frameIds.at(-1);
  assert.ok(frameToDelete);
  document = deleteFrame(document, frameToDelete);
  assert.equal(Object.keys(document.stories).length, 1, "deleting a frame must preserve story content");
  assert.ok(!document.frames[frameToDelete]);

  document = moveStoryBetweenPages({
    document,
    storyId: "story-a",
    fromPageId: document.pages[0].id,
    toPageId: document.pages[1].id,
  });
  assert.equal(document.pages[0].stories.length, 0);
  assert.equal(document.pages[1].stories.length, 1);
  assert.equal(Object.keys(document.stories).length, 1);

  document = updateDocumentPageFromStoryFrames(document, [story], document.pages[1].id);
  const thumbnails = createEditionThumbnailSnapshots(document);
  assert.equal(thumbnails.length, 3);
  assert.equal(thumbnails[1].storyCount, 1);
  assert.equal(thumbnails[1].rects[0].storyId, "story-a");
};

run();
console.log("EditionDocumentTests passed");
