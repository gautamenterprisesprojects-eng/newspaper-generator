import type { StoryProfile } from "@/engines/EditorialStory";
import type {
  AdvertisementReservation,
  EditionConfiguration,
  EditionRuleSet,
  PlannerSection,
  PlannerTemplate,
} from "./EditionRules";
import {
  DEFAULT_EDITION_RULES,
  DEFAULT_PLANNER_TEMPLATES,
  getOrderedSections,
  mapStorySectionToPlannerSection,
} from "./EditionRules";
import { planPage, type PageAssignment, type PagePlan, type StoryAssignment } from "./PagePlanner";

export type EditionPlan = {
  editionId: string;
  pageOrder: PlannerSection[];
  pages: PagePlan[];
  pageAssignments: PageAssignment[];
  storyAssignments: StoryAssignment[];
  unassignedStoryIds: string[];
};

const groupProfilesBySection = (profiles: StoryProfile[]) => {
  const groups = new Map<PlannerSection, StoryProfile[]>();

  for (const profile of profiles) {
    const section = mapStorySectionToPlannerSection(profile.section);
    groups.set(section, [...(groups.get(section) ?? []), profile]);
  }

  return groups;
};

const getPageSection = (orderedSections: PlannerSection[], pageIndex: number) =>
  orderedSections[Math.min(pageIndex, orderedSections.length - 1)] ?? "national";

/** Builds an edition-wide editorial plan without calculating or mutating geometry. */
export const planEdition = ({
  storyProfiles,
  configuration,
  advertisements = [],
  templates = DEFAULT_PLANNER_TEMPLATES,
  rules = DEFAULT_EDITION_RULES,
}: {
  storyProfiles: Record<string, StoryProfile> | StoryProfile[];
  configuration: EditionConfiguration;
  advertisements?: AdvertisementReservation[];
  templates?: PlannerTemplate[];
  rules?: EditionRuleSet;
}): EditionPlan => {
  const profiles = Array.isArray(storyProfiles)
    ? [...storyProfiles]
    : Object.values(storyProfiles);
  const sectionOrder = getOrderedSections(configuration, rules);
  const grouped = groupProfilesBySection(profiles);
  const assignedIds = new Set<string>();
  const pages: PagePlan[] = [];
  const maxStories = configuration.maximumStoriesPerPage ?? configuration.storiesPerPageTarget;

  for (let pageIndex = 0; pageIndex < configuration.pageCount; pageIndex += 1) {
    const pageNumber = pageIndex + 1;
    const nonFrontSections = sectionOrder.filter((item) => item !== "front-page");
    const section = pageNumber === 1 && sectionOrder.includes("front-page")
      ? "front-page"
      : getPageSection(nonFrontSections, sectionOrder.includes("front-page") ? pageIndex - 1 : pageIndex);
    const sectionProfiles = (grouped.get(section) ?? [])
      .filter((profile) => !assignedIds.has(profile.storyId));
    const fallbackProfiles = profiles
      .filter((profile) => !assignedIds.has(profile.storyId))
      .filter((profile) => sectionProfiles.length === 0 || mapStorySectionToPlannerSection(profile.section) === section);
    const pageProfiles = sectionProfiles.length > 0 ? sectionProfiles : fallbackProfiles;
    const page = planPage({
      pageNumber,
      section,
      profiles: pageProfiles,
      advertisements,
      templates,
      capacity: maxStories,
      rules,
    });

    for (const assignment of page.storyAssignments) {
      assignedIds.add(assignment.storyId);
    }

    pages.push(page);
  }

  const storyAssignments = pages.flatMap((page) => page.storyAssignments);
  const pageAssignments = pages.map((page) => ({
    pageNumber: page.pageNumber,
    section: page.section,
    storyIds: page.storyAssignments.map((assignment) => assignment.storyId),
    advertisementIds: page.advertisementReservations.map((ad) => ad.id),
    templateSelection: page.templateSelection,
  }));

  return {
    editionId: configuration.editionId,
    pageOrder: pages.map((page) => page.section),
    pages,
    pageAssignments,
    storyAssignments,
    unassignedStoryIds: profiles
      .map((profile) => profile.storyId)
      .filter((storyId) => !assignedIds.has(storyId))
      .sort(),
  };
};
