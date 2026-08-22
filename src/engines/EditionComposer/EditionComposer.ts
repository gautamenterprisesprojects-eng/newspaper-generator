import { composeAutoPage } from "@/engines/AutoPageComposer";
import { classifyStoryProfiles, type StoryProfile } from "@/engines/EditorialStory";
import type {
  AdvertisementReservation,
  EditionConfiguration,
  EditionPlan,
  PagePlan,
  PlannerSection,
} from "@/engines/PagePlanner";
import type { NewspaperPageTemplate } from "@/engines/TemplateLibrary";
import { findBuiltInTemplate } from "@/engines/TemplateLibrary";
import type { StoryFrame } from "@/types/editor";
import { validateEditionComposition } from "./EditionValidator";
import type {
  EditionCompositionResult,
  EditionPageComposition,
  EditionRejectedStory,
} from "./EditionCompositionResult";

export type EditionComposerInput = {
  editionPlan: EditionPlan;
  pagePlans?: PagePlan[];
  templates: NewspaperPageTemplate[];
  stories: StoryFrame[];
  advertisements?: AdvertisementReservation[];
  storyProfiles?: Record<string, StoryProfile>;
  configuration?: EditionConfiguration;
  pageSettings?: Partial<{
    productionView: boolean;
    maxIterations: number;
  }>;
};

const sectionTemplateOrder: Record<PlannerSection, string[]> = {
  "front-page": ["front-page", "template-front-page"],
  national: ["national", "template-national"],
  state: ["state", "template-state"],
  district: ["district", "template-district"],
  sports: ["sports", "template-sports"],
  business: ["business", "template-business"],
  editorial: ["editorial", "template-editorial"],
  entertainment: ["entertainment", "template-entertainment"],
};

const resolveTemplate = (
  pagePlan: PagePlan,
  templates: NewspaperPageTemplate[],
): NewspaperPageTemplate => {
  const bySelection = templates.find((template) => template.id === pagePlan.templateSelection.templateId);

  if (bySelection) {
    return bySelection;
  }

  const bySection = templates.find((template) => template.pageType === pagePlan.section);

  if (bySection) {
    return bySection;
  }

  for (const idOrType of sectionTemplateOrder[pagePlan.section]) {
    const builtIn = findBuiltInTemplate(idOrType);

    if (builtIn) {
      return builtIn;
    }
  }

  const fallback = templates[0] ?? findBuiltInTemplate("front-page");

  if (!fallback) {
    throw new Error("EditionComposer requires at least one available page template.");
  }

  return fallback;
};

const collectRejectedStories = (pages: EditionPageComposition[]): EditionRejectedStory[] =>
  pages
    .flatMap((page) =>
      page.result.rejectedStories.map((story) => ({
        ...story,
        pageNumber: page.pageNumber,
      })),
    )
    .sort((first, second) =>
      (first.pageNumber ?? 0) - (second.pageNumber ?? 0) ||
      first.storyId.localeCompare(second.storyId),
    );

/** Composes a full newspaper edition by delegating each page to AutoPageComposer. */
export const composeEdition = (input: EditionComposerInput): EditionCompositionResult => {
  const pagePlans = [...(input.pagePlans ?? input.editionPlan.pages)]
    .sort((first, second) => first.pageNumber - second.pageNumber);
  const storyProfiles = input.storyProfiles ?? classifyStoryProfiles(input.stories);
  const advertisements = input.advertisements ?? input.editionPlan.pages.flatMap((page) => page.advertisementReservations);
  const pages = pagePlans.map((pagePlan): EditionPageComposition => {
    const template = resolveTemplate(pagePlan, input.templates);
    const result = composeAutoPage({
      pagePlan,
      selectedTemplate: template,
      storyProfiles,
      stories: input.stories,
      advertisements: pagePlan.advertisementReservations,
      pageSettings: {
        pageId: `${input.editionPlan.editionId}-page-${pagePlan.pageNumber}`,
        productionView: input.pageSettings?.productionView ?? true,
        maxIterations: input.pageSettings?.maxIterations ?? 3,
      },
    });

    return {
      pageNumber: pagePlan.pageNumber,
      section: pagePlan.section,
      pagePlan,
      template,
      result,
    };
  });
  const placedStories = pages
    .flatMap((page) => page.result.placedStories)
    .sort((first, second) => first.id.localeCompare(second.id));
  const rejectedStories = collectRejectedStories(pages);
  const placedIds = new Set(placedStories.map((story) => story.id));
  const rejectedIds = new Set(rejectedStories.map((story) => story.storyId));
  const unusedStories = input.stories
    .filter((story) => !placedIds.has(story.id) && !rejectedIds.has(story.id))
    .sort((first, second) => first.id.localeCompare(second.id));
  const validation = validateEditionComposition({
    editionPlan: input.editionPlan,
    pages,
    stories: input.stories,
    advertisements,
    configuration: input.configuration,
  });

  return {
    editionId: input.editionPlan.editionId,
    editionPlan: input.editionPlan,
    pages,
    placedStories,
    rejectedStories,
    unusedStories,
    advertisements,
    storyProfiles,
    validation,
    metrics: {
      pageCount: pages.length,
      placedStoryCount: placedStories.length,
      rejectedStoryCount: rejectedStories.length,
      unusedStoryCount: unusedStories.length,
      advertisementReservationCount: advertisements.length,
      validPageCount: pages.filter((page) => page.result.validation.valid).length,
      invalidPageCount: pages.filter((page) => !page.result.validation.valid).length,
      totalCompositionIterations: pages.reduce((sum, page) => sum + page.result.metrics.compositionIterations, 0),
      totalCompositionTimeMs: pages.reduce((sum, page) => sum + page.result.metrics.compositionTimeMs, 0),
    },
  };
};

export const EditionComposer = {
  composeEdition,
};
