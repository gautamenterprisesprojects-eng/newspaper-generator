import { strict as assert } from "node:assert";
import { prototypeArticle } from "@/data/prototypeArticle";
import { createCleanDirtyFlags } from "@/engines/IncrementalComposition/IncrementalCompositionEngine";
import { classifyStoryProfiles } from "@/engines/EditorialStory";
import { planEdition, type AdvertisementReservation, type EditionConfiguration, type PlannerSection } from "@/engines/PagePlanner";
import { loadBuiltInTemplates } from "@/engines/TemplateLibrary";
import type { StoryFrame } from "@/types/editor";
import { composeEdition } from "./EditionComposer";
import { validateEditionComposition } from "./EditionValidator";

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

const sections: PlannerSection[] = [
  "front-page",
  "national",
  "state",
  "district",
  "sports",
  "business",
  "editorial",
  "entertainment",
];

const categoryForSection = (section: PlannerSection) => {
  if (section === "front-page") return "front";
  if (section === "district") return "city";
  if (section === "editorial") return "opinion";
  if (section === "entertainment") return "features";

  return section;
};

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

const createEditionStories = (count: number) =>
  Array.from({ length: count }, (_, index) => {
    const section = sections[index % sections.length];
    const priority = index === 0
      ? "lead"
      : index % 9 === 0
        ? "major"
        : index % 4 === 0
          ? "brief"
          : "secondary";

    return createStory(
      `story-${String(index + 1).padStart(3, "0")}`,
      priority,
      categoryForSection(section),
      index % 11 === 0,
    );
  });

const createEdition = (storyCount = 120, pageCount = 16) => {
  const stories = createEditionStories(storyCount);
  const storyProfiles = classifyStoryProfiles(stories);
  const advertisements: AdvertisementReservation[] = [
    { id: "ad-front", lockedPageNumber: 1, priority: 0 },
    { id: "ad-sports", preferredPageNumber: 5, section: "sports", priority: 1 },
  ];
  const configuration: EditionConfiguration = {
    editionId: "daily-edition",
    pageCount,
    sections,
    storiesPerPageTarget: 8,
    maximumStoriesPerPage: 8,
  };
  const editionPlan = planEdition({
    storyProfiles,
    configuration,
    advertisements,
  });

  return {
    stories,
    storyProfiles,
    configuration,
    editionPlan,
    advertisements,
  };
};

const assertComposesSixteenPageEdition = () => {
  const edition = createEdition();
  const result = composeEdition({
    ...edition,
    templates: loadBuiltInTemplates(),
    pageSettings: { maxIterations: 1 },
  });

  assert.equal(result.pages.length, 16);
  assert.equal(result.metrics.pageCount, 16);
  assert(result.placedStories.length > 0);
  assert(result.placedStories.length <= 80);
  assert(result.rejectedStories.length + result.placedStories.length + result.unusedStories.length >= 120);
  assert.equal(result.pages[0].template.pageType, "front-page");
};

const assertReservesAdvertisements = () => {
  const edition = createEdition(48, 8);
  const result = composeEdition({
    ...edition,
    templates: loadBuiltInTemplates(),
    pageSettings: { maxIterations: 1 },
  });

  assert(result.pages.some((page) => page.result.advertisements.some((ad) => ad.id === "ad-front")));
  assert(result.validation.issues.every((issue) => issue.code !== "missing-advertisement-reservation"));
};

const assertDetectsDuplicatePlacement = () => {
  const edition = createEdition(12, 2);
  const result = composeEdition({
    ...edition,
    templates: loadBuiltInTemplates(),
    pageSettings: { maxIterations: 1 },
  });
  const duplicatedPages = [
    result.pages[0],
    {
      ...result.pages[1],
      result: {
        ...result.pages[1].result,
        placedStories: [result.pages[0].result.placedStories[0], ...result.pages[1].result.placedStories],
      },
    },
  ];
  const validation = validateEditionComposition({
    editionPlan: edition.editionPlan,
    pages: duplicatedPages,
    stories: edition.stories,
    advertisements: edition.advertisements,
    configuration: edition.configuration,
  });

  assert.equal(validation.valid, false);
  assert(validation.issues.some((issue) => issue.code === "duplicate-story-placement"));
};

const assertDetectsOrphanStories = () => {
  const edition = createEdition(8, 1);
  const result = composeEdition({
    ...edition,
    stories: edition.stories.slice(0, 4),
    templates: loadBuiltInTemplates(),
    pageSettings: { maxIterations: 1 },
  });

  assert(result.validation.issues.some((issue) => issue.code === "orphan-story"));
};

const assertDetectsInvalidPageOrder = () => {
  const edition = createEdition(24, 3);
  const result = composeEdition({
    ...edition,
    templates: loadBuiltInTemplates(),
    pageSettings: { maxIterations: 1 },
  });
  const validation = validateEditionComposition({
    editionPlan: edition.editionPlan,
    pages: [...result.pages].reverse(),
    stories: edition.stories,
    advertisements: edition.advertisements,
    configuration: edition.configuration,
  });

  assert(validation.issues.some((issue) => issue.code === "invalid-page-order"));
};

assertComposesSixteenPageEdition();
assertReservesAdvertisements();
assertDetectsDuplicatePlacement();
assertDetectsOrphanStories();
assertDetectsInvalidPageOrder();

console.log("EditionComposer tests passed: 5");
