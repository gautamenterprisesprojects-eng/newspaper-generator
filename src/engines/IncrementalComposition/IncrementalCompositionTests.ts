import assert from "node:assert/strict";
import { prototypeArticle } from "@/data/prototypeArticle";
import { richTextToPlainText } from "@/engines/RichText/RichTextUtils";
import {
  composeStoriesIncrementally,
  createCleanDirtyFlags,
  type StoryCompositionCache,
} from "./IncrementalCompositionEngine";
import type { ArticleCompositionSettings, StoryFrame } from "@/types/editor";

Object.defineProperty(globalThis, "OffscreenCanvas", {
  configurable: true,
  value: class {
    getContext() {
      return {
        font: "",
        measureText: (text: string) => ({
          width: Array.from(text).reduce((sum, char) => sum + (char === " " ? 4 : 8), 0),
        }),
      };
    }
  },
});

const compositionSettings: ArticleCompositionSettings = {
  showRegionDebug: false,
  headlineScale: 0.8,
  baselineGridSize: 6,
  enableDropCap: false,
  enableFactBox: false,
  enablePullQuote: false,
  opticalTypography: true,
};

const createStory = (overrides: Partial<StoryFrame> = {}): StoryFrame => ({
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
  imageColumnSpan: 2,
  imageHeight: 144,
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
  dirtyFlags: createCleanDirtyFlags(),
  ...overrides,
});

const cache: StoryCompositionCache = new Map();
const initial = composeStoriesIncrementally({
  stories: [createStory()],
  productionView: false,
  cache,
});

assert.equal(initial.diagnostics.storiesRecomposed, 1);
assert.equal(initial.diagnostics.cacheMissPercent, 100);

const moved = composeStoriesIncrementally({
  stories: [createStory({ x: 240, y: 360 })],
  productionView: false,
  cache,
});

assert.equal(moved.diagnostics.storiesRecomposed, 0);
assert.equal(moved.diagnostics.cacheHitPercent, 100);
assert.equal(moved.storyLayouts[0].layout, initial.storyLayouts[0].layout);

const resized = composeStoriesIncrementally({
  stories: [createStory({ width: 420 })],
  productionView: false,
  cache,
});

assert.equal(resized.diagnostics.storiesRecomposed, 1);
assert.notEqual(resized.storyLayouts[0].layout, initial.storyLayouts[0].layout);

const paintCache: StoryCompositionCache = new Map();
const paintInitial = composeStoriesIncrementally({
  stories: [createStory()],
  productionView: false,
  cache: paintCache,
});
const paintOnly = composeStoriesIncrementally({
  stories: [
    createStory({
      articleData: {
        ...prototypeArticle,
        headline: {
          spans: [
            {
              text: richTextToPlainText(prototypeArticle.headline),
              color: "#b42318",
              backgroundColor: "#fff3bf",
            },
          ],
        },
      },
    }),
  ],
  productionView: false,
  cache: paintCache,
});

assert.equal(paintOnly.diagnostics.storiesRecomposed, 0);
assert.equal(paintOnly.diagnostics.cacheHitPercent, 100);
assert.notEqual(paintOnly.storyLayouts[0].layout, paintInitial.storyLayouts[0].layout);
assert.equal(paintOnly.storyLayouts[0].layout.headline.lineBoxes[0].style.fill, "#b42318");

console.log("Incremental composition tests passed: 11");
