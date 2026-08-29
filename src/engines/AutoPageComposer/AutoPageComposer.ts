import { orchestrateComposition } from "@/engines/CompositionOrchestrator";
import { classifyStoryProfiles, type StoryProfile } from "@/engines/EditorialStory";
import type { AdvertisementReservation, PagePlan } from "@/engines/PagePlanner";
import type { NewspaperPageTemplate } from "@/engines/TemplateLibrary";
import { findBuiltInTemplate } from "@/engines/TemplateLibrary";
import { generateTemplateLayout } from "@/engines/TemplateLayout/TemplateLayoutEngine";
import type { LayoutColumn, LayoutRect } from "@/engines/LayoutTransactionEngine/LayoutTransactionTypes";
import type { StoryFrame, StoryColumnSpan } from "@/types/editor";
import { POINTS_PER_INCH } from "@/utils/page";
import { matchStoriesToSlots } from "./StorySlotMatcher";
import { validatePageComposition } from "./CompositionValidator";
import { selectEditorialTemplate } from "@/engines/EditorialDesignEngine";
import type { AutoPageStorySlot, PageCompositionResult } from "./PageCompositionResult";

export type AutoPageComposerInput = {
  pagePlan: PagePlan;
  selectedTemplate: NewspaperPageTemplate | string;
  storyProfiles?: Record<string, StoryProfile>;
  stories: StoryFrame[];
  advertisements?: AdvertisementReservation[];
  pageSettings?: Partial<{
    pageId: string;
    productionView: boolean;
    maxIterations: number;
  }>;
};

const toPoints = (inches: number) => inches * POINTS_PER_INCH;

const getTemplate = (template: NewspaperPageTemplate | string): NewspaperPageTemplate => {
  if (typeof template !== "string") {
    return template;
  }

  const resolved = findBuiltInTemplate(template);

  if (!resolved) {
    throw new Error(`Unknown page template '${template}'.`);
  }

  return resolved;
};

const getContentBounds = (template: NewspaperPageTemplate): LayoutRect => ({
  x: toPoints(template.margins.left),
  y: toPoints(template.margins.top),
  width: toPoints(template.pageSize.width - template.margins.left - template.margins.right),
  height: toPoints(template.pageSize.height - template.margins.top - template.margins.bottom),
});

const getPageBounds = (template: NewspaperPageTemplate): LayoutRect => ({
  x: 0,
  y: 0,
  width: toPoints(template.pageSize.width),
  height: toPoints(template.pageSize.height),
});

const getColumns = (template: NewspaperPageTemplate, contentBounds: LayoutRect): LayoutColumn[] => {
  const gutter = toPoints(template.columns.gutter);
  const totalGutter = gutter * Math.max(0, template.columns.count - 1);
  const width = (contentBounds.width - totalGutter) / template.columns.count;

  return Array.from({ length: template.columns.count }, (_, index) => ({
    index: index + 1,
    x: contentBounds.x + index * (width + gutter),
    y: contentBounds.y,
    width,
    height: contentBounds.height,
  }));
};

const zoneToPoints = (zone: { x: number; y: number; width: number; height: number }): LayoutRect => ({
  x: toPoints(zone.x),
  y: toPoints(zone.y),
  width: toPoints(zone.width),
  height: toPoints(zone.height),
});

const rectsOverlap = (first: LayoutRect, second: LayoutRect) =>
  Math.max(first.x, second.x) < Math.min(first.x + first.width, second.x + second.width) &&
  Math.max(first.y, second.y) < Math.min(first.y + first.height, second.y + second.height);

const buildSlots = (
  template: NewspaperPageTemplate,
  contentBounds: LayoutRect,
  storyProfiles: Record<string, StoryProfile>,
  storyCount: number,
): AutoPageStorySlot[] => {
  const layout = generateTemplateLayout({
    templateId: selectEditorialTemplate(storyCount, storyProfiles),
    pageWidth: toPoints(template.pageSize.width),
    contentX: contentBounds.x,
    contentY: contentBounds.y,
    contentWidth: contentBounds.width,
    contentHeight: contentBounds.height,
    columnCount: template.columns.count,
    gutter: toPoints(template.columns.gutter),
  });
  const adZones = template.advertisementZones.map(zoneToPoints);

  return layout.slots.map((slot) => ({
    ...slot,
    id: `slot-${slot.storyNumber}`,
    reservedForAdvertisement: adZones.some((zone) => rectsOverlap(slot, zone)),
  }));
};

const placeStoryInSlot = (
  story: StoryFrame,
  slot: AutoPageStorySlot,
): StoryFrame => ({
  ...story,
  x: slot.x,
  y: slot.y,
  width: slot.width,
  height: slot.height,
  priority: slot.priority,
  role: slot.priority === "lead" ? "lead" : slot.priority === "major" ? "major" : slot.priority === "brief" ? "brief" : "medium",
  columnStart: Math.max(1, Math.min(8, slot.columnStart)) as StoryColumnSpan,
  columnSpan: Math.max(1, Math.min(8, slot.columnSpan)) as StoryColumnSpan,
  imageEnabled: story.imageEnabled || slot.priority === "lead",
  compositionSettings: {
    ...story.compositionSettings,
    baselineGridSize: 6,
  },
});

/** Composes a finished newspaper page from editorial plan, template, profiles, and stories. */
export const composeAutoPage = (input: AutoPageComposerInput): PageCompositionResult => {
  const template = getTemplate(input.selectedTemplate);
  const pageId = input.pageSettings?.pageId ?? `auto-page-${input.pagePlan.pageNumber}`;
  const pageBounds = getPageBounds(template);
  const contentBounds = getContentBounds(template);
  const columns = getColumns(template, contentBounds);
  const storyProfiles = input.storyProfiles ?? classifyStoryProfiles(input.stories);
  const plannedStoryIds = new Set(input.pagePlan.storyAssignments.map((assignment) => assignment.storyId));
  const candidateStories = input.stories.filter((story) => plannedStoryIds.size === 0 || plannedStoryIds.has(story.id));
  const slots = buildSlots(template, contentBounds, storyProfiles, candidateStories.length);
  const matches = matchStoriesToSlots({
    stories: candidateStories,
    profiles: storyProfiles,
    slots,
  });
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]));
  const storiesById = new Map(candidateStories.map((story) => [story.id, story]));
  const placedStories = matches.placed
    .map((assignment) => {
      const story = storiesById.get(assignment.storyId);
      const slot = slotsById.get(assignment.slotId);

      return story && slot ? placeStoryInSlot(story, slot) : null;
    })
    .filter((story): story is StoryFrame => Boolean(story));
  const orchestrator = orchestrateComposition({
    pageId,
    pageBounds,
    contentBounds,
    columns,
    stories: placedStories,
    changedStoryIds: placedStories.map((story) => story.id),
    productionView: input.pageSettings?.productionView ?? true,
    maxIterations: input.pageSettings?.maxIterations ?? 3,
    storyProfiles,
  });
  const advertisements = input.advertisements ?? input.pagePlan.advertisementReservations;
  const validation = validatePageComposition({
    stories: orchestrator.stories,
    advertisements,
    contentBounds,
    illegalWhitespaceArea: orchestrator.iterations.at(-1)?.illegalWhitespaceArea ?? 0,
  });

  return {
    pageId,
    template,
    placedStories: orchestrator.stories,
    placedStoryAssignments: matches.placed,
    rejectedStories: matches.rejected,
    unusedSlots: matches.unusedSlots,
    advertisements,
    validation,
    metrics: {
      placedStoryCount: orchestrator.stories.length,
      rejectedStoryCount: matches.rejected.length,
      unusedSlotCount: matches.unusedSlots.length,
      advertisementReservationCount: advertisements.length,
      compositionIterations: orchestrator.iterations.length,
      compositionTimeMs: orchestrator.composition.diagnostics.compositionTimeMs,
    },
    orchestrator,
    storyProfiles,
  };
};

export const AutoPageComposer = {
  composeAutoPage,
};
