import { strict as assert } from "node:assert";
import { prototypeArticle } from "@/data/prototypeArticle";
import { createCleanDirtyFlags } from "@/engines/IncrementalComposition/IncrementalCompositionEngine";
import { classifyStoryProfiles } from "@/engines/EditorialStory";
import { planPage } from "@/engines/PagePlanner";
import { findBuiltInTemplate } from "@/engines/TemplateLibrary";
import type { StoryFrame } from "@/types/editor";
import { composeAutoPage } from "./AutoPageComposer";
import { validatePageComposition } from "./CompositionValidator";

type TestCanvasContext = {
  font: string;
  measureText: (text: string) => { width: number };
};

const installCanvasMeasurementShim = () => {
  const context: TestCanvasContext = {
    font: "",
    measureText: (text) => ({ width: String(text ?? "").length * 7 }),
  };
  const canvas = { getContext: () => context };

  if (typeof document === "undefined") {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        createElement: () => canvas,
      },
    });
  }
};

installCanvasMeasurementShim();

const createStory = (
  id: string,
  priority: StoryFrame["priority"],
  category = "general",
  imageEnabled = false,
): StoryFrame => ({
  id,
  category,
  x: 0,
  y: 0,
  width: 240,
  height: 320,
  role: priority === "lead" ? "lead" : priority === "major" ? "major" : priority === "brief" ? "brief" : "medium",
  priority,
  columnStart: 1,
  columnSpan: 2,
  imageEnabled,
  imageAlignment: "top-left",
  imageColumnSpan: imageEnabled ? 2 : 1,
  imageHeight: imageEnabled ? 140 : 72,
  imageHeightMode: "auto",
  imageHeightPreset: imageEnabled ? "medium" : "tiny",
  imageHeightProtection: true,
  autoSizeImage: true,
  imageWrapMode: imageEnabled ? "newspaper" : "none",
  headlineFontSize: priority === "lead" ? 34 : priority === "major" ? 24 : 18,
  subheadlineFontSize: 13,
  bodyFontSize: 11,
  headlineLineHeight: 1,
  subheadlineLineHeight: 1,
  bodyLineHeight: 1,
  headlineWeight: priority === "lead" ? "900" : "800",
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
});

const createTwentyStories = () =>
  Array.from({ length: 20 }, (_, index) => {
    if (index === 0) return createStory("story-lead", "lead", "front", true);
    if (index === 1) return createStory("story-photo", "major", "features", true);
    if (index < 5) return createStory(`story-major-${index}`, "major", "national");
    if (index < 14) return createStory(`story-secondary-${index}`, "secondary", "state");
    return createStory(`story-brief-${index}`, "brief", "city");
  });

const compose = (templateId = "template-front-page") => {
  const stories = createTwentyStories();
  const profiles = classifyStoryProfiles(stories);
  const template = findBuiltInTemplate(templateId)!;
  const pagePlan = planPage({
    pageNumber: 1,
    section: "front-page",
    profiles: Object.values(profiles),
    advertisements: [],
    templates: [{ id: template.id, name: template.name, minimumStories: 1, maximumStories: 5, supportsAdvertisements: true }],
    capacity: 20,
  });

  return composeAutoPage({
    pagePlan,
    selectedTemplate: template,
    storyProfiles: profiles,
    stories,
    pageSettings: {
      maxIterations: 1,
    },
  });
};

const assertComposesPrioritizedPage = () => {
  const result = compose();

  assert(result.placedStories.length > 0);
  assert(result.placedStories.length <= 5);
  assert.equal(result.placedStories[0].priority, "lead");
  assert(result.rejectedStories.length >= 15);
  assert(result.metrics.compositionIterations >= 1);
};

const assertPhotoStoryPrefersImageSlot = () => {
  const result = compose();
  const photoAssignment = result.placedStoryAssignments.find((assignment) => assignment.storyId === "story-photo");

  assert(photoAssignment);
  assert(photoAssignment.reasons.some((reason) => reason.includes("image") || reason.includes("type")));
};

const assertAdvertisementHeavyTemplateReservesSlots = () => {
  const stories = createTwentyStories();
  const profiles = classifyStoryProfiles(stories);
  const template = findBuiltInTemplate("template-ad-heavy")!;
  const pagePlan = planPage({
    pageNumber: 1,
    section: "district",
    profiles: Object.values(profiles),
    advertisements: [{ id: "ad-1", lockedPageNumber: 1 }],
    templates: [{ id: template.id, name: template.name, minimumStories: 1, maximumStories: 5, supportsAdvertisements: true }],
    capacity: 20,
  });
  const result = composeAutoPage({
    pagePlan,
    selectedTemplate: template,
    storyProfiles: profiles,
    stories,
    advertisements: [{ id: "ad-1", lockedPageNumber: 1 }],
    pageSettings: { maxIterations: 1 },
  });

  assert.equal(result.advertisements.length, 1);
  assert(result.unusedSlots.every((slot) => !slot.reservedForAdvertisement));
};

const assertValidationRejectsOverlap = () => {
  const validation = validatePageComposition({
    stories: [
      createStory("a", "secondary"),
      createStory("b", "secondary"),
    ],
    advertisements: [],
    contentBounds: { x: 0, y: 0, width: 500, height: 500 },
    illegalWhitespaceArea: 0,
  });

  assert.equal(validation.valid, false);
  assert(validation.issues.some((issue) => issue.code === "story-overlap"));
};

const assertFinishedPageContainsExpectedResultShape = () => {
  const result = compose("template-sports");

  assert.equal(result.template.pageType, "sports");
  assert(Array.isArray(result.placedStoryAssignments));
  assert(Array.isArray(result.unusedSlots));
  assert(typeof result.validation.valid === "boolean");
  assert(result.orchestrator.composition.storyLayouts.length === result.placedStories.length);
};

assertComposesPrioritizedPage();
assertPhotoStoryPrefersImageSlot();
assertAdvertisementHeavyTemplateReservesSlots();
assertValidationRejectsOverlap();
assertFinishedPageContainsExpectedResultShape();

console.log("AutoPageComposer tests passed: 5");
