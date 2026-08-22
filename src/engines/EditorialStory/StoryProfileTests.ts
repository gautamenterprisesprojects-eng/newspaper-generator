import { strict as assert } from "node:assert";
import { prototypeArticle } from "@/data/prototypeArticle";
import { createCleanDirtyFlags } from "@/engines/IncrementalComposition/IncrementalCompositionEngine";
import type { StoryFrame } from "@/types/editor";
import { classifyStoryProfile } from "./StoryClassifier";

const createStory = (overrides: Partial<StoryFrame>): StoryFrame => ({
  id: "story",
  x: 0,
  y: 0,
  width: 240,
  height: 320,
  priority: "secondary",
  columnStart: 1,
  columnSpan: 2,
  imageEnabled: false,
  imageAlignment: "top-left",
  imageColumnSpan: 1,
  imageHeight: 0,
  imageHeightMode: "auto",
  imageHeightPreset: "tiny",
  imageHeightProtection: true,
  autoSizeImage: true,
  imageWrapMode: "none",
  headlineFontSize: 24,
  subheadlineFontSize: 14,
  bodyFontSize: 11,
  headlineLineHeight: 1,
  subheadlineLineHeight: 1,
  bodyLineHeight: 1,
  headlineWeight: "800",
  subheadlineWeight: "600",
  autoFitHeadline: true,
  autoBalanceHeadline: true,
  enableHyphenation: true,
  forceFullWidthHeadlines: false,
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
  dirtyFlags: createCleanDirtyFlags(),
  ...overrides,
});

const assertLeadStory = () => {
  const profile = classifyStoryProfile({ story: createStory({ id: "lead", priority: "lead", role: "lead", columnSpan: 4 }) });

  assert.equal(profile.storyType, "lead");
  assert.equal(profile.minimumColumns, 3);
  assert.equal(profile.preferredColumns, 4);
  assert.equal(profile.grow, true);
  assert.equal(profile.shrink, false);
  assert.equal(profile.imageRules.required, true);
  assert.equal(profile.headlineRules.allowMultiDeck, true);
};

const assertBriefStory = () => {
  const profile = classifyStoryProfile({ story: createStory({ id: "brief", priority: "brief", role: "brief", columnSpan: 1 }) });

  assert.equal(profile.storyType, "brief");
  assert.equal(profile.maximumColumns, 2);
  assert.equal(profile.grow, false);
  assert.equal(profile.shrink, true);
  assert.equal(profile.jump, false);
};

const assertAdvertisement = () => {
  const profile = classifyStoryProfile({ story: createStory({ id: "ad", category: "advertising", priority: "filler" }) });

  assert.equal(profile.storyType, "advertisement");
  assert.equal(profile.section, "advertising");
  assert.equal(profile.grow, false);
  assert.equal(profile.shrink, false);
  assert.equal(profile.imageRules.required, true);
  assert.equal(profile.headlineRules.required, false);
};

const assertPhotoStory = () => {
  const profile = classifyStoryProfile({
    story: createStory({ id: "photo", imageEnabled: true, imageHeight: 180, columnSpan: 3 }),
  });

  assert.equal(profile.storyType, "photo");
  assert.equal(profile.imageRules.required, true);
  assert.equal(profile.captionRules.required, true);
  assert.equal(profile.preferredColumns, 3);
};

const assertEditorialStory = () => {
  const profile = classifyStoryProfile({ story: createStory({ id: "opinion", category: "opinion" }) });

  assert.equal(profile.storyType, "editorial");
  assert.equal(profile.section, "opinion");
  assert.equal(profile.split, true);
  assert.equal(profile.headlineRules.tone, "opinion");
};

const assertSportsStory = () => {
  const profile = classifyStoryProfile({ story: createStory({ id: "sports", category: "sports", columnSpan: 2 }) });

  assert.equal(profile.storyType, "sports");
  assert.equal(profile.section, "sports");
  assert.equal(profile.jump, true);
  assert.equal(profile.headlineRules.tone, "sports");
};

assertLeadStory();
assertBriefStory();
assertAdvertisement();
assertPhotoStory();
assertEditorialStory();
assertSportsStory();

console.log("StoryProfile tests passed: 6");

