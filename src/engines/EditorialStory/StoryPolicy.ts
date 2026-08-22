import type { StoryPriority } from "@/types/editor";
import type { StoryCaptionRules, StoryHeadlineRules, StoryImageRules, StorySection, StoryType } from "./StoryProfile";

export type StoryPolicy = {
  storyType: StoryType;
  section: StorySection;
  priority: StoryPriority;
  minimumColumns: number;
  preferredColumns: number;
  maximumColumns: number;
  grow: boolean;
  shrink: boolean;
  split: boolean;
  jump: boolean;
  imageRules: StoryImageRules;
  headlineRules: StoryHeadlineRules;
  captionRules: StoryCaptionRules;
};

const imageRules = (overrides: Partial<StoryImageRules> = {}): StoryImageRules => ({
  required: false,
  allowAutoCrop: true,
  preserveAspectRatio: true,
  minimumHeight: 0,
  maximumHeight: 240,
  preferredPlacement: "inline",
  ...overrides,
});

const headlineRules = (overrides: Partial<StoryHeadlineRules> = {}): StoryHeadlineRules => ({
  required: true,
  allowAutoFit: true,
  allowMultiDeck: false,
  minimumLines: 1,
  maximumLines: 3,
  tone: "news",
  ...overrides,
});

const captionRules = (overrides: Partial<StoryCaptionRules> = {}): StoryCaptionRules => ({
  required: false,
  allowOverflow: false,
  maximumLines: 3,
  requireCredit: false,
  ...overrides,
});

export const STORY_POLICIES: Record<StoryType, StoryPolicy> = {
  lead: {
    storyType: "lead",
    section: "front",
    priority: "lead",
    minimumColumns: 3,
    preferredColumns: 4,
    maximumColumns: 6,
    grow: true,
    shrink: false,
    split: false,
    jump: false,
    imageRules: imageRules({ required: true, minimumHeight: 140, maximumHeight: 360, preferredPlacement: "dominant" }),
    headlineRules: headlineRules({ allowMultiDeck: true, maximumLines: 4 }),
    captionRules: captionRules({ required: true, requireCredit: true }),
  },
  brief: {
    storyType: "brief",
    section: "general",
    priority: "brief",
    minimumColumns: 1,
    preferredColumns: 1,
    maximumColumns: 2,
    grow: false,
    shrink: true,
    split: false,
    jump: false,
    imageRules: imageRules({ allowAutoCrop: false, maximumHeight: 80, preferredPlacement: "none" }),
    headlineRules: headlineRules({ maximumLines: 2 }),
    captionRules: captionRules({ maximumLines: 1 }),
  },
  advertisement: {
    storyType: "advertisement",
    section: "advertising",
    priority: "filler",
    minimumColumns: 1,
    preferredColumns: 2,
    maximumColumns: 6,
    grow: false,
    shrink: false,
    split: false,
    jump: false,
    imageRules: imageRules({ required: true, allowAutoCrop: false, preferredPlacement: "dominant" }),
    headlineRules: headlineRules({ required: false, allowAutoFit: false, tone: "advertisement" }),
    captionRules: captionRules({ required: false, allowOverflow: false, maximumLines: 0 }),
  },
  photo: {
    storyType: "photo",
    section: "features",
    priority: "major",
    minimumColumns: 2,
    preferredColumns: 3,
    maximumColumns: 6,
    grow: true,
    shrink: true,
    split: false,
    jump: false,
    imageRules: imageRules({ required: true, minimumHeight: 180, maximumHeight: 420, preferredPlacement: "dominant" }),
    headlineRules: headlineRules({ maximumLines: 2 }),
    captionRules: captionRules({ required: true, requireCredit: true, maximumLines: 4 }),
  },
  editorial: {
    storyType: "editorial",
    section: "opinion",
    priority: "major",
    minimumColumns: 2,
    preferredColumns: 3,
    maximumColumns: 4,
    grow: true,
    shrink: true,
    split: true,
    jump: true,
    imageRules: imageRules({ preferredPlacement: "none" }),
    headlineRules: headlineRules({ tone: "opinion", allowMultiDeck: true }),
    captionRules: captionRules(),
  },
  sports: {
    storyType: "sports",
    section: "sports",
    priority: "secondary",
    minimumColumns: 1,
    preferredColumns: 2,
    maximumColumns: 4,
    grow: true,
    shrink: true,
    split: true,
    jump: true,
    imageRules: imageRules({ minimumHeight: 96, maximumHeight: 260, preferredPlacement: "top" }),
    headlineRules: headlineRules({ tone: "sports", maximumLines: 3 }),
    captionRules: captionRules({ requireCredit: true }),
  },
  standard: {
    storyType: "standard",
    section: "general",
    priority: "secondary",
    minimumColumns: 1,
    preferredColumns: 2,
    maximumColumns: 4,
    grow: true,
    shrink: true,
    split: true,
    jump: true,
    imageRules: imageRules(),
    headlineRules: headlineRules(),
    captionRules: captionRules(),
  },
};

/** Returns an immutable editorial policy for a story type. */
export const getStoryPolicy = (storyType: StoryType): StoryPolicy => ({
  ...STORY_POLICIES[storyType],
  imageRules: { ...STORY_POLICIES[storyType].imageRules },
  headlineRules: { ...STORY_POLICIES[storyType].headlineRules },
  captionRules: { ...STORY_POLICIES[storyType].captionRules },
});

