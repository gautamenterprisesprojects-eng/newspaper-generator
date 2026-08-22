import type { StoryProfile, StorySection } from "@/engines/EditorialStory";

export type PlannerSection =
  | "front-page"
  | "national"
  | "state"
  | "district"
  | "sports"
  | "business"
  | "editorial"
  | "entertainment";

export type EditionConfiguration = {
  editionId: string;
  pageCount: number;
  sections: PlannerSection[];
  storiesPerPageTarget: number;
  maximumStoriesPerPage?: number;
};

export type AdvertisementReservation = {
  id: string;
  section?: PlannerSection;
  preferredPageNumber?: number;
  lockedPageNumber?: number;
  columnSpan?: number;
  priority?: number;
};

export type PlannerTemplate = {
  id: string;
  name: string;
  sections?: PlannerSection[];
  minimumStories: number;
  maximumStories: number;
  supportsAdvertisements: boolean;
  priorityWeight?: number;
};

export type EditionRuleSet = {
  sectionOrder: PlannerSection[];
  priorityWeight: Record<StoryProfile["priority"], number>;
  sectionWeight: Record<PlannerSection, number>;
};

export const DEFAULT_SECTION_ORDER: PlannerSection[] = [
  "front-page",
  "national",
  "state",
  "district",
  "sports",
  "business",
  "editorial",
  "entertainment",
];

export const DEFAULT_EDITION_RULES: EditionRuleSet = {
  sectionOrder: DEFAULT_SECTION_ORDER,
  priorityWeight: {
    lead: 0,
    major: 1,
    secondary: 2,
    brief: 3,
    filler: 4,
  },
  sectionWeight: {
    "front-page": 0,
    national: 1,
    state: 2,
    district: 3,
    sports: 4,
    business: 5,
    editorial: 6,
    entertainment: 7,
  },
};

export const DEFAULT_PLANNER_TEMPLATES: PlannerTemplate[] = [
  {
    id: "front-balanced",
    name: "Front Balanced",
    sections: ["front-page"],
    minimumStories: 3,
    maximumStories: 6,
    supportsAdvertisements: true,
    priorityWeight: 0,
  },
  {
    id: "section-standard",
    name: "Section Standard",
    minimumStories: 3,
    maximumStories: 8,
    supportsAdvertisements: true,
    priorityWeight: 1,
  },
  {
    id: "text-heavy",
    name: "Text Heavy",
    minimumStories: 5,
    maximumStories: 10,
    supportsAdvertisements: false,
    priorityWeight: 2,
  },
];

export const mapStorySectionToPlannerSection = (section: StorySection): PlannerSection => {
  if (section === "front") return "front-page";
  if (section === "sports") return "sports";
  if (section === "business") return "business";
  if (section === "opinion") return "editorial";
  if (section === "features") return "entertainment";
  if (section === "city") return "district";

  return "national";
};

/** Returns the configured sections in deterministic production order. */
export const getOrderedSections = (
  config: EditionConfiguration,
  rules: EditionRuleSet = DEFAULT_EDITION_RULES,
): PlannerSection[] =>
  [...config.sections].sort((first, second) =>
    (rules.sectionWeight[first] ?? Number.MAX_SAFE_INTEGER) -
      (rules.sectionWeight[second] ?? Number.MAX_SAFE_INTEGER) ||
    first.localeCompare(second),
  );

