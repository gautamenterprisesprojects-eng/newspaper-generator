import type { StoryFrame } from "@/types/editor";
import { getStoryPolicy } from "./StoryPolicy";
import type { StoryProfile, StoryProfileInput, StorySection, StoryType } from "./StoryProfile";

const normalizeSection = (section?: string): StorySection => {
  const value = section?.toLowerCase();

  if (value === "front" || value === "city" || value === "opinion" || value === "sports" ||
    value === "business" || value === "features" || value === "classifieds" || value === "advertising") {
    return value;
  }

  return "general";
};

const classifyStoryType = (story: StoryFrame): { storyType: StoryType; reasons: string[] } => {
  const category = story.category?.toLowerCase();

  if (category === "advertising" || category === "advertisement") {
    return { storyType: "advertisement", reasons: ["category indicates advertisement"] };
  }

  if (story.priority === "lead" || story.role === "lead") {
    return { storyType: "lead", reasons: ["priority or role indicates lead story"] };
  }

  if (story.priority === "brief" || story.role === "brief") {
    return { storyType: "brief", reasons: ["priority or role indicates brief story"] };
  }

  if (category === "sports") {
    return { storyType: "sports", reasons: ["category indicates sports"] };
  }

  if (category === "opinion" || category === "editorial") {
    return { storyType: "editorial", reasons: ["category indicates editorial/opinion"] };
  }

  if (story.imageEnabled && story.imageHeight >= 140) {
    return { storyType: "photo", reasons: ["image settings indicate photo-led story"] };
  }

  return { storyType: "standard", reasons: ["no specialized editorial classifier matched"] };
};

const clampColumns = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

/** Builds a StoryProfile from explicit editorial hints and existing StoryFrame metadata. */
export const classifyStoryProfile = ({ story, storyType, section }: StoryProfileInput): StoryProfile => {
  const classification = storyType
    ? { storyType, reasons: ["explicit story type supplied"] }
    : classifyStoryType(story);
  const policy = getStoryPolicy(classification.storyType);
  const minimumColumns = Math.max(1, policy.minimumColumns);
  const maximumColumns = Math.max(minimumColumns, policy.maximumColumns);
  const preferredColumns = clampColumns(story.columnSpan || policy.preferredColumns, minimumColumns, maximumColumns);

  return {
    storyId: story.id,
    storyType: classification.storyType,
    section: section ?? normalizeSection(story.category) ?? policy.section,
    priority: story.priority ?? policy.priority,
    minimumColumns,
    preferredColumns,
    maximumColumns,
    grow: policy.grow,
    shrink: policy.shrink,
    split: policy.split,
    jump: policy.jump,
    imageRules: { ...policy.imageRules },
    headlineRules: {
      ...policy.headlineRules,
      allowAutoFit: policy.headlineRules.allowAutoFit && story.autoFitHeadline,
    },
    captionRules: { ...policy.captionRules },
    diagnostics: {
      classifier: storyType ? "explicit" : "derived",
      reasons: classification.reasons,
    },
  };
};

/** Builds deterministic StoryProfiles for a list of editor StoryFrames. */
export const classifyStoryProfiles = (stories: StoryFrame[]): Record<string, StoryProfile> =>
  Object.fromEntries(
    stories
      .map((story) => classifyStoryProfile({ story }))
      .sort((first, second) => first.storyId.localeCompare(second.storyId))
      .map((profile) => [profile.storyId, profile]),
  );

