import type { StoryProfile } from "@/engines/EditorialStory";
import type { AdvertisementReservation, EditionRuleSet, PlannerSection, PlannerTemplate } from "./EditionRules";
import { DEFAULT_EDITION_RULES } from "./EditionRules";
import { selectTemplate, type TemplateSelection } from "./TemplateSelector";

export type StoryAssignment = {
  storyId: string;
  section: PlannerSection;
  rank: number;
  priority: StoryProfile["priority"];
};

export type PageAssignment = {
  pageNumber: number;
  section: PlannerSection;
  storyIds: string[];
  advertisementIds: string[];
  templateSelection: TemplateSelection;
};

export type PagePlan = {
  pageNumber: number;
  section: PlannerSection;
  storyAssignments: StoryAssignment[];
  advertisementReservations: AdvertisementReservation[];
  templateSelection: TemplateSelection;
};

const compareStories = (rules: EditionRuleSet) => (first: StoryProfile, second: StoryProfile) =>
  (rules.priorityWeight[first.priority] ?? Number.MAX_SAFE_INTEGER) -
    (rules.priorityWeight[second.priority] ?? Number.MAX_SAFE_INTEGER) ||
  second.preferredColumns - first.preferredColumns ||
  first.storyId.localeCompare(second.storyId);

/** Plans one page by ranking already section-filtered stories and choosing a template. */
export const planPage = ({
  pageNumber,
  section,
  profiles,
  advertisements,
  templates,
  capacity,
  rules = DEFAULT_EDITION_RULES,
}: {
  pageNumber: number;
  section: PlannerSection;
  profiles: StoryProfile[];
  advertisements: AdvertisementReservation[];
  templates: PlannerTemplate[];
  capacity: number;
  rules?: EditionRuleSet;
}): PagePlan => {
  const storyAssignments = [...profiles]
    .sort(compareStories(rules))
    .slice(0, capacity)
    .map((profile, index) => ({
      storyId: profile.storyId,
      section,
      rank: index + 1,
      priority: profile.priority,
    }));
  const pageAdvertisements = advertisements
    .filter((ad) => ad.lockedPageNumber === pageNumber || ad.preferredPageNumber === pageNumber || ad.section === section)
    .sort((first, second) =>
      (first.lockedPageNumber ? 0 : 1) - (second.lockedPageNumber ? 0 : 1) ||
      (first.priority ?? 100) - (second.priority ?? 100) ||
      first.id.localeCompare(second.id),
    );

  return {
    pageNumber,
    section,
    storyAssignments,
    advertisementReservations: pageAdvertisements,
    templateSelection: selectTemplate({
      section,
      storyCount: storyAssignments.length,
      advertisements: pageAdvertisements,
      templates,
    }),
  };
};

